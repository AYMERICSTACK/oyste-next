import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { maintainStockman, maintenanceRequest } from "@/lib/suppliers/stockman/global-import/maintenance";
import { resolutionFailure } from "@/lib/suppliers/stockman/global-import/runtime-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return response({ code: "UNAUTHENTICATED" }, 401);
    if (admin.role !== "SUPER_ADMIN") return response({ code: "FORBIDDEN" }, 403);
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return response({ code: "ORIGIN_FORBIDDEN" }, 403);
    }
    const parsed = maintenanceRequest.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return response({ code: "INVALID_MAINTENANCE_REQUEST" }, 400);
    return response(await maintainStockman(parsed.data, admin.id));
  } catch (error) {
    const { status, ...body } = resolutionFailure(error);
    return response(body, status);
  }
}
