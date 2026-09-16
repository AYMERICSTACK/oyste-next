import { chromium } from "playwright";

const PRODUCT_URL =
  "https://www.stockman.fr/coins-roulants-et-rouleurs--3/rouleurs-avec-galets--85/--1/rouleur-avec-galets-pivotants-1000-kg--SC%20N.aspx?langue=FR&src=int";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: "stockman-auth.json",
});

const page = await context.newPage();

try {
  await page.goto(PRODUCT_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page.waitForTimeout(2_000);

  const bodyText = await page.locator("body").innerText();

  console.log("Connexion active :", bodyText.includes("Déconnexion"));
  console.log("Référence trouvée :", bodyText.includes("SC102N"));

  const usefulLines = bodyText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /SC102N|stock|prix|poids|€|13 kg/i.test(line));

  console.log("\n--- DONNÉES TROUVÉES ---\n");
  console.log(usefulLines.join("\n"));
} catch (error) {
  console.error("Erreur pendant le test :", error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
