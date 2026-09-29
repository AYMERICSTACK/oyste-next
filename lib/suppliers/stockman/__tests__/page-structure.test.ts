import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommercialRow,
  classifyStockmanNavigationLink,
  relationFromRelatedSection,
  type StockmanCommercialRowSnapshot,
} from "../page-structure";

function row(reference: string, overrides: Partial<StockmanCommercialRowSnapshot> = {}): StockmanCommercialRowSnapshot {
  return {
    reference,
    text: `${reference} Désignation Poids : 1 kg Prix Unitaire HT`,
    badgeTexts: [],
    sectionLabels: [],
    ancestorClass: "commercial-table",
    dataAttributes: [],
    isCommercialTable: true,
    rowIndex: 0,
    ...overrides,
  };
}

test("classe les références d'une table familiale en principale et variantes", () => {
  const context = { familyReference: "CL", breadcrumb: ["Produits", "Palans", "Pinces"] };
  assert.equal(classifyCommercialRow(row("CL"), context).relationType, "PRIMARY");
  for (const reference of ["CL05", "CL10", "CL20", "CL30"]) {
    assert.equal(classifyCommercialRow(row(reference), context).relationType, "PRIMARY_VARIANT");
  }
});

test("une fiche mono-référence conserve sa référence commerciale", () => {
  const classification = classifyCommercialRow(
    row("P476"),
    { familyReference: "P476", breadcrumb: ["Produits", "Emballage", "Outils de cerclage"] },
  );
  assert.equal(classification.relationType, "PRIMARY");
});

test("les familles multi-références restent génériques et structurelles", () => {
  const cases = [
    ["C30-Pinces", ["C3014", "C3015", "C3016"]],
    ["C50-Pinces", ["C5004", "C5005", "C5006"]],
    ["P1604-05", ["P1604", "P1605"]],
  ] as const;
  for (const [familyReference, references] of cases) {
    for (const reference of references) {
      assert.equal(
        classifyCommercialRow(row(reference), { familyReference, breadcrumb: [] }).relationType,
        "PRIMARY_VARIANT",
      );
    }
  }
});

test("un badge ACCESSOIRE prévaut sur la position et la table", () => {
  const classification = classifyCommercialRow(
    row("BAT-40", { badgeTexts: ["ACCESSOIRE"], rowIndex: 12 }),
    { familyReference: "PTE15NPRO", breadcrumb: ["Transpalettes électriques"] },
  );
  assert.equal(classification.relationType, "ACCESSORY");
  assert.equal(classification.confidence, "EXPLICIT");
});

test("une section OPTION et une branche pièces détachées sont explicites", () => {
  assert.equal(
    classifyCommercialRow(row("OPT-1", { sectionLabels: ["OPTIONS"] }), { familyReference: "FAM", breadcrumb: [] }).relationType,
    "OPTION",
  );
  assert.equal(
    classifyCommercialRow(row("PD-1"), { familyReference: "FAM", breadcrumb: ["Pièces détachées"] }).relationType,
    "SPARE_PART",
  );
});

test("une ligne sans preuve structurelle reste UNKNOWN et n'est pas supprimée", () => {
  const classification = classifyCommercialRow(
    row("X-1", { isCommercialTable: false, ancestorClass: "", dataAttributes: [] }),
    { familyReference: "FAM", breadcrumb: [] },
  );
  assert.equal(classification.relationType, "UNKNOWN");
});

test("Consultez également reste une recommandation distincte", () => {
  assert.equal(relationFromRelatedSection("Consultez également…"), "RECOMMENDED_PRODUCT");
  assert.notEqual(relationFromRelatedSection("Consultez également…"), "ACCESSORY");
});

test("la structure taxonomique classe les liens sans vocabulaire métier", () => {
  const context = {
    inCatalogueNavigation: false,
    inBreadcrumb: false,
    inProductCard: false,
    ancestorText: "",
    ancestorClass: "",
    dataAttributes: [],
  };
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/famille--15", context), "CATEGORY");
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/famille--15/enfant--67", context), "SUBCATEGORY");
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/famille--15/enfant--67/produit--CL.aspx", context), "FAMILY_PAGE");
});
