import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeStockmanUrl, stockmanQueueIdentity, stockmanTaxonomyIdentity } from "../url";

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

test("tracking supprimé mais langue EN et paramètres fonctionnels préservés", () => {
  assert.equal(canonicalizeStockmanUrl("/fr/overview.aspx?langue=EN&utm_source=email&page=2#x"), "https://www.stockman.fr/overview.aspx?langue=EN&page=2");
  assert.notEqual(stockmanQueueIdentity("https://www.stockman.fr/en/a--19.aspx"), stockmanQueueIdentity("https://www.stockman.fr/a--19.aspx"));
});
test("candidats alias partagent l'id mais leurs contenus ne sont pas présumés équivalents", () => {
  assert.equal(stockmanTaxonomyIdentity("https://www.stockman.fr/a--19.aspx"), stockmanTaxonomyIdentity("https://www.stockman.fr/path--7/a--19.aspx"));
  assert.notEqual(stockmanQueueIdentity("https://www.stockman.fr/a--19.aspx"), stockmanQueueIdentity("https://www.stockman.fr/path--7/a--19.aspx"));
  assert.notEqual(stockmanQueueIdentity("https://www.stockman.fr/a--19.aspx?page=1"), stockmanQueueIdentity("https://www.stockman.fr/a--19.aspx?page=2"));
  assert.notEqual(stockmanQueueIdentity("https://www.stockman.fr/a--19/item--CL.aspx"), stockmanQueueIdentity("https://www.stockman.fr/b--20/item--CL.aspx"));
});

test("une sélection FR sur une route EN reste un paramètre potentiellement fonctionnel", () => {
  assert.equal(canonicalizeStockmanUrl("/en/products.aspx?langue=FR"), "https://www.stockman.fr/en/products.aspx?langue=FR");
});
