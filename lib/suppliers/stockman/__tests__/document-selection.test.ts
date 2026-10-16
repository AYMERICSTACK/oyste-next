import assert from "node:assert/strict";
import test from "node:test";
import { selectStockmanDocumentsToAdd } from "../document-selection";

test("AC20 LONG : conserve la fiche française et ignore son équivalent anglais", () => {
  const existing = [
    {
      name: "Fiche technique STOCKMAN AC20 LONG (français)",
      type: "TECHNICAL_SHEET",
      url: "https://www.stockman.fr/upload/products_data/files/AC20-LONG_DS_MA_FR_1.pdf?langue=FR&src=int",
    },
  ];

  const incoming = [
    {
      name: "Technical sheet AC20 LONG",
      type: "TECHNICAL_SHEET",
      url: "https://www.stockman.fr/en/upload/products_data/files/AC20-LONG_DS_MA_EN_1.pdf",
    },
  ];

  const selected = selectStockmanDocumentsToAdd(existing, incoming);

  assert.deepEqual(selected, []);
});

test("ajoute un document distinct sans modifier les documents existants", () => {
  const existing = [
    {
      name: "Fiche technique STOCKMAN AC20 LONG (français)",
      type: "TECHNICAL_SHEET",
      url: "https://www.stockman.fr/upload/products_data/files/AC20-LONG_DS_MA_FR_1.pdf",
    },
  ];

  const incoming = [
    {
      name: "Notice d'utilisation AC20 LONG",
      type: "INSTALLATION_MANUAL",
      url: "https://www.stockman.fr/upload/products_data/files/AC20-LONG_NOTICE_FR.pdf",
    },
  ];

  const selected = selectStockmanDocumentsToAdd(existing, incoming);

  assert.deepEqual(selected, incoming);
  assert.equal(existing.length, 1);
});

test("ignore une URL déjà présente", () => {
  const document = {
    name: "Fiche technique AC20 LONG",
    type: "TECHNICAL_SHEET",
    url: "https://www.stockman.fr/upload/products_data/files/AC20-LONG_DS_MA_FR_1.pdf",
  };

  assert.deepEqual(
    selectStockmanDocumentsToAdd([document], [document]),
    [],
  );
});

test("ne confond pas deux types de documents", () => {
  const url = "https://www.stockman.fr/upload/products_data/files/AC20-LONG_DS_MA_FR_1.pdf";

  const existing = [{
    name: "Fiche technique",
    type: "TECHNICAL_SHEET",
    url,
  }];

  const incoming = [{
    name: "Notice",
    type: "INSTALLATION_MANUAL",
    url: url.replace("_FR_1.pdf", "_EN_1.pdf"),
  }];

  assert.deepEqual(
    selectStockmanDocumentsToAdd(existing, incoming),
    incoming,
  );
});

test("ne modifie pas les tableaux recus", () => {
  const existing = Object.freeze([Object.freeze({
    name: "Fiche française",
    type: "TECHNICAL_SHEET",
    url: "https://www.stockman.fr/files/AC20-LONG_FR.pdf",
  })]);

  const incoming = Object.freeze([Object.freeze({
    name: "Notice",
    type: "INSTALLATION_MANUAL",
    url: "https://www.stockman.fr/files/AC20-LONG_NOTICE_FR.pdf",
  })]);

  assert.deepEqual(
    selectStockmanDocumentsToAdd(existing, incoming),
    [...incoming],
  );
});

test("ne supprime pas deux documents de produits differents", () => {
  const existing = [{
    name: "Fiche AC20 LONG",
    type: "TECHNICAL_SHEET",
    url: "https://www.stockman.fr/files/AC20-LONG_DS_MA_FR_1.pdf",
  }];

  const incoming = [{
    name: "Fiche AC25 LONG",
    type: "TECHNICAL_SHEET",
    url: "https://www.stockman.fr/files/AC25-LONG_DS_MA_EN_1.pdf",
  }];

  assert.deepEqual(
    selectStockmanDocumentsToAdd(existing, incoming),
    incoming,
  );
});

test("privilegie le francais lorsque les deux langues arrivent ensemble", () => {
  const english = {
    name: "Technical sheet AC20 LONG",
    type: "TECHNICAL_SHEET",
    url: "https://www.stockman.fr/en/upload/products_data/files/AC20-LONG_DS_MA_EN_1.pdf",
  };

  const french = {
    name: "Fiche technique AC20 LONG",
    type: "TECHNICAL_SHEET",
    url: "https://www.stockman.fr/upload/products_data/files/AC20-LONG_DS_MA_FR_1.pdf?langue=FR&src=int",
  };

  assert.deepEqual(
    selectStockmanDocumentsToAdd([], [english, french]),
    [french],
  );
});
