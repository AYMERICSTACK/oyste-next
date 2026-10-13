import assert from "node:assert/strict";
import test from "node:test";
import { referenceFromProductUrl } from "../catalog-scanner";

test("AC20 LONG est reconnu comme identifiant familial", () => {
  const url =
    "https://www.stockman.fr/transpalettes--17/transpalettes-manuels-courts-et-longs--111/--1/transpalette-manuel-long-2000-kg--AC20%20LONG.aspx";

  assert.equal(referenceFromProductUrl(url), "AC20 LONG");
});

test("une référence commerciale simple reste reconnue", () => {
  const url = "https://www.stockman.fr/produit--AC201500.aspx";

  assert.equal(referenceFromProductUrl(url), "AC201500");
});

test("une URL sans référence commerciale ou familiale est rejetée", () => {
  const url = "https://www.stockman.fr/catalogue.aspx";

  assert.equal(referenceFromProductUrl(url), null);
});
