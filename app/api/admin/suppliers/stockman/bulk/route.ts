import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getStockmanProducts } from "@/lib/suppliers/stockman/client";
import { listStockmanBulkTargets, syncStockmanProduct } from "@/lib/suppliers/stockman/sync";
import type { StockmanBulkDashboard, StockmanBulkItemResult, StockmanBulkTarget } from "@/lib/suppliers/stockman/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fieldSchema = z.enum(["price", "stock", "weight"]);
const targetSchema = z.object({
  targetType: z.enum(["product", "variant"]),
  targetId: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().min(1),
  reference: z.string().min(2).max(31),
  sourceUrl: z.string().url(),
  syncedAt: z.string().nullable(),
});
const postSchema = z.object({
  fields: z.array(fieldSchema).min(1),
  targets: z.array(targetSchema).min(1).max(5),
});

async function authorized(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return { error: NextResponse.json({ message: "Non autorisé." }, { status: 401 }) };
  if (write && admin.role === "READ_ONLY") return { error: NextResponse.json({ message: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 }) };
  return { admin };
}

export async function GET() {
  const auth = await authorized();
  if ("error" in auth) return auth.error;

  const targets = await listStockmanBulkTargets();
  const staleBefore = Date.now() - 7 * 24 * 60 * 60 * 1_000;
  const synchronizedTargets = targets.filter((target) => Boolean(target.syncedAt));
  const syncDates = synchronizedTargets
    .map((target) => target.syncedAt ? Date.parse(target.syncedAt) : Number.NaN)
    .filter((value) => Number.isFinite(value));

  const dashboard: StockmanBulkDashboard = {
    linked: targets.length,
    synchronized: synchronizedTargets.length,
    neverSynchronized: targets.length - synchronizedTargets.length,
    stale: synchronizedTargets.filter((target) => {
      const timestamp = target.syncedAt ? Date.parse(target.syncedAt) : Number.NaN;
      return Number.isFinite(timestamp) && timestamp < staleBefore;
    }).length,
    latestSyncAt: syncDates.length ? new Date(Math.max(...syncDates)).toISOString() : null,
  };

  return NextResponse.json({ targets, dashboard }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const auth = await authorized(true);
  if ("error" in auth) return auth.error;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Le lot de synchronisation est invalide." }, { status: 400 });

  const availableTargets = await listStockmanBulkTargets();
  const availableByKey = new Map(availableTargets.map((target) => [`${target.targetType}:${target.targetId}`, target]));
  const targets = parsed.data.targets.map((requested) => availableByKey.get(`${requested.targetType}:${requested.targetId}`)).filter((target): target is StockmanBulkTarget => Boolean(target));
  if (targets.length !== parsed.data.targets.length) {
    return NextResponse.json({ message: "Une ou plusieurs références ne sont plus liées à Stockman. Actualisez la liste." }, { status: 409 });
  }

  const reads = await getStockmanProducts(targets.map((target) => ({
    reference: target.reference,
    productUrl: target.sourceUrl,
  })));

  const results: StockmanBulkItemResult[] = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const read = reads[index];
    if (!read.product) {
      results.push({ target, status: "error", changedFields: [], message: read.error ?? "Lecture Stockman impossible." });
      continue;
    }
    try {
      const sync = await syncStockmanProduct(read.product, target, parsed.data.fields);
      results.push({ target: { ...target, syncedAt: sync.syncedAt }, status: sync.status, changedFields: sync.changedFields, sync });
    } catch (error) {
      results.push({ target, status: "error", changedFields: [], message: error instanceof Error ? error.message : "Synchronisation impossible." });
    }
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
