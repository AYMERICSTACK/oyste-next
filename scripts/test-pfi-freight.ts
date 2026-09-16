import { calculatePfiFreight } from "../lib/shipping/pfi-freight";
function check(actual: unknown, expected: unknown, label: string) { if (actual !== expected) throw new Error(`${label}: ${String(actual)} !== ${String(expected)}`); }
const pfi1000 = calculatePfiFreight({ capacityKg: 1000, spanM: 5, hsfM: 3, fixing: "CHEMICAL", postcode: "13001" });
check(pfi1000.coefficient, 3.216, "PFI1000 coefficient"); check(pfi1000.rateCode, "P135", "PFI1000 rate"); check(pfi1000.amountHT, 643.79, "PFI1000 price");
const pfi150 = calculatePfiFreight({ capacityKg: 150, spanM: 2, hsfM: 5, fixing: "STANDARD", postcode: "01000" });
check(pfi150.coefficient, 1.052, "PFI150 coefficient"); check(pfi150.rateCode, "P011", "PFI150 rate"); check(pfi150.amountHT, 262.91, "PFI150 price");
const pfi500 = calculatePfiFreight({ capacityKg: 500, spanM: 3, hsfM: 4, fixing: "CHEMICAL", postcode: "13001" });
check(pfi500.coefficient, 1.728, "PFI500 coefficient"); check(pfi500.rateCode, "P132", "PFI500 rate"); check(pfi500.amountHT, 520.41, "PFI500 price");
console.log("PFI freight calculations: OK");
