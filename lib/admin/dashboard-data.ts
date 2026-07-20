import { prisma } from "@/lib/db/prisma";

const ACTIVE_PRODUCTION_STATUSES = ["ENGINEERING", "PRODUCTION", "QUALITY_CONTROL"] as const;
const SHIPMENT_STATUSES = ["READY_TO_SHIP", "SHIPPED"] as const;

function monthBounds(reference: Date) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  const previousStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return { start, end, previousStart };
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export type DashboardMetric = {
  value: number;
  previousValue: number;
  change: number;
};

export type DashboardChartPoint = {
  key: string;
  label: string;
  shortLabel: string;
  revenue: number;
  orders: number;
  production: number;
  shipments: number;
};

export type DashboardOrderItem = {
  id: string;
  reference: string;
  customerName: string;
  company: string;
  totalTtc: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  ageDays: number;
};

export type DashboardCustomerItem = {
  id: string;
  name: string;
  company: string;
  email: string;
  ordersCount: number;
  createdAt: Date;
};

export type DashboardProductRanking = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  revenueHt: number;
};

export type DashboardCustomerRanking = {
  id: string;
  name: string;
  company: string;
  ordersCount: number;
  revenueTtc: number;
};

export type DashboardCategoryRanking = {
  id: string;
  name: string;
  quantity: number;
  revenueHt: number;
};

export type DashboardData = {
  revenue: DashboardMetric;
  orders: DashboardMetric;
  customers: DashboardMetric;
  products: DashboardMetric;
  production: DashboardMetric;
  shipments: DashboardMetric;
  payments: DashboardMetric;
  averageOrder: DashboardMetric;
  pendingPaymentsAmount: number;
  chartPoints: DashboardChartPoint[];
  recentOrders: DashboardOrderItem[];
  recentCustomers: DashboardCustomerItem[];
  pendingOrders: DashboardOrderItem[];
  productionQueue: DashboardOrderItem[];
  todayShipments: DashboardOrderItem[];
  topProducts: DashboardProductRanking[];
  topCustomers: DashboardCustomerRanking[];
  topCategories: DashboardCategoryRanking[];
};

