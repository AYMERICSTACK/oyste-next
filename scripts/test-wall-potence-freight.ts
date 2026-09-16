import assert from "node:assert/strict";
import { calculateWallPotenceFreight } from "../lib/shipping/wall-potence-freight";

const pmiMessenger = calculateWallPotenceFreight({
  family: "PMI",
  capacityKg: 1000,
  spanM: 2,
  postcode: "13050",
});
assert.equal(pmiMessenger.mode, "messagerie");
assert.equal(pmiMessenger.weightKg, 124);
assert.equal(pmiMessenger.amountHT !== null, true);

const pmtMessenger = calculateWallPotenceFreight({
  family: "PMT",
  capacityKg: 500,
  spanM: 2,
  postcode: "13050",
});
assert.equal(pmtMessenger.mode, "messagerie");
assert.equal(pmtMessenger.weightKg, 81);
assert.equal(pmtMessenger.amountHT !== null, true);

const heavyPmi = calculateWallPotenceFreight({
  family: "PMI",
  capacityKg: 1600,
  spanM: 2,
  postcode: "69001",
});
assert.equal(heavyPmi.mode, "affretement");
assert.equal(heavyPmi.rateCode, "P690");

const longPmt = calculateWallPotenceFreight({
  family: "PMT",
  capacityKg: 250,
  spanM: 3,
  postcode: "34000",
});
assert.equal(longPmt.mode, "affretement");
assert.equal(longPmt.rateCode, "P340");

console.log("Wall potence freight calculations: OK");
