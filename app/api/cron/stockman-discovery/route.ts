import { NextResponse } from "next/server";
import { runStockmanDiscoveryWorkCycle } from "@/lib/suppliers/stockman/discovery-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET non configuré." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  const batches = await runStockmanDiscoveryWorkCycle();
  return NextResponse.json({ processed: batches > 0, batches }, { headers: { "Cache-Control": "no-store" } });
}
