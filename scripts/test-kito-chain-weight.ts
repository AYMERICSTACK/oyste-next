import { calculateKitoDynamicWeightKg, getKitoChainWeightRule } from "../lib/shipping/kito-chain-weight";

type TestCase = {
  code: string;
  baseWeightKg: number;
  liftM: number;
  expectedWeightKg: number;
};

const tests: TestCase[] = [
  { code: "CB005", baseWeightKg: 10, liftM: 5, expectedWeightKg: 13 },
  { code: "CX010", baseWeightKg: 7.3, liftM: 5, expectedWeightKg: 10.9 },
  { code: "ER2016IS", baseWeightKg: 72, liftM: 5, expectedWeightKg: 76.6 },
  { code: "ER2M032ISS", baseWeightKg: 0, liftM: 5, expectedWeightKg: 0 },
  { code: "LB008HL15", baseWeightKg: 5.7, liftM: 3, expectedWeightKg: 6.75 },
  { code: "LB008HL30", baseWeightKg: 6.75, liftM: 3, expectedWeightKg: 6.75 },
  { code: "LX005HL15", baseWeightKg: 2.7, liftM: 3, expectedWeightKg: 3.3 },
  { code: "TSP500A", baseWeightKg: 5.1, liftM: 5, expectedWeightKg: 5.1 },
];

let failures = 0;
console.log("OYSTE — Test KITO poids chaîne dynamique\n");

for (const test of tests) {
  const actual = calculateKitoDynamicWeightKg({
    supplier: "KITO",
    code: test.code,
    baseWeightKg: test.baseWeightKg || undefined,
    technicalLines: [{ label: "Hauteur de levage", value: `${test.liftM} m` }],
  });
  const ok = Math.abs(Number(actual || 0) - test.expectedWeightKg) < 0.0001;
  console.log(`${ok ? "✓" : "✗"} ${test.code}: ${actual ?? "vide"} kg (attendu ${test.expectedWeightKg} kg)`);
  if (!ok) failures += 1;
}

const supported = ["CB005", "CX010", "ER2016IS", "ER2M016ISS", "ER2SG032IS", "ER2SP050S", "LB090HL30", "LX003HL15"];
console.log("\nRègles catalogue détectées:");
for (const code of supported) {
  const rule = getKitoChainWeightRule(code);
  console.log(`- ${code}: base=${rule?.baseLiftM ?? "-"} m · +${rule?.additionalWeightPerMeterKg ?? "-"} kg/m`);
}

if (failures) {
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log("\nTous les tests sont OK.");
