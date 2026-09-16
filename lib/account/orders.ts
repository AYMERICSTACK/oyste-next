import { prisma } from "@/lib/db/prisma";

export const customerOrderStatus = {
  PENDING_PAYMENT: { label: "En attente de paiement", tone: "amber" },
  PAID: { label: "Paiement validé", tone: "cyan" },
  ENGINEERING: { label: "En étude", tone: "blue" },
  PRODUCTION: { label: "En fabrication", tone: "violet" },
  QUALITY_CONTROL: { label: "Contrôle qualité", tone: "indigo" },
  READY_TO_SHIP: { label: "Prête à expédier", tone: "orange" },
  SHIPPED: { label: "Expédiée", tone: "emerald" },
  COMPLETED: { label: "Terminée", tone: "slate" },
  CANCELLED: { label: "Annulée", tone: "red" },
} as const;

export type CustomerOrderStatus = keyof typeof customerOrderStatus;

export function formatMoney(value: unknown, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(value));
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(value);
}

export async function getCustomerDashboard(customerId: string) {
  const [totalOrders, activeOrders, pendingPayment, completedOrders, totals, latestOrders] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.count({ where: { customerId, status: { in: ["PAID", "ENGINEERING", "PRODUCTION", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED"] } } }),
    prisma.order.count({ where: { customerId, paymentStatus: "PENDING" } }),
    prisma.order.count({ where: { customerId, status: "COMPLETED" } }),
    prisma.order.aggregate({ where: { customerId, status: { not: "CANCELLED" } }, _sum: { totalTtc: true, taxAmount: true } }),
    prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, reference: true, status: true, paymentStatus: true, taxAmount: true, totalTtc: true, currency: true, createdAt: true, deliveryMode: true, _count: { select: { items: true } } },
    }),
  ]);

  return { totalOrders, activeOrders, pendingPayment, completedOrders, totalHt: Number(totals._sum.totalTtc ?? 0) - Number(totals._sum.taxAmount ?? 0), totalTtc: totals._sum.totalTtc ?? 0, latestOrders };
}

export async function getCustomerOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reference: true, status: true, paymentStatus: true, subtotalHt: true, taxAmount: true, totalTtc: true,
      currency: true, deliveryMode: true, requestedDate: true, createdAt: true, updatedAt: true,
      _count: { select: { items: true } },
    },
  });
}

export async function getCustomerOrder(customerId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: { orderBy: { name: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
      shippingAddress: true,
    },
  });
}
