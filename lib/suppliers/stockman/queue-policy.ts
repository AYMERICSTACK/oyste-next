export type StockmanBranchSchedule = {
  branchKey: string | null;
  priority: number;
  lastProcessedAt: number | null;
};

/** Breadth first, then least recently processed branch. State comes from SQL,
 * so fairness survives process restarts and is not limited to the first 100 URLs.
 */
export function chooseStockmanBranch(branches: StockmanBranchSchedule[]) {
  return [...branches].sort((left, right) =>
    left.priority - right.priority
    || (left.lastProcessedAt ?? -1) - (right.lastProcessedAt ?? -1)
    || (left.branchKey ?? "").localeCompare(right.branchKey ?? "", "en"),
  )[0];
}

export type StockmanCrawlBacklog = {
  browsePending: number;
  productsPending: number;
};

export type StockmanCrawlNodeType = "BROWSE" | "PRODUCT";

export function hasStockmanCrawlWork(backlog: StockmanCrawlBacklog) {
  return backlog.browsePending > 0 || backlog.productsPending > 0;
}

export function unprocessedStockmanClaimIds(claimedIds: string[], processedIds: ReadonlySet<string>) {
  return claimedIds.filter((id) => !processedIds.has(id));
}

/**
 * Durable crawl scheduling policy.
 *
 * PRODUCT gets two slots out of three while both queues contain work, so a
 * large family backlog starts being parsed immediately. BROWSE keeps one
 * guaranteed slot, which prevents starvation and preserves the strict proof
 * of catalogue coverage. The function is pure and deterministic; after an
 * interruption the persisted queue counts are enough to produce a safe plan.
 */
export function planStockmanCrawlBatch(
  backlog: StockmanCrawlBacklog,
  capacity = 3,
): StockmanCrawlNodeType[] {
  const plan: StockmanCrawlNodeType[] = [];
  let browse = Math.max(0, Math.floor(backlog.browsePending));
  let products = Math.max(0, Math.floor(backlog.productsPending));
  const max = Math.max(0, Math.floor(capacity));

  while (plan.length < max && (browse > 0 || products > 0)) {
    const slot = plan.length % 3;
    const preferred: StockmanCrawlNodeType = slot === 2 ? "BROWSE" : "PRODUCT";
    if (preferred === "PRODUCT" && products > 0) {
      plan.push("PRODUCT");
      products -= 1;
      continue;
    }
    if (preferred === "BROWSE" && browse > 0) {
      plan.push("BROWSE");
      browse -= 1;
      continue;
    }
    if (products > 0) {
      plan.push("PRODUCT");
      products -= 1;
    } else {
      plan.push("BROWSE");
      browse -= 1;
    }
  }

  return plan;
}
