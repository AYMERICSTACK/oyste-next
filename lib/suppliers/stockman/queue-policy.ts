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
