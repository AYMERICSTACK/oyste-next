import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeStockmanUrl } from "../url";

test("canonicalise les variantes de contexte vers la même ressource", () => {
  const expected = "https://www.stockman.fr/emballage--7/produit--P476.aspx";
  assert.equal(canonicalizeStockmanUrl("http://stockman.fr/fr/emballage--7/produit--P476.aspx?langue=FR#photo"), expected);
  assert.equal(canonicalizeStockmanUrl("https://www.stockman.fr/emballage--7/produit--P476.aspx?src=int"), expected);
});

test("conserve et trie pagination, recherche, filtres et paramètres inconnus", () => {
  assert.equal(
    canonicalizeStockmanUrl("/fr/overview.aspx?filter=acier&tsearch=palan&page=2&langue=FR&search=levage"),
    "https://www.stockman.fr/overview.aspx?filter=acier&page=2&search=levage&tsearch=palan",
  );
});

test("rejette les hôtes externes", () => {
  assert.equal(canonicalizeStockmanUrl("https://example.com/product.aspx"), null);
});
