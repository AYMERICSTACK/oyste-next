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
    isPrimaryFamilyTable: true,
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

  // Real Stockman taxonomy URLs end in `.aspx` too: the numeric suffix must
  // remain navigable instead of being consumed as a PRODUCT node.
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/transpalettes-electriques--19.aspx", context), "CATEGORY");
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/emballage--7.aspx", context), "CATEGORY");
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/transpalettes-electriques--19/transpalettes-electriques-tout-terrain--162.aspx", context), "SUBCATEGORY");
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/palans-et-accessoires-de-levage--15/pinces-de-levage--67/--1/pince-de-levage--CL.aspx", context), "FAMILY_PAGE");
});

 test("une table commerciale ambiguë ne devient pas une table de variantes", () => {
   const context = { familyReference: "FAMILY", breadcrumb: [] };
   for (const reference of ["BATTERIE", "SUPPORT", "X01"]) {
     assert.equal(classifyCommercialRow(row(reference, { isPrimaryFamilyTable: false }), context).relationType, "UNKNOWN");
   }
 });
 test("sections accessoires et recommandations prévalent sur une table principale", () => {
   const context = { familyReference: "FAMILY", breadcrumb: [] };
   assert.equal(classifyCommercialRow(row("X01", { sectionLabels: ["Accessoires"] }), context).relationType, "ACCESSORY");
   assert.equal(classifyCommercialRow(row("X01", { sectionLabels: ["Consultez également"] }), context).relationType, "RECOMMENDED_PRODUCT");
 });
 test("liens de navigation générique ne suffisent pas à inclure les routes utilitaires", () => {
   const context = { inCatalogueNavigation: true, inBreadcrumb: true, inProductCard: false, ancestorText: "", ancestorClass: "menu", dataAttributes: [] };
   assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/login.aspx", context), null);
 });

test("badge local prévaut sur une section contradictoire", () => {
  assert.equal(classifyCommercialRow(row("X01", { badgeTexts: ["Pièces détachées"], sectionLabels: ["Options"] }), { familyReference: "FAM", breadcrumb: [] }).relationType, "SPARE_PART");
});
test("PTE15NPRO conserve ses variantes prouvées, options et accessoires séparément", () => {
  const context = { familyReference: "PTE15NPRO", breadcrumb: [] };
  for (const reference of ["PTE15NPRO800", "PTE15NPRO1500", "PTE15NPRO1800", "PTE15NPRO-20AH"]) {
    assert.equal(classifyCommercialRow(row(reference), context).relationType, "PRIMARY_VARIANT");
    assert.equal(classifyCommercialRow(row(reference, { isPrimaryFamilyTable: false }), context).relationType, "UNKNOWN");
  }
  assert.equal(classifyCommercialRow(row("SUPPORT01", { badgeTexts: ["ACCESSOIRE"] }), context).relationType, "ACCESSORY");
  assert.equal(classifyCommercialRow(row("OPTION01", { sectionLabels: ["Options"] }), context).relationType, "OPTION");
});

test("les routes catalogue non standard restent explorées hors header/footer", () => {
  const context = { inCatalogueNavigation: true, inBreadcrumb: false, inProductCard: false, ancestorText: "", ancestorClass: "", dataAttributes: [] };
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/catalogue-navigation.aspx?page=2", context), "BROWSE");
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/catalogue-navigation.aspx", { ...context, inHeaderOrFooter: true }), null);
  assert.equal(classifyStockmanNavigationLink("https://www.stockman.fr/en", context), "BROWSE");
});
