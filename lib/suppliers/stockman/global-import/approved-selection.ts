import type { Group } from "./planner";

export type ApprovedStockmanSelection = ReadonlyArray<{
  parent: string;
  references: readonly string[];
}>;

export function selectApprovedStockmanGroups(groups: readonly Group[], selection: ApprovedStockmanSelection) {
  const requestedParents = new Set(selection.map(row => row.parent));
  const requestedReferences = selection.flatMap(row => [...row.references]);
  if (!selection.length || requestedParents.size !== selection.length ||
    new Set(requestedReferences).size !== requestedReferences.length || selection.some(row => !row.references.length)) {
    throw new Error("Liste blanche STOCKMAN vide ou en doublon.");
  }

  const ready = new Map(groups.map(group => [group.key, group]));
  const accepted: Group[] = [];
  const unavailable: string[] = [];
  for (const row of selection) {
    const candidate = ready.get(row.parent);
    const references = new Set(row.references);
    if (candidate?.products.length === references.size && candidate.products.every(product => references.has(product.reference))) {
      accepted.push(candidate);
    } else {
      unavailable.push(row.parent);
    }
  }
  return { accepted, unavailable };
}
