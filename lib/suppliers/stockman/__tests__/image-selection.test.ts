import assert from "node:assert/strict";
import test from "node:test";
import { selectStockmanImagesToAdd } from "../image-selection";

const firstPhoto = {
  url: "https://www.stockman.fr/en/upload/products_data/images/medium/transpalette-manuel-long-2000kg-1500mm-540mm-AC20.jpg",
  altText: "Transpalette AC20 LONG, fourches 1500 mm",
  isPrimary: true,
  sortOrder: 0,
};

const secondPhoto = {
  url: "https://www.stockman.fr/en/upload/products_data/images/medium/transpalette-manuel-long-2000kg-1800mm-540mm-AC20.jpg",
  altText: "Transpalette AC20 LONG, fourches 1800 mm",
  isPrimary: false,
  sortOrder: 1,
};

test("AC20 LONG : conserve ses deux photos existantes", () => {
  const existing = [firstPhoto, secondPhoto];

  const incoming = [
    { url: secondPhoto.url, altText: "Texte fournisseur" },
    { url: firstPhoto.url, altText: "Autre texte fournisseur" },
  ];

  assert.deepEqual(selectStockmanImagesToAdd(existing, incoming), []);
  assert.equal(existing[0].isPrimary, true);
  assert.equal(existing[0].sortOrder, 0);
  assert.equal(existing[1].sortOrder, 1);
});

test("ignore les doublons exacts", () => {
  const incoming = [
    { url: firstPhoto.url, altText: null },
    { url: firstPhoto.url, altText: "Doublon" },
  ];

  const selected = selectStockmanImagesToAdd([], incoming);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].url, firstPhoto.url);
});

test("ajoute une nouvelle photo apres les photos existantes", () => {
  const newPhoto = {
    url: "https://www.stockman.fr/upload/products_data/images/medium/AC20-LONG-DETAIL.jpg",
    altText: "Detail AC20 LONG",
  };

  const selected = selectStockmanImagesToAdd(
    [firstPhoto, secondPhoto],
    [newPhoto],
  );

  assert.deepEqual(selected, [{
    ...newPhoto,
    isPrimary: false,
    sortOrder: 2,
  }]);
});

test("premiere photo principale si la galerie est vide", () => {
  const incoming = [
    { url: firstPhoto.url, altText: firstPhoto.altText },
    { url: secondPhoto.url, altText: secondPhoto.altText },
  ];

  assert.deepEqual(selectStockmanImagesToAdd([], incoming), [
    { ...incoming[0], isPrimary: true, sortOrder: 0 },
    { ...incoming[1], isPrimary: false, sortOrder: 1 },
  ]);
});
