import { access } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright";

const DEFAULT_AUTH_FILE = "stockman-auth.json";

export function getStockmanAuthFile() {
  return path.join(process.cwd(), DEFAULT_AUTH_FILE);
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
      `Session Stockman introuvable. Lancez "npm run stockman:auth" pour créer ${path.basename(authFile)} avec une vraie session revendeur.`,
    );
  }

  const browser = await chromium.launch({
    headless: process.env.STOCKMAN_HEADLESS !== "false",
    executablePath: process.env.STOCKMAN_CHROMIUM_PATH?.trim() || undefined,
  });
  const context = await browser.newContext({ storageState: authFile });
  return { browser, context };
}
