import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { getStockmanAuthFile, stockmanAuthFileExists } from "@/lib/suppliers/stockman/browser";

const STOCKMAN_HOME = "https://www.stockman.fr/";
const TEST_URL = "https://www.stockman.fr/fr/diables-et-chariots-de-manutention--6/chariots-et-servantes--11/--1/chariot-acier-1000-x-700-mm-modulable-1-ou-2-timons-300-a-500-kg--CHM.aspx";
const TEST_REFERENCE = "CHM2T1";
const JOB_TTL_MS = 15 * 60 * 1000;

type AuthJob = {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: number;
};

type GlobalAuthJobs = typeof globalThis & {
  __oysteStockmanAuthJobs?: Map<string, AuthJob>;
};

const globalJobs = globalThis as GlobalAuthJobs;
const jobs = globalJobs.__oysteStockmanAuthJobs ?? new Map<string, AuthJob>();
globalJobs.__oysteStockmanAuthJobs = jobs;

async function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt <= JOB_TTL_MS) continue;
    jobs.delete(id);
    await job.context.close().catch(() => undefined);
    await job.browser.close().catch(() => undefined);
  }
}

export async function checkCommercialAccess(page: Page) {
  await page.goto(TEST_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1_200);

  return page.evaluate((reference) => {
    const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const refs = Array.from(document.querySelectorAll("[id*='ref_article']"));
    const ref = refs.find((node) => clean(node.textContent).toUpperCase() === reference);
    const row = ref?.closest("tr") ?? null;
    const stock = row?.querySelector("[id*='stock_article']") ?? null;
    const price = row?.querySelector("[id*='price_by_qty']") ?? null;
    const body = clean(document.body?.innerText);
    const connectedMarker = /bonjour\s+[A-ZÀ-Ÿ]|d[eé]connexion|mon compte/i.test(body);

    return {
      referenceFound: Boolean(ref),
      stockFound: Boolean(stock),
      priceFound: Boolean(price),
      stockText: clean(stock?.textContent),
      priceText: clean(price?.textContent),
      connectedMarker,
      url: window.location.href,
    };
  }, TEST_REFERENCE);
}

export async function inspectSavedStockmanSession() {
  if (!(await stockmanAuthFileExists())) {
    return {
      state: "missing" as const,
      valid: false,
      message: "Aucune session Stockman enregistrée.",
    };
  }

  const authFile = getStockmanAuthFile();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STOCKMAN_CHROMIUM_PATH?.trim() || undefined,
  });

  try {
    const context = await browser.newContext({ storageState: authFile });
    try {
      const page = await context.newPage();
      const access = await checkCommercialAccess(page);
      const valid = access.referenceFound && access.stockFound && access.priceFound;
      return {
        state: valid ? ("valid" as const) : ("expired" as const),
        valid,
        message: valid
          ? `Session revendeur active · ${TEST_REFERENCE} : stock ${access.stockText || "détecté"}, prix ${access.priceText || "détecté"}.`
          : "La session Stockman existe mais l’accès revendeur a expiré. Reconnectez-vous.",
        access,
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  } catch (error) {
    return {
      state: "expired" as const,
      valid: false,
      message: error instanceof Error ? error.message : "La session Stockman n’a pas pu être vérifiée.",
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function startInteractiveStockmanLogin() {
  await cleanupExpiredJobs();

  if (process.env.VERCEL || process.env.STOCKMAN_DISABLE_INTERACTIVE_AUTH === "true") {
    throw new Error(
      "La reconnexion interactive Stockman doit être lancée sur le poste qui exécute OYSTE localement.",
    );
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.STOCKMAN_CHROMIUM_PATH?.trim() || undefined,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(STOCKMAN_HOME, { waitUntil: "domcontentloaded", timeout: 45_000 });

  const id = randomUUID();
  jobs.set(id, { id, browser, context, page, createdAt: Date.now() });

  return {
    jobId: id,
    expiresInSeconds: Math.floor(JOB_TTL_MS / 1000),
    message: "Chromium Stockman est ouvert. Connectez-vous avec le compte revendeur, puis revenez dans OYSTE pour valider la session.",
  };
}

export async function confirmInteractiveStockmanLogin(jobId: string) {
  await cleanupExpiredJobs();
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error("La fenêtre de reconnexion n’est plus active. Relancez la reconnexion Stockman.");
  }

  const access = await checkCommercialAccess(job.page);
  if (!access.referenceFound || !access.stockFound || !access.priceFound) {
    throw new Error(
      `Connexion revendeur non détectée. Vérifiez dans Chromium que les stocks et prix sont visibles, puis réessayez. (stock=${access.stockFound ? "oui" : "non"}, prix=${access.priceFound ? "oui" : "non"})`,
    );
  }

  const authFile = getStockmanAuthFile();
  await mkdir(path.dirname(authFile), { recursive: true });
  await job.context.storageState({ path: authFile });

  // On valide la session sauvegardée dans un nouveau contexte avant d'écraser
  // définitivement l'état de connexion côté interface.
  const verificationContext = await job.browser.newContext({ storageState: authFile });
  try {
    const verificationPage = await verificationContext.newPage();
    const verification = await checkCommercialAccess(verificationPage);
    if (!verification.stockFound || !verification.priceFound) {
      throw new Error("La session a été sauvegardée mais ne restitue pas l’accès revendeur.");
    }
  } finally {
    await verificationContext.close().catch(() => undefined);
  }

  jobs.delete(jobId);
  await job.context.close().catch(() => undefined);
  await job.browser.close().catch(() => undefined);

  return {
    valid: true,
    message: `Session Stockman reconnectée · ${TEST_REFERENCE} : stock ${access.stockText || "détecté"}, prix ${access.priceText || "détecté"}.`,
  };
}

export async function cancelInteractiveStockmanLogin(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  jobs.delete(jobId);
  await job.context.close().catch(() => undefined);
  await job.browser.close().catch(() => undefined);
}
