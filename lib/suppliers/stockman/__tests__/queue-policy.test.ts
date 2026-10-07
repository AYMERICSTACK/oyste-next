import assert from "node:assert/strict";
import test from "node:test";
import { chooseStockmanBranch, hasStockmanCrawlWork, planStockmanCrawlBatch } from "../queue-policy";

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

test("les fiches PRODUCT commencent pendant que BROWSE reste pending", () => {
  assert.deepEqual(
    planStockmanCrawlBatch({ browsePending: 246, productsPending: 1_210 }),
    ["PRODUCT", "PRODUCT", "BROWSE"],
  );
});

test("la politique 2 PRODUCT / 1 BROWSE interdit la starvation du browse", () => {
  const plan = planStockmanCrawlBatch({ browsePending: 100, productsPending: 100 }, 12);
  assert.equal(plan.filter((item) => item === "PRODUCT").length, 8);
  assert.equal(plan.filter((item) => item === "BROWSE").length, 4);
  assert.deepEqual(plan.slice(0, 6), ["PRODUCT", "PRODUCT", "BROWSE", "PRODUCT", "PRODUCT", "BROWSE"]);
});

test("une queue produit ou browse épuisée laisse toute la capacité à l'autre type", () => {
  assert.deepEqual(planStockmanCrawlBatch({ browsePending: 4, productsPending: 0 }), ["BROWSE", "BROWSE", "BROWSE"]);
  assert.deepEqual(planStockmanCrawlBatch({ browsePending: 0, productsPending: 4 }), ["PRODUCT", "PRODUCT", "PRODUCT"]);
  assert.deepEqual(planStockmanCrawlBatch({ browsePending: 0, productsPending: 0 }), []);
});

test("la reprise est déterministe et ne planifie jamais plus que le backlog durable", () => {
  assert.deepEqual(planStockmanCrawlBatch({ browsePending: 1, productsPending: 1 }, 3), ["PRODUCT", "BROWSE"]);
  assert.deepEqual(planStockmanCrawlBatch({ browsePending: 1, productsPending: 2 }, 3), ["PRODUCT", "PRODUCT", "BROWSE"]);
});

test("le matching n'est autorisé qu'après épuisement des deux files de crawl", () => {
  assert.equal(hasStockmanCrawlWork({ browsePending: 1, productsPending: 0 }), true);
  assert.equal(hasStockmanCrawlWork({ browsePending: 0, productsPending: 1 }), true);
  assert.equal(hasStockmanCrawlWork({ browsePending: 0, productsPending: 0 }), false);
});
