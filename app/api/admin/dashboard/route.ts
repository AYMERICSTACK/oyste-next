import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/admin/dashboard-data";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const generatedAt = new Date();
  const dashboard = await getDashboardData(generatedAt);

  return NextResponse.json(
    { dashboard, generatedAt: generatedAt.toISOString() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
