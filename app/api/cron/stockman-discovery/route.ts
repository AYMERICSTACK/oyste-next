import { applyNextScheduledStockmanSync } from "@/lib/suppliers/stockman/scheduled-commercial-sync";
import { startDueStockmanCommercialRead } from "@/lib/suppliers/stockman/scheduled-commercial-read";
import { NextResponse } from "next/server";
import { runStockmanDiscoveryWorkCycle } from "@/lib/suppliers/stockman/discovery-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (process.env.OYSTE_STOCKMAN_TEST === "true") return new Response(null, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET non configuré." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  const batches = await runStockmanDiscoveryWorkCycle();
  const appliedCommercialSync = batches === 0 && await applyNextScheduledStockmanSync();
  const scheduledCommercialRead = batches === 0 && !appliedCommercialSync && await startDueStockmanCommercialRead();
  return NextResponse.json({ processed: batches > 0, batches, scheduledCommercialRead, appliedCommercialSync }, { headers: { "Cache-Control": "no-store" } });
}
