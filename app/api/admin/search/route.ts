import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";

type ResultType = "product" | "order" | "customer" | "production" | "shipment" | "cms" | "user" | "setting";
type SearchResult = { id: string; type: ResultType; title: string; subtitle?: string; href: string; keywords?: string };

const PRODUCTION_STATUSES = new Set(["ENGINEERING", "PRODUCTION", "QUALITY_CONTROL"]);
const SHIPPING_STATUSES = new Set(["READY_TO_SHIP", "SHIPPED"]);

function containsJson(value: unknown, query: string) {
  return JSON.stringify(value ?? "").toLocaleLowerCase("fr").includes(query);
}

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const query = rawQuery.toLocaleLowerCase("fr");
  if (query.length < 2) return NextResponse.json({ query: rawQuery, groups: {} });

  const textFilter = { contains: rawQuery, mode: "insensitive" as const };
  const [products, orders, customers, users, settings] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ code: textFilter }, { supplierCode: textFilter }, { name: textFilter }, { shortName: textFilter }, { slug: textFilter }] },
      select: { id: true, code: true, name: true, shortName: true, category: { select: { name: true } } },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      where: { OR: [
        { reference: textFilter }, { paymentReference: textFilter },
        { customer: { company: textFilter } }, { customer: { email: textFilter } },
        { customer: { firstName: textFilter } }, { customer: { lastName: textFilter } },
        { items: { some: { name: textFilter } } }, { items: { some: { reference: textFilter } } },
      ] },
      select: { id: true, reference: true, status: true, totalTtc: true, customer: { select: { company: true, firstName: true, lastName: true } } },
      take: 15,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { OR: [{ company: textFilter }, { email: textFilter }, { firstName: textFilter }, { lastName: textFilter }, { siret: textFilter }, { phone: textFilter }, { vatNumber: textFilter }] },
      select: { id: true, company: true, firstName: true, lastName: true, email: true, phone: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.adminUser.findMany({
      where: { OR: [{ firstName: textFilter }, { lastName: textFilter }, { email: textFilter }] },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.siteSetting.findMany({
      select: { id: true, key: true, value: true, description: true, isPublic: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const customerName = (customer: { company: string | null; firstName: string | null; lastName: string | null }) =>
    customer.company || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Client";

  const toOrderResult = (order: (typeof orders)[number], type: ResultType, prefix = ""): SearchResult => ({
    id: `${prefix}${order.id}`,
    type,
    title: order.reference,
    subtitle: `${customerName(order.customer)} · ${type === "order" ? Number(order.totalTtc).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : order.status.replaceAll("_", " ")}`,
    href: `/admin/commandes/${order.id}`,
    keywords: order.status,
  });

  const matchingSettings = settings.filter((setting) =>
    setting.key.toLocaleLowerCase("fr").includes(query) || setting.description?.toLocaleLowerCase("fr").includes(query) || containsJson(setting.value, query),
  );

  const groups = {
    products: products.map<SearchResult>((product) => ({
      id: product.id, type: "product", title: product.name,
      subtitle: `${product.code}${product.category?.name ? ` · ${product.category.name}` : ""}`,
      href: `/admin/catalogue/${product.id}`, keywords: `${product.code} ${product.shortName ?? ""}`,
    })),
    orders: orders.slice(0, 5).map((order) => toOrderResult(order, "order")),
    customers: customers.map<SearchResult>((customer) => ({
      id: customer.id, type: "customer",
      title: customer.company || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || customer.email,
      subtitle: `${customer.email}${customer.phone ? ` · ${customer.phone}` : ""}`,
      href: `/admin/clients?client=${customer.id}`, keywords: `${customer.firstName ?? ""} ${customer.lastName ?? ""}`,
    })),
    production: orders.filter((order) => PRODUCTION_STATUSES.has(order.status)).slice(0, 5).map((order) => toOrderResult(order, "production", "production-")),
    shipments: orders.filter((order) => SHIPPING_STATUSES.has(order.status)).slice(0, 5).map((order) => toOrderResult(order, "shipment", "shipment-")),
    cms: matchingSettings.filter((setting) => setting.key.startsWith("cms.")).slice(0, 5).map<SearchResult>((setting) => ({
      id: `cms-${setting.id}`, type: "cms", title: setting.key === "cms.public" ? "Contenus & pages" : setting.key,
      subtitle: setting.description ?? "Contenu administrable OYSTE", href: "/admin/contenus", keywords: JSON.stringify(setting.value),
    })),
    users: users.map<SearchResult>((user) => ({
      id: user.id, type: "user", title: `${user.firstName} ${user.lastName}`,
      subtitle: `${user.email} · ${user.role.replaceAll("_", " ")}`, href: `/admin/utilisateurs?user=${user.id}`, keywords: user.status,
    })),
    settings: matchingSettings.filter((setting) => !setting.key.startsWith("cms.")).slice(0, 5).map<SearchResult>((setting) => ({
      id: `setting-${setting.id}`, type: "setting", title: setting.key,
      subtitle: setting.description ?? (setting.isPublic ? "Paramètre public" : "Paramètre interne"), href: "/admin/contenus", keywords: JSON.stringify(setting.value),
    })),
  };

  return NextResponse.json({ query: rawQuery, groups });
}
