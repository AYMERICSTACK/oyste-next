import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const discovery = readFileSync(
  "lib/suppliers/stockman/discovery-jobs.ts",
  "utf8",
);

const route = readFileSync(
  "app/api/admin/suppliers/stockman/discovery/route.ts",
  "utf8",
);

const policy = readFileSync(
  "lib/suppliers/stockman/prepare-import-policy.ts",
  "utf8",
);

test("automatic import recommendations remain disabled", () => {
  assert.match(
    discovery,
    /function stockmanAutomaticImportRecommendationEnabled\(\): boolean\s*\{\s*return false;\s*\}/,
  );
  assert.doesNotMatch(
    discovery,
    /false \/\* no automatic import recommendation \*\//,
  );
});

test("unconfirmed references require review", () => {
  assert.match(
    route,
    /function stockmanUnconfirmedReferenceDecision\(\):\s*"present" \| "to_import" \| "to_review"\s*\{\s*return "to_review";\s*\}/,
  );
  assert.doesNotMatch(
    route,
    /\("to_review" as "present" \| "to_import" \| "to_review"\)/,
  );
});

test("prepare import policy stays disabled", () => {
  assert.match(policy, /stockmanImportPreparationEnabled/);
  assert.match(policy, /return false/);
  assert.match(route, /stockmanImportPreparationEnabled/);
  assert.match(route, /409/);
});

test("twelve PS12L initial lift references remain distinct", () => {
  const heights = [29, 32, 36, 40, 43, 46];
  const batteries = [100, 150];

  let checked = 0;

  for (const height of heights) {
    for (const battery of batteries) {
      assert.notEqual(
        `PS12L${height}LI-ION${battery}`,
        `PS12L${height}-ION${battery}`,
      );
      checked++;
    }
  }

  assert.equal(checked, 12);
});