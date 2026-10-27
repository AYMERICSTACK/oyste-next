import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stockmanImportPreparationEnabled } from "../prepare-import-policy";

describe("STOCKMAN - politique prepare_import", () => {
  it("suspend toute preparation sans approbation metier", () => {
    assert.equal(stockmanImportPreparationEnabled(), false);
  });

  it("verifie que la route applique la politique avant l'upsert", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/admin/suppliers/stockman/discovery/route.ts"),
      "utf8",
    );

    const policyCall = source.indexOf("if (!stockmanImportPreparationEnabled())");
    const supplierLookup = source.indexOf("const supplier = await prisma.supplier.findFirst", policyCall);
    const draftWrite = source.indexOf("prisma.stockmanImportDraft.upsert", policyCall);

    assert.ok(policyCall >= 0);
    assert.ok(supplierLookup > policyCall);
    assert.ok(draftWrite > supplierLookup);
    assert.match(
      source.slice(policyCall, supplierLookup),
      /status:\s*409/,
    );
  });

  it("ne confond pas les references PS12L avec et sans levee initiale", () => {
    const withInitialLift = "PS12L29LI-ION100";
    const withoutInitialLift = "PS12L29-ION100";

    assert.notEqual(withInitialLift, withoutInitialLift);
    assert.equal(stockmanImportPreparationEnabled(), false);
  });
});