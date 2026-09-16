import { calculatePftFreight } from "../lib/shipping/pft-freight";

function check(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} !== ${String(expected)}`);
  }
}

const pft1000 = calculatePftFreight({
  capacityKg: 1000,
  spanM: 5,
  hsfM: 3,
  fixing: "CHEMICAL",
  postcode: "13001",
});
check(pft1000.coefficient, 3.216, "PFT1000 coefficient");
check(pft1000.rateCode, "P135", "PFT1000 rate");
check(pft1000.amountHT, 643.79, "PFT1000 price");

const pft250 = calculatePftFreight({
  capacityKg: 250,
  spanM: 3,
  hsfM: 3,
  fixing: "STANDARD",
  postcode: "13050",
});
check(pft250.coefficient, 0.76, "PFT250 coefficient");
check(pft250.amountHT, 349.47, "PFT250 price");

console.log("PFT freight calculations: OK");
