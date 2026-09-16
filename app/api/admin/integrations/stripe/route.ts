import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { testStripeConnection } from "@/lib/integrations/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const status = await testStripeConnection();

  return NextResponse.json(
    { status },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
