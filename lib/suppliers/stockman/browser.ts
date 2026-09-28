import { access } from "node:fs/promises";
import path from "node:path";

import type { Browser, BrowserContext } from "playwright-core";
import { loadStockmanSessionState } from "@/lib/suppliers/stockman/session-store";

const DEFAULT_AUTH_FILE = "stockman-auth.json";

export function getStockmanAuthFile() {
  // Un chemin relatif est volontairement conserve tel quel.
  // Node le resoudra par rapport au cwd au runtime.
  // Cela evite a Turbopack de generer un pattern dynamique
  // base sur process.cwd() pendant le build Vercel.
  return process.env.STOCKMAN_AUTH_FILE?.trim() || DEFAULT_AUTH_FILE;
}

export async function stockmanAuthFileExists() {
  try {
    await access(getStockmanAuthFile());
    return true;
  } catch {
    return false;
  }
}

async function launchStockmanBrowser(): Promise<Browser> {
  const configuredExecutablePath = process.env.STOCKMAN_CHROMIUM_PATH?.trim();

  if (process.env.VERCEL) {
    // Vercel ne dispose pas du Chromium telecharge par le package Playwright.
    // On conserve l'API Playwright, mais on lui fournit un Chromium Linux
    // adapte au runtime serverless.
    const [{ chromium: playwrightChromium }, { default: serverlessChromium }] =
      await Promise.all([
        import("playwright-core"),
        import("@sparticuz/chromium"),
      ]);

    serverlessChromium.setGraphicsMode = false;

    return playwrightChromium.launch({
      args: serverlessChromium.args,
      executablePath:
        configuredExecutablePath || (await serverlessChromium.executablePath()),
      headless: true,
    });
  }

  // En local, on garde le navigateur Playwright installe sur le poste.
  const { chromium } = await import("playwright");

  return chromium.launch({
    headless: process.env.STOCKMAN_HEADLESS !== "false",
    executablePath: configuredExecutablePath || undefined,
  });
}

export async function openStockmanBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const authFile = getStockmanAuthFile();
  const persistedState = await loadStockmanSessionState();
  const hasLocalFile = await stockmanAuthFileExists();

  if (!persistedState && !hasLocalFile) {
    throw new Error(
      `Session Stockman introuvable. Lancez "npm run stockman:auth" ou la reconnexion depuis le BO local pour creer ${path.basename(
        authFile,
      )}.`,
    );
  }

  const browser = await launchStockmanBrowser();

  const context = await browser.newContext({
    storageState: persistedState ?? authFile,
  });

  return { browser, context };
}
