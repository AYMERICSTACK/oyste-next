#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const snapshotPath = path.resolve("data/erp/erp-snapshot.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

const requiredFamilies = ["PFI", "PFT", "PMI", "PMT", "PORT"];
const missingFamilies = requiredFamilies.filter(
  (family) => !snapshot.families.some((item) => item.code === family)
);

console.log("ERP Snapshot");
console.log(`- Source: ${snapshot.source}`);
console.log(`- Ouvrages: ${snapshot.stats?.ouvrages ?? snapshot.ouvrages.length}`);
console.log(`- Produits: ${snapshot.stats?.products ?? snapshot.products.length}`);
console.log(`- Familles: ${snapshot.stats?.families ?? snapshot.families.length}`);
console.log(`- Lignes composants: ${snapshot.stats?.componentsLines ?? "—"}`);

if (missingFamilies.length) {
  console.error(`Familles attendues absentes: ${missingFamilies.join(", ")}`);
  process.exit(1);
}

console.log("✅ Familles clés présentes:", requiredFamilies.join(", "));
