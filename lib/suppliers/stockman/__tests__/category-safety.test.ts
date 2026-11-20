import assert from "node:assert/strict";
import test from "node:test";
import { stockmanCategorySemanticVeto, stockmanDesignationKind } from "../category-safety";

const diable = "Manutention au sol\\Diable";
const alu = `${diable}\\Diable aluminium et inox`;

test("une sangle, roue, extension ou vérin pour diable ne devient pas un diable autonome", () => {
  for (const name of [
    "Sangle de sécurité pour DMEG", "Roue de support 500x100x255 mm 170 kg",
    "Extension de châssis 340x40x611,5 mm", "Vérins électriques pour diables électriques gamme CT 420 kg",
    "Porte-bouteilles double - diamètre 50 à 300 mm",
  ]) {
    assert.equal(stockmanDesignationKind(name), "accessory", name);
    assert.ok(stockmanCategorySemanticVeto(name, diable), name);
  }
});

test("une échelle, un châssis roulant ou un manipulateur réclame une catégorie propre", () => {
  for (const name of [
    "Echelle réglable 3 marches 250 kg", "Châssis roulant 170 kg pour DMEG",
    "Manipulateur de portes 712x407x1698 mm",
  ]) {
    assert.equal(stockmanDesignationKind(name), "review", name);
    assert.ok(stockmanCategorySemanticVeto(name, diable), name);
  }
});

test("un diable acier ne peut être classé aluminium/inox", () => {
  assert.match(stockmanCategorySemanticVeto("Diable acier charge lourde 400 kg", alu) || "", /acier/);
});

test("un diable jumelé sans matière confirmée ne devient pas aluminium/inox", () => {
  assert.ok(stockmanCategorySemanticVeto("Diable jumelé lève-charge encombrante 1800 kg", alu));
});

test("un vrai diable et un tracteur ne sont pas bloqués par la règle", () => {
  assert.equal(stockmanCategorySemanticVeto("Diable monte-escaliers électrique aluminium 310 kg", diable), null);
  assert.equal(stockmanCategorySemanticVeto("Diable aluminium charge 150 kg", alu), null);
  assert.equal(stockmanCategorySemanticVeto("Tracteur tireur pousseur électrique 1000 kg", "Manutention au sol\\Tireur pousseur"), null);
});
