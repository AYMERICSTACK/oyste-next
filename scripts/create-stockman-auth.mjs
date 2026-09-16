import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://www.stockman.fr", {
  waitUntil: "domcontentloaded",
});

console.log("");
console.log("Connecte-toi à ton compte revendeur Stockman.");
console.log(
  "Quand tu vois les prix et le stock, reviens ici et appuie sur Entrée.",
);
console.log("");

await new Promise((resolve) => {
  process.stdin.resume();
  process.stdin.once("data", resolve);
});

await context.storageState({
  path: "stockman-auth.json",
});

console.log("Nouveau stockman-auth.json enregistré.");

await browser.close();
