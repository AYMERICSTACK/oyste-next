import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSecureCheckoutItems } from "@/lib/orders/secure-checkout-items";
import { calculateCartShippingWithSendcloud } from "@/lib/shipping/sendcloud-cart";

const itemSchema = z.object({
  id: z.string().min(1).max(220),
  kind: z.enum(["catalogue", "configured"]),
  name: z.string().min(1).max(250),
  code: z.string().max(120).optional(),
  family: z.string().max(120).optional(),
  supplier: z.string().max(160).optional(),
  weightKg: z.number().nonnegative().max(100000).optional(),
  shippingMode: z.enum(["INCLUDED", "MESSAGERIE", "AFFRETEMENT", "QUOTE"]).optional(),
  pfiShipping: z.object({ family: z.enum(["PFI", "PFT"]).optional(), capacityKg: z.number().positive(), spanM: z.number().positive(), hsfM: z.number().positive(), fixing: z.enum(["STANDARD", "CHEMICAL"]) }).optional(),
  wallPotenceShipping: z.object({ family: z.enum(["PMI", "PMT"]), capacityKg: z.number().positive(), spanM: z.number().positive(), additionalWeightKg: z.number().nonnegative().optional(), weightComplete: z.boolean().optional() }).optional(),
  unitPriceHT: z.number().nonnegative().max(10000000),
  quantity: z.number().int().min(1).max(99),
  technicalLines: z.array(z.object({ label: z.string().max(120), value: z.string().max(300) })).max(40).optional(),
  imageUrl: z.string().optional(), delay: z.string().optional(), href: z.string().optional(), editHref: z.string().optional(), addedAt: z.string(),
});

const schema = z.object({
  items: z.array(itemSchema).min(1).max(100),
  postalCode: z.string().regex(/^\d{5}$/),
  country: z.string().length(2).default("FR"),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Données transport invalides." }, { status: 400 });
    const items = await resolveSecureCheckoutItems(parsed.data.items);
    const shipping = await calculateCartShippingWithSendcloud(items, parsed.data.postalCode, parsed.data.country);
    return NextResponse.json({ shipping });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Transport indisponible." }, { status: 400 });
  }
}
