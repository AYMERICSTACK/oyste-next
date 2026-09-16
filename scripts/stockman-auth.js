const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const process = require("node:process");

const STOCKMAN_HOME = "https://www.stockman.fr/";
const TEST_URL = "https://www.stockman.fr/fr/diables-et-chariots-de-manutention--6/chariots-et-servantes--11/--1/chariot-acier-1000-x-700-mm-modulable-1-ou-2-timons-300-a-500-kg--CHM.aspx";
const TEST_REFERENCE = "CHM2T1";

function authFilePath() {
  const configured = process.env.STOCKMAN_AUTH_FILE?.trim() || "stockman-auth.json";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

async function hasCommercialAccess(page) {
  await page.goto(TEST_URL, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1_500);

  const result = await page.evaluate((reference) => {
    const ref = Array.from(document.querySelectorAll("[id*='ref_article']"))
      .find((node) => (node.textContent || "").trim().toUpperCase() === reference);

    const row = ref?.closest("tr") || null;
    const stock = row?.querySelector("[id*='stock_article']") || null;
    const price = row?.querySelector("[id*='price_by_qty']") || null;

    return {
      referenceFound: Boolean(ref),
      stockFound: Boolean(stock),
      priceFound: Boolean(price),
      stockText: (stock?.textContent || "").replace(/\s+/g, " ").trim(),
      priceText: (price?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  }, TEST_REFERENCE);

  return result;
}

async function main() {
  const outputFile = authFilePath();
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.STOCKMAN_CHROMIUM_PATH?.trim() || undefined,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("");
    console.log("=== OYSTE · Connexion revendeur Stockman ===");
    console.log("");
    console.log("1. Une fenêtre Chromium va s'ouvrir sur Stockman.");
    console.log("2. Connecte-toi MANUELLEMENT avec le compte revendeur.");
    console.log("3. Vérifie dans le navigateur que les prix et stocks sont visibles.");
    console.log("4. Reviens dans ce terminal et appuie sur Entrée.");
    console.log("");
    console.log(`La session sera enregistrée dans : ${outputFile}`);
    console.log("");

    await page.goto(STOCKMAN_HOME, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    await rl.question("Appuie sur Entrée UNIQUEMENT après connexion revendeur... ");

    console.log("");
    console.log(`Vérification automatique sur ${TEST_REFERENCE}...`);

    const commercial = await hasCommercialAccess(page);

    if (!commercial.referenceFound) {
      throw new Error(
        `La référence témoin ${TEST_REFERENCE} n'est pas visible. La fiche Stockman n'a pas été chargée correctement.`,
      );
    }

    if (!commercial.stockFound || !commercial.priceFound) {
      throw new Error(
        [
          "La session ouverte n'est pas reconnue comme session commerciale/revendeur.",
          `Stock détecté : ${commercial.stockFound ? "oui" : "non"}.`,
          `Prix détecté : ${commercial.priceFound ? "oui" : "non"}.`,
          "Le fichier stockman-auth.json existant n'a PAS été remplacé.",
        ].join(" "),
      );
    }

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await context.storageState({ path: outputFile });

    console.log("");
    console.log("✅ Accès revendeur détecté.");
    console.log(`   ${TEST_REFERENCE} · stock : ${commercial.stockText || "détecté"}`);
    console.log(`   ${TEST_REFERENCE} · prix : ${commercial.priceText || "détecté"}`);
    console.log(`✅ Session sauvegardée : ${outputFile}`);

    // Re-open with the saved state to make sure OYSTE will see the same thing.
    const verificationContext = await browser.newContext({ storageState: outputFile });
    const verificationPage = await verificationContext.newPage();
    try {
      const verification = await hasCommercialAccess(verificationPage);
      if (!verification.stockFound || !verification.priceFound) {
        throw new Error(
          "La session a été sauvegardée mais ne restitue pas les données commerciales dans un nouveau contexte Playwright.",
        );
      }
      console.log("✅ Session rechargée et vérifiée dans un nouveau contexte Playwright.");
      console.log("");
      console.log("Tu peux maintenant relancer OYSTE et retester la préparation de CHM2T1.");
    } finally {
      await verificationContext.close().catch(() => undefined);
    }
  } finally {
    rl.close();
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("");
  console.error("❌ Authentification Stockman non validée.");
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  process.exitCode = 1;
});
