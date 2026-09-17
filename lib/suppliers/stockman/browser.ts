import { access } from "node:fs/promises";
import path from "node:path";

import type { Browser, BrowserContext } from "playwright";

const DEFAULT_AUTH_FILE = "stockman-auth.json";

export function getStockmanAuthFile() {
  // Un chemin relatif est volontairement conservé tel quel.
  // Node le résoudra par rapport au cwd au runtime.
  // Cela évite à Turbopack de générer un pattern dynamique
  // basé sur process.cwd() pendant le build Vercel.
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

export async function openStockmanBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const authFile = getStockmanAuthFile();

  if (!(await stockmanAuthFileExists())) {
    throw new Error(
      `Session Stockman introuvable. Lancez "npm run stockman:auth" pour créer ${path.basename(
        authFile,
      )} avec une vraie session revendeur.`,
    );
  }

  // Chargement uniquement lorsque Stockman est réellement utilisé.
  // /admin/fournisseurs ne charge donc pas Playwright simplement
  // pour afficher le statut fournisseur.
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: process.env.STOCKMAN_HEADLESS !== "false",
    executablePath: process.env.STOCKMAN_CHROMIUM_PATH?.trim() || undefined,
  });

  const context = await browser.newContext({
    storageState: authFile,
  });

  return { browser, context };
}