export async function getDashboardData(reference = new Date()): Promise<DashboardData> {
  const { start, end, previousStart } = monthBounds(reference);
  const chartStart = new Date(reference.getFullYear(), reference.getMonth() - 5, 1);
  const todayStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const tomorrowStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + 1);

  const [
    currentRevenue,
    previousRevenue,
    currentOrders,
    previousOrders,
    currentCustomers,
    previousCustomers,
    currentProducts,
    previousProducts,
    currentProduction,
    previousProduction,
    currentShipments,
    previousShipments,
    currentPayments,
    previousPayments,
    pendingPayments,
    chartOrders,
    recentOrders,
    recentCustomers,
    pendingOrdersList,
    productionQueue,
    todayShipments,
    productSales,
    customerSales,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", paidAt: { gte: start, lt: end } },
      _sum: { totalTtc: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", paidAt: { gte: previousStart, lt: start } },
      _sum: { totalTtc: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } } }),
    prisma.order.count({ where: { createdAt: { gte: previousStart, lt: start }, status: { not: "CANCELLED" } } }),
    prisma.customer.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.customer.count({ where: { createdAt: { gte: previousStart, lt: start } } }),
    prisma.product.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.product.count({ where: { createdAt: { gte: previousStart, lt: start } } }),
    prisma.order.count({
      where: { status: { in: [...ACTIVE_PRODUCTION_STATUSES] }, updatedAt: { gte: start, lt: end } },
    }),
    prisma.order.count({
      where: { status: { in: [...ACTIVE_PRODUCTION_STATUSES] }, updatedAt: { gte: previousStart, lt: start } },
    }),
    prisma.order.count({
      where: {
        OR: [
          { status: { in: [...SHIPMENT_STATUSES] }, updatedAt: { gte: start, lt: end } },
          { shippedAt: { gte: start, lt: end } },
        ],
      },
    }),
    prisma.order.count({
      where: {
        OR: [
          { status: { in: [...SHIPMENT_STATUSES] }, updatedAt: { gte: previousStart, lt: start } },
          { shippedAt: { gte: previousStart, lt: start } },
        ],
      },
    }),
    prisma.order.count({ where: { paymentStatus: "PAID", paidAt: { gte: start, lt: end } } }),
    prisma.order.count({ where: { paymentStatus: "PAID", paidAt: { gte: previousStart, lt: start } } }),
    prisma.order.aggregate({
      where: { paymentStatus: "PENDING", status: { not: "CANCELLED" } },
      _sum: { totalTtc: true },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { createdAt: { gte: chartStart, lt: end } },
          { paidAt: { gte: chartStart, lt: end } },
          { shippedAt: { gte: chartStart, lt: end } },
          { updatedAt: { gte: chartStart, lt: end } },
        ],
      },
      select: { createdAt: true, updatedAt: true, paidAt: true, shippedAt: true, status: true, paymentStatus: true, totalTtc: true },
    }),
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, reference: true, totalTtc: true, status: true, createdAt: true, updatedAt: true, customer: { select: { firstName: true, lastName: true, company: true, email: true } } },
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, company: true, email: true, createdAt: true, _count: { select: { orders: true } } },
    }),
    prisma.order.findMany({
      where: { status: { in: ["PENDING_PAYMENT", "PAID"] } },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, reference: true, totalTtc: true, status: true, createdAt: true, updatedAt: true, customer: { select: { firstName: true, lastName: true, company: true, email: true } } },
    }),
    prisma.order.findMany({
      where: { status: { in: [...ACTIVE_PRODUCTION_STATUSES] } },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: { id: true, reference: true, totalTtc: true, status: true, createdAt: true, updatedAt: true, customer: { select: { firstName: true, lastName: true, company: true, email: true } } },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { shippedAt: { gte: todayStart, lt: tomorrowStart } },
          { status: "READY_TO_SHIP", updatedAt: { gte: todayStart, lt: tomorrowStart } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, reference: true, totalTtc: true, status: true, createdAt: true, updatedAt: true, customer: { select: { firstName: true, lastName: true, company: true, email: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { paymentStatus: "PAID", status: { not: "CANCELLED" } } },
      _sum: { quantity: true, totalHt: true },
      orderBy: { _sum: { totalHt: "desc" } },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { paymentStatus: "PAID", status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: { totalTtc: true },
      orderBy: { _sum: { totalTtc: "desc" } },
      take: 5,
    }),
  ]);


  const rankedProductIds = productSales.map((sale) => sale.productId).filter((id): id is string => Boolean(id));
  const rankedCustomerIds = customerSales.map((sale) => sale.customerId);
  const [rankedProducts, rankedCustomers] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: rankedProductIds } },
      select: { id: true, name: true, code: true, category: { select: { id: true, name: true } } },
    }),
    prisma.customer.findMany({
      where: { id: { in: rankedCustomerIds } },
      select: { id: true, firstName: true, lastName: true, company: true, email: true },
    }),
  ]);

  const productById = new Map(rankedProducts.map((product) => [product.id, product]));
  const customerById = new Map(rankedCustomers.map((customer) => [customer.id, customer]));
  const topProducts: DashboardProductRanking[] = productSales
    .map((sale) => {
      if (!sale.productId) return null;
      const product = productById.get(sale.productId);
      if (!product) return null;
      return { id: product.id, name: product.name, code: product.code, quantity: sale._sum.quantity ?? 0, revenueHt: Number(sale._sum.totalHt ?? 0) };
    })
    .filter((item): item is DashboardProductRanking => item !== null)
    .slice(0, 5);

  const topCustomers: DashboardCustomerRanking[] = customerSales
    .map((sale) => {
      const customer = customerById.get(sale.customerId);
      if (!customer) return null;
      return {
        id: customer.id,
        name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email,
        company: customer.company || "",
        ordersCount: sale._count._all,
        revenueTtc: Number(sale._sum.totalTtc ?? 0),
      };
    })
    .filter((item): item is DashboardCustomerRanking => item !== null);

  const categoryTotals = new Map<string, DashboardCategoryRanking>();
  for (const sale of productSales) {
    if (!sale.productId) continue;
    const category = productById.get(sale.productId)?.category;
    if (!category) continue;
    const current = categoryTotals.get(category.id) ?? { id: category.id, name: category.name, quantity: 0, revenueHt: 0 };
    current.quantity += sale._sum.quantity ?? 0;
    current.revenueHt += Number(sale._sum.totalHt ?? 0);
    categoryTotals.set(category.id, current);
  }
  const topCategories = [...categoryTotals.values()].sort((a, b) => b.revenueHt - a.revenueHt).slice(0, 5);

  const revenue = Number(currentRevenue._sum.totalTtc ?? 0);
  const previousRevenueValue = Number(previousRevenue._sum.totalTtc ?? 0);
  const averageOrder = currentOrders > 0 ? revenue / currentOrders : 0;
  const previousAverageOrder = previousOrders > 0 ? previousRevenueValue / previousOrders : 0;

  const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
  const shortMonthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const chartPoints: DashboardChartPoint[] = Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(reference.getFullYear(), reference.getMonth() - 5 + index, 1);
    const monthEnd = new Date(reference.getFullYear(), reference.getMonth() - 4 + index, 1);
    const inRange = (date: Date | null) => Boolean(date && date >= monthStart && date < monthEnd);

    return {
      key: `${monthStart.getFullYear()}-${monthStart.getMonth()}`,
      label: monthFormatter.format(monthStart),
      shortLabel: shortMonthFormatter.format(monthStart).replace(".", ""),
      revenue: chartOrders.reduce((sum, order) => order.paymentStatus === "PAID" && inRange(order.paidAt) ? sum + Number(order.totalTtc) : sum, 0),
      orders: chartOrders.filter((order) => order.status !== "CANCELLED" && inRange(order.createdAt)).length,
      production: chartOrders.filter((order) => ACTIVE_PRODUCTION_STATUSES.includes(order.status as (typeof ACTIVE_PRODUCTION_STATUSES)[number]) && inRange(order.updatedAt)).length,
      shipments: chartOrders.filter((order) => inRange(order.shippedAt) || (SHIPMENT_STATUSES.includes(order.status as (typeof SHIPMENT_STATUSES)[number]) && inRange(order.updatedAt))).length,
    };
  });


  const mapOrderItem = (order: (typeof recentOrders)[number]): DashboardOrderItem => ({
    id: order.id,
    reference: order.reference,
    customerName: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email,
    company: order.customer.company || "Entreprise non renseignée",
    totalTtc: Number(order.totalTtc),
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ageDays: Math.max(0, Math.floor((reference.getTime() - order.updatedAt.getTime()) / 86_400_000)),
  });

  const metric = (value: number, previousValue: number): DashboardMetric => ({
    value,
    previousValue,
    change: percentChange(value, previousValue),
  });

  return {
    revenue: metric(revenue, previousRevenueValue),
    orders: metric(currentOrders, previousOrders),
    customers: metric(currentCustomers, previousCustomers),
    products: metric(currentProducts, previousProducts),
    production: metric(currentProduction, previousProduction),
    shipments: metric(currentShipments, previousShipments),
    payments: metric(currentPayments, previousPayments),
    averageOrder: metric(averageOrder, previousAverageOrder),
    pendingPaymentsAmount: Number(pendingPayments._sum.totalTtc ?? 0),
    chartPoints,
    recentOrders: recentOrders.map(mapOrderItem),
    recentCustomers: recentCustomers.map((customer) => ({
      id: customer.id,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email,
      company: customer.company || "Entreprise non renseignée",
      email: customer.email,
      ordersCount: customer._count.orders,
      createdAt: customer.createdAt,
    })),
    pendingOrders: pendingOrdersList.map(mapOrderItem),
    productionQueue: productionQueue.map(mapOrderItem),
    todayShipments: todayShipments.map(mapOrderItem),
    topProducts,
    topCustomers,
    topCategories,
  };
}
