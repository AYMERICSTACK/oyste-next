/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import type { OrderRecord, OrderStatus, PaymentStatus } from "./orders-data";
import { getSupplierLeadTimeInfo } from "@/lib/catalogue/supplier-lead-time";

const statusMap: Record<string, OrderStatus> = { PENDING_PAYMENT: "pending-payment", PAID: "paid", ENGINEERING: "engineering", PRODUCTION: "production", QUALITY_CONTROL: "quality-control", READY_TO_SHIP: "ready-to-ship", SHIPPED: "shipped", COMPLETED: "completed", CANCELLED: "cancelled" };
const paymentMap: Record<string, PaymentStatus> = { PENDING: "pending", PAID: "paid", REFUNDED: "refunded", FAILED: "pending" };
const progressMap: Record<OrderStatus, number> = { "pending-payment": 5, paid: 15, engineering: 30, production: 55, "quality-control": 80, "ready-to-ship": 92, shipped: 100, completed: 100, cancelled: 0 };
function technical(configuration: unknown) {
  if (!configuration || typeof configuration !== "object") return [] as Array<{label:string;value:string}>;
  const lines = (configuration as { technicalLines?: unknown }).technicalLines;
  return Array.isArray(lines) ? lines.filter((line): line is {label:string;value:string} => Boolean(line && typeof line === "object" && "label" in line && "value" in line)) : [];
}
function value(lines: Array<{label:string;value:string}>, names: string[], fallback: string) {
  const found = lines.find((line) => names.some((name) => line.label.toLowerCase().includes(name)));
  return found?.value || fallback;
}
function orderItemDisplayName(item: { reference?: string | null; name?: string | null }) {
  const reference = String(item.reference || "").toUpperCase();
  if (/^TSG/.test(reference)) return "Chariot manuel par chaîne";
  return item.name || "Produit catalogue";
}
function mapOrder(order: any): OrderRecord {
  const first = order.items[0];
  const lines = technical(first?.configuration);
  const familyRaw = String(first?.reference || first?.name || "").toUpperCase();
  const family = (["PFI","PFT","PMI","PMT","PMA","PMAM"].find((code) => familyRaw.includes(code)) || "CATALOGUE") as OrderRecord["family"];
  const status = statusMap[order.status] || "pending-payment";
  const address = order.shippingAddress;
  const supplierAckEvent = order.events.find((event: any) => event.type === "SUPPLIER_ACK_RECEIVED");
  const customerAckEvent = order.events.find((event: any) => event.type === "CUSTOMER_ACK_GENERATED");
  const supplierAckMetadata =
    supplierAckEvent?.metadata && typeof supplierAckEvent.metadata === "object"
      ? supplierAckEvent.metadata as Record<string, unknown>
      : null;
  const itemRecords = order.items.map((item: any) => {
    const supplier = item.product?.supplier?.name || "Fournisseur à confirmer";
    const lead = getSupplierLeadTimeInfo({
      supplier,
      stock: item.product?.stock ?? null,
      configuredDelay: item.product?.leadTime ?? null,
      isConfiguratorProduct: item.product?.experienceType === "CONFIGURABLE",
    });
    return {
      id: item.id,
      reference: item.reference || "",
      name: orderItemDisplayName(item),
      quantity: item.quantity,
      unitPriceHt: Number(item.unitPriceHt),
      totalHt: Number(item.totalHt),
      supplier,
      estimatedLeadTime: lead.label,
      estimatedLeadTimeNote: lead.note,
    };
  });
  return {
    id: order.id, reference: order.reference, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
    customer: { name: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email, company: order.customer.company || "Entreprise", email: order.customer.email, phone: order.customer.phone || "Non renseigné", city: address ? `${address.city} (${address.postalCode.slice(0,2)})` : "Non renseignée" },
    delivery: { mode: order.deliveryMode || "À confirmer", address: address ? `${address.address1}${address.address2 ? `, ${address.address2}` : ""}, ${address.postalCode} ${address.city}` : "À confirmer", requestedDate: order.requestedDate || "À convenir" },
    family, familyLabel: first ? orderItemDisplayName(first) : "Commande multi-produits", status, paymentStatus: paymentMap[order.paymentStatus] || "pending", totalHt: Number(order.totalTtc) - Number(order.taxAmount), totalTtc: Number(order.totalTtc),
    capacity: value(lines,["capacité","charge"],"À confirmer"), reach: value(lines,["portée"],"À confirmer"), height: value(lines,["hauteur"],"À confirmer"), environment: value(lines,["environnement"],"À confirmer"), fixing: value(lines,["fixation"],"À confirmer"), hoist: value(lines,["palan"],"À confirmer"), trolley: value(lines,["chariot"],"À confirmer"), powerSupply: value(lines,["alimentation"],"À confirmer"), options: lines.filter((line) => /option/i.test(line.label)).map((line) => line.value),
    productionOwner: status === "pending-payment" ? "Paiement" : status === "engineering" ? "Bureau d’études" : status === "production" ? "Atelier" : status === "quality-control" ? "Contrôle qualité" : status === "ready-to-ship" || status === "shipped" ? "Logistique" : "À planifier", commercialOwner: "Équipe OYSTE", progress: progressMap[status], note: order.customerNote || "Aucune note client.", notes: [],
    items: itemRecords,
    supplierAck: supplierAckEvent && supplierAckMetadata ? {
      confirmedLeadTime: String(supplierAckMetadata.confirmedLeadTime || ""),
      supplierAckReference: String(supplierAckMetadata.supplierAckReference || ""),
      supplierName: String(supplierAckMetadata.supplierName || "Fournisseur"),
      receivedAt: supplierAckEvent.createdAt.toISOString(),
    } : null,
    customerAckGeneratedAt: customerAckEvent?.createdAt?.toISOString() || null,
    shipment: order.shipment ? {
      id: order.shipment.id,
      carrierName: order.shipment.carrierName,
      shippingOptionName: order.shipment.shippingOptionName,
      trackingNumber: order.shipment.trackingNumber,
      trackingUrl: order.shipment.trackingUrl,
      status: order.shipment.status,
      weightKg: Number(order.shipment.weightKg),
      lengthCm: Number(order.shipment.lengthCm),
      widthCm: Number(order.shipment.widthCm),
      heightCm: Number(order.shipment.heightCm),
    } : null,
    timeline: order.events.map((event: any) => ({ date: new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }).format(event.createdAt), title: event.title, description: event.description || "" })),
  };
}
export async function getLiveAdminOrders() {
  const records = await (prisma.order as any).findMany({ orderBy: { createdAt: "desc" }, include: { customer: true, shippingAddress: true, items: { orderBy: { name: "asc" }, include: { product: { select: { stock: true, leadTime: true, experienceType: true, supplier: { select: { name: true } } } } } }, shipment: true, events: { orderBy: { createdAt: "desc" } } } });
  return records.map(mapOrder);
}
export async function getLiveAdminOrder(id: string) {
  const record = await (prisma.order as any).findUnique({ where: { id }, include: { customer: true, shippingAddress: true, items: { orderBy: { name: "asc" }, include: { product: { select: { stock: true, leadTime: true, experienceType: true, supplier: { select: { name: true } } } } } }, shipment: true, events: { orderBy: { createdAt: "desc" } } } });
  return record ? mapOrder(record) : null;
}
