import { access } from "node:fs/promises";
import path from "node:path";

import type { Browser, BrowserContext } from "playwright";

const DEFAULT_AUTH_FILE = "stockman-auth.json";

export function getStockmanAuthFile() {
  const configured =
    process.env.STOCKMAN_AUTH_FILE?.trim() || DEFAULT_AUTH_FILE;

  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
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

  // IMPORTANT :
  // Playwright n'est chargé que lorsqu'on ouvre réellement Stockman.
  // Cela évite que Vercel charge playwright-core au simple affichage
  // de /admin/fournisseurs.
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
