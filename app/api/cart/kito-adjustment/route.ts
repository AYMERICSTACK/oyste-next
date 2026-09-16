import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSecureCheckoutItems } from "@/lib/orders/secure-checkout-items";
import { calculateKitoOrderAdjustment } from "@/lib/pricing/kito-order-adjustment";

const itemSchema = z.object({
  id: z.string(), kind: z.enum(["catalogue", "configured"]), name: z.string(), code: z.string().optional(), family: z.string().optional(), supplier: z.string().optional(), unitPriceHT: z.number(), quantity: z.number().int().min(1).max(99),
  weightKg: z.number().optional(), shippingMode: z.enum(["INCLUDED", "MESSAGERIE", "AFFRETEMENT", "QUOTE"]).optional(), technicalLines: z.array(z.object({ label: z.string(), value: z.string() })).optional(), addedAt: z.string().optional(),
}).passthrough();
const schema = z.object({ items: z.array(itemSchema).min(1).max(100) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Panier invalide." }, { status: 400 });
    const secureItems = await resolveSecureCheckoutItems(parsed.data.items as any);
    const adjustment = await calculateKitoOrderAdjustment(secureItems);
    return NextResponse.json({ adjustment: adjustment ? { discountHT: adjustment.discountHT, discountPercent: adjustment.discountPercent, discountReason: adjustment.discountReason } : null });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Remise KITO indisponible." }, { status: 400 });
  }
}
