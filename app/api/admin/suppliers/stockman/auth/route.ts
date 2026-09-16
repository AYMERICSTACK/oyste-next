import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import {
  cancelInteractiveStockmanLogin,
  confirmInteractiveStockmanLogin,
  inspectSavedStockmanSession,
  startInteractiveStockmanLogin,
} from "@/lib/suppliers/stockman/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("confirm"), jobId: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), jobId: z.string().uuid() }),
]);

async function authorize(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  if (write && admin.role === "READ_ONLY") {
    return NextResponse.json({ message: "Votre rôle ne permet pas de modifier la connexion Stockman." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await authorize(false);
  if (denied) return denied;

  const status = await inspectSavedStockmanSession();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Action de reconnexion Stockman invalide." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "start") {
      return NextResponse.json(await startInteractiveStockmanLogin());
    }
    if (parsed.data.action === "confirm") {
      return NextResponse.json(await confirmInteractiveStockmanLogin(parsed.data.jobId));
    }

    await cancelInteractiveStockmanLogin(parsed.data.jobId);
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La reconnexion Stockman a échoué.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
