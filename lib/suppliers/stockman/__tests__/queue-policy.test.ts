import assert from "node:assert/strict";
import test from "node:test";
import { chooseStockmanBranch } from "../queue-policy";

test("la queue privilégie la profondeur puis la branche la moins récemment traitée", () => {
  const branches = [
    { branchKey: "a", priority: 2, lastProcessedAt: 100 },
    { branchKey: "b", priority: 2, lastProcessedAt: null },
    { branchKey: "c", priority: 3, lastProcessedAt: null },
  ];
  assert.equal(chooseStockmanBranch(branches)?.branchKey, "b");
  branches[1].lastProcessedAt = 200;
  assert.equal(chooseStockmanBranch(branches)?.branchKey, "a");
});

test("choix déterministe indépendant de l'ordre SQL, queue épuisée naturellement", () => {
  const branches = ["z", "a"].map((branchKey) => ({ branchKey, priority: 1, lastProcessedAt: null }));
  assert.equal(chooseStockmanBranch(branches)?.branchKey, "a");
  assert.equal(chooseStockmanBranch(branches.reverse())?.branchKey, "a");
  assert.equal(chooseStockmanBranch([]), undefined);
});
