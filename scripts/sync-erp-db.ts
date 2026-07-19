import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ErpImportStatus, Prisma } from "../generated/prisma/client";
import type { ErpFamily, ErpOuvrage, ErpProduct, ErpSnapshot } from "../lib/erp/types";

const BATCH_SIZE = 100;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function inBatches<T>(items: T[], worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    await Promise.all(items.slice(index, index + BATCH_SIZE).map(worker));
  }
}

function productAttributes(product: ErpProduct) {
  return {
    installation: product.installation,
    conception: product.conception,
    chargeKg: product.chargeKg,
    reachMm: product.reachMm,
    spanMm: product.spanMm,
    heightMm: product.heightMm,
    widthMm: product.widthMm,
  };
}

function ouvrageAttributes(ouvrage: ErpOuvrage) {
  return {
    installation: ouvrage.installation,
    conception: ouvrage.conception,
    chargeKg: ouvrage.chargeKg,
    reachMm: ouvrage.reachMm,
    spanMm: ouvrage.spanMm,
    heightMm: ouvrage.heightMm,
    widthMm: ouvrage.widthMm,
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL est manquante.");

  const snapshotPath = path.resolve(process.argv[2] ?? "data/erp/erp-snapshot.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as ErpSnapshot;
  const sourceHash = hash(snapshot);
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const startedAt = new Date();

  const previous = await prisma.erpImport.findFirst({
    where: { status: ErpImportStatus.COMPLETED },
    orderBy: { completedAt: "desc" },
  });

  const currentImport = await prisma.erpImport.create({
    data: {
      source: snapshot.source,
      sourceHash,
      status: previous?.sourceHash === sourceHash ? ErpImportStatus.SKIPPED : ErpImportStatus.RUNNING,
      snapshotDate: new Date(snapshot.generatedAt),
      stats: asJson(snapshot.stats),
      startedAt,
      completedAt: previous?.sourceHash === sourceHash ? new Date() : null,
      changes: previous?.sourceHash === sourceHash
        ? asJson({ reason: "Snapshot identique au dernier import", products: { created: 0, updated: 0, disabled: 0 }, ouvrages: { created: 0, updated: 0, disabled: 0 }, families: { created: 0, updated: 0, disabled: 0 } })
        : undefined,
    },
  });

  if (previous?.sourceHash === sourceHash) {
    console.log("↪️ Snapshot ERP inchangé : synchronisation ignorée.");
    await prisma.$disconnect();
    return;
  }

  try {
    const now = new Date();
    const [existingProducts, existingOuvrages, existingFamilies] = await Promise.all([
      prisma.erpProductRecord.findMany({ select: { ref: true, contentHash: true } }),
      prisma.erpOuvrageRecord.findMany({ select: { code: true, contentHash: true } }),
      prisma.erpFamilyRecord.findMany({ select: { code: true, contentHash: true } }),
    ]);

    const productMap = new Map(existingProducts.map((item) => [item.ref, item.contentHash]));
    const ouvrageMap = new Map(existingOuvrages.map((item) => [item.code, item.contentHash]));
    const familyMap = new Map(existingFamilies.map((item) => [item.code, item.contentHash]));

    const productChanges = { created: 0, updated: 0, unchanged: 0, disabled: 0 };
    const ouvrageChanges = { created: 0, updated: 0, unchanged: 0, disabled: 0 };
    const familyChanges = { created: 0, updated: 0, unchanged: 0, disabled: 0 };

    await inBatches(snapshot.products, async (product) => {
      const contentHash = hash(product);
      const previousHash = productMap.get(product.ref);
      if (!previousHash) productChanges.created += 1;
      else if (previousHash !== contentHash) productChanges.updated += 1;
      else productChanges.unchanged += 1;

      if (previousHash === contentHash) {
        await prisma.erpProductRecord.update({ where: { ref: product.ref }, data: { lastSeenAt: now, isActive: true } });
        return;
      }

      await prisma.erpProductRecord.upsert({
        where: { ref: product.ref },
        update: {
          label: product.label,
          description: product.description ?? null,
          family: product.family,
          category: product.category,
          costPrice: product.costPrice,
          attributes: asJson(productAttributes(product)),
          contentHash,
          isActive: true,
          lastSeenAt: now,
          lastImportId: currentImport.id,
        },
        create: {
          ref: product.ref,
          label: product.label,
          description: product.description ?? null,
          family: product.family,
          category: product.category,
          costPrice: product.costPrice,
          attributes: asJson(productAttributes(product)),
          contentHash,
          isActive: true,
          firstSeenAt: now,
          lastSeenAt: now,
          lastImportId: currentImport.id,
        },
      });
    });

    await inBatches(snapshot.ouvrages, async (ouvrage) => {
      const contentHash = hash(ouvrage);
      const previousHash = ouvrageMap.get(ouvrage.code);
      if (!previousHash) ouvrageChanges.created += 1;
      else if (previousHash !== contentHash) ouvrageChanges.updated += 1;
      else ouvrageChanges.unchanged += 1;

      if (previousHash === contentHash) {
        await prisma.erpOuvrageRecord.update({ where: { code: ouvrage.code }, data: { lastSeenAt: now, isActive: true } });
        return;
      }

      await prisma.erpOuvrageRecord.upsert({
        where: { code: ouvrage.code },
        update: {
          label: ouvrage.label,
          description: ouvrage.description ?? null,
          family: ouvrage.family,
          category: ouvrage.category,
          mainComponentCode: ouvrage.mainComponentCode,
          basePrice: ouvrage.basePrice,
          defaultTotal: ouvrage.defaultTotal,
          attributes: asJson(ouvrageAttributes(ouvrage)),
          components: asJson(ouvrage.components),
          contentHash,
          isActive: true,
          lastSeenAt: now,
          lastImportId: currentImport.id,
        },
        create: {
          code: ouvrage.code,
          label: ouvrage.label,
          description: ouvrage.description ?? null,
          family: ouvrage.family,
          category: ouvrage.category,
          mainComponentCode: ouvrage.mainComponentCode,
          basePrice: ouvrage.basePrice,
          defaultTotal: ouvrage.defaultTotal,
          attributes: asJson(ouvrageAttributes(ouvrage)),
          components: asJson(ouvrage.components),
          contentHash,
          isActive: true,
          firstSeenAt: now,
          lastSeenAt: now,
          lastImportId: currentImport.id,
        },
      });
    });

    await inBatches(snapshot.families, async (family: ErpFamily) => {
      const contentHash = hash(family);
      const previousHash = familyMap.get(family.code);
      if (!previousHash) familyChanges.created += 1;
      else if (previousHash !== contentHash) familyChanges.updated += 1;
      else familyChanges.unchanged += 1;

      if (previousHash === contentHash) {
        await prisma.erpFamilyRecord.update({ where: { code: family.code }, data: { lastSeenAt: now, isActive: true } });
        return;
      }

      await prisma.erpFamilyRecord.upsert({
        where: { code: family.code },
        update: {
          label: family.label,
          category: family.category,
          ouvragesCount: family.ouvragesCount,
          productsCount: family.productsCount,
          samples: asJson(family.samples),
          contentHash,
          isActive: true,
          lastSeenAt: now,
          lastImportId: currentImport.id,
        },
        create: {
          code: family.code,
          label: family.label,
          category: family.category,
          ouvragesCount: family.ouvragesCount,
          productsCount: family.productsCount,
          samples: asJson(family.samples),
          contentHash,
          isActive: true,
          firstSeenAt: now,
          lastSeenAt: now,
          lastImportId: currentImport.id,
        },
      });
    });

    const productRefs = snapshot.products.map((item) => item.ref);
    const ouvrageCodes = snapshot.ouvrages.map((item) => item.code);
    const familyCodes = snapshot.families.map((item) => item.code);

    const [disabledProducts, disabledOuvrages, disabledFamilies] = await Promise.all([
      prisma.erpProductRecord.updateMany({ where: { isActive: true, ref: { notIn: productRefs } }, data: { isActive: false, lastImportId: currentImport.id } }),
      prisma.erpOuvrageRecord.updateMany({ where: { isActive: true, code: { notIn: ouvrageCodes } }, data: { isActive: false, lastImportId: currentImport.id } }),
      prisma.erpFamilyRecord.updateMany({ where: { isActive: true, code: { notIn: familyCodes } }, data: { isActive: false, lastImportId: currentImport.id } }),
    ]);

    productChanges.disabled = disabledProducts.count;
    ouvrageChanges.disabled = disabledOuvrages.count;
    familyChanges.disabled = disabledFamilies.count;

    const changes = { products: productChanges, ouvrages: ouvrageChanges, families: familyChanges };
    await prisma.erpImport.update({
      where: { id: currentImport.id },
      data: { status: ErpImportStatus.COMPLETED, completedAt: new Date(), changes: asJson(changes) },
    });

    console.log("✅ Synchronisation ERP → PostgreSQL terminée");
    console.log(JSON.stringify(changes, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.erpImport.update({
      where: { id: currentImport.id },
      data: { status: ErpImportStatus.FAILED, completedAt: new Date(), errorMessage: message },
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌ Synchronisation ERP échouée");
  console.error(error);
  process.exit(1);
});
