import { NextResponse } from "next/server";
import { getKitoChainPricingRule } from "@/lib/pricing/kito-chain-price";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").trim();

  if (!code || code.length > 120) {
    return NextResponse.json({ message: "Référence KITO invalide." }, { status: 400 });
  }

  const rule = await getKitoChainPricingRule(code);
  if (!rule) {
    return NextResponse.json({ message: "Tarif ERP du mètre supplémentaire indisponible." }, { status: 404 });
  }

  return NextResponse.json({
    baseLiftM: rule.baseLiftM,
    sellingPricePerMeterHT: rule.sellingPricePerMeterHT,
  });
}
