import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ImportCandidate = {
  reference: string;
  sourceUrl: string;
};

type Approval = {
  reference: string;
  sourceUrl: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
};

type ApprovalManifest = {
  version: 1;
  approvals: Approval[];
};

/**
 * Fail closed: no manifest, invalid manifest, expired approval,
 * or unmatched reference/URL => preparation denied.
 *
 * This only authorizes draft preparation. It does not authorize
 * product creation or publication.
 */
export function stockmanImportPreparationEnabled(
  items: ImportCandidate[] = [],
): boolean {
  if (items.length === 0 || items.length > 100) return false;

  const filePath = resolve(
    process.cwd(),
    ".stockman-private",
    "import-approvals.json",
  );

  let manifest: ApprovalManifest;

  try {
    manifest = JSON.parse(
      readFileSync(filePath, "utf8"),
    ) as ApprovalManifest;
  } catch {
    return false;
  }

  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.approvals)
  ) {
    return false;
  }

  const now = Date.now();
  const approved = new Map<string, Approval>();

  for (const approval of manifest.approvals) {
    if (
      typeof approval?.reference !== "string" ||
      typeof approval?.sourceUrl !== "string" ||
      typeof approval?.approvedBy !== "string" ||
      typeof approval?.approvedAt !== "string" ||
      typeof approval?.expiresAt !== "string"
    ) {
      return false;
    }

    const reference = approval.reference.trim().toUpperCase();
    const approvedAt = Date.parse(approval.approvedAt);
    const expiresAt = Date.parse(approval.expiresAt);

    if (
      !reference ||
      !approval.approvedBy.trim() ||
      !Number.isFinite(approvedAt) ||
      !Number.isFinite(expiresAt) ||
      approvedAt > now ||
      expiresAt <= now ||
      expiresAt <= approvedAt ||
      approved.has(reference)
    ) {
      return false;
    }

    approved.set(reference, approval);
  }

  const seen = new Set<string>();

  for (const item of items) {
    const reference = item.reference.trim().toUpperCase();
    const approval = approved.get(reference);

    if (
      !approval ||
      seen.has(reference) ||
      approval.sourceUrl !== item.sourceUrl
    ) {
      return false;
    }

    seen.add(reference);
  }

  return true;
}