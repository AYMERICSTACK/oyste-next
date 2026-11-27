import { z } from "zod";
import type { Group } from "./planner";

export type ApprovedStockmanSelection = ReadonlyArray<{
  parent: string;
  categoryId: string;
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
    if (candidate?.categoryId === row.categoryId && candidate.products.length === references.size && candidate.products.every(product => references.has(product.reference))) {
      accepted.push(candidate);
    } else {
      unavailable.push(row.parent);
    }
  }
  return { accepted, unavailable };
}

const approvalSchema = z.array(z.object({
  parent: z.string().trim().min(1).max(80),
  categoryId: z.string().trim().min(1).max(80),
  references: z.array(z.string().trim().min(1).max(80)).min(1).max(200),
}).strict()).min(1).max(100);

export function configuredStockmanSelection(): ApprovedStockmanSelection {
  const value = process.env.STOCKMAN_COLLECTIVE_APPROVED_SELECTION;
  if (!value) return [];
  try {
    const result = approvalSchema.safeParse(JSON.parse(value));
    if (!result.success) return [];
    const rows = result.data;
    const references = rows.flatMap(row => row.references);
    if (new Set(rows.map(row => row.parent)).size !== rows.length ||
        new Set(references).size !== references.length ||
        rows.some(row => row.parent !== row.parent.toUpperCase()) ||
        references.some(reference => reference !== reference.toUpperCase())) return [];
    return rows;
  } catch {
    return [];
  }
}
