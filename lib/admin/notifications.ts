import { prisma } from "@/lib/db/prisma";

export type AdminNotificationKind =
  | "ORDER_CREATED"
  | "ORDER_VALIDATED"
  | "PAYMENT_RECEIVED"
  | "ORDER_READY"
  | "SHIPMENT_CREATED"
  | "USER_CREATED"
  | "STATUS_UPDATED";

export type AdminNotification = {
  key: string;
  kind: AdminNotificationKind;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  isRead: boolean;
};

type RawNotification = Omit<AdminNotification, "isRead"> & { createdAtDate: Date };

const LIMIT = 30;

type NotificationReadDelegate = {
  findMany(args: { where: { adminId: string; notificationKey: { in: string[] } }; select: { notificationKey: true } }): Promise<Array<{ notificationKey: string }>>;
};

const notificationRead = (prisma as unknown as { adminNotificationRead: NotificationReadDelegate }).adminNotificationRead;

function customerLabel(customer: { company: string | null; firstName: string | null; lastName: string | null }) {
  return customer.company || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Client OYSTE";
}

function statusNotification(description: string | null, reference: string): Pick<RawNotification, "kind" | "title" | "description"> {
  const value = description?.toLocaleLowerCase("fr") ?? "";
  if (value.includes("ready-to-ship")) return { kind: "ORDER_READY", title: "Commande prête", description: `${reference} est prête à être expédiée.` };
  if (value.includes("shipped")) return { kind: "SHIPMENT_CREATED", title: "Expédition créée", description: `${reference} a été déclarée expédiée.` };
  if (value.includes("paid")) return { kind: "ORDER_VALIDATED", title: "Commande validée", description: `${reference} est désormais validée.` };
  return { kind: "STATUS_UPDATED", title: "Commande mise à jour", description: description || `Le statut de ${reference} a été modifié.` };
}

export async function getAdminNotifications(adminId: string) {
  const [events, users] = await Promise.all([
    prisma.orderEvent.findMany({
      take: LIMIT,
      orderBy: { createdAt: "desc" },
      include: { order: { select: { id: true, reference: true, customer: { select: { company: true, firstName: true, lastName: true } } } } },
    }),
    prisma.adminUser.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, role: true, createdAt: true },
    }),
  ]);

  const orderNotifications: RawNotification[] = events.map((event) => {
    const base = {
      key: `order-event:${event.id}`,
      href: `/admin/commandes/${event.order.id}`,
      createdAt: event.createdAt.toISOString(),
      createdAtDate: event.createdAt,
    };
    if (event.type === "ORDER_CREATED") {
      return { ...base, kind: "ORDER_CREATED", title: "Nouvelle commande", description: `${event.order.reference} · ${customerLabel(event.order.customer)}` };
    }
    if (event.type === "PAYMENT_RECEIVED") {
      return { ...base, kind: "PAYMENT_RECEIVED", title: "Paiement reçu", description: `Le virement de ${event.order.reference} a été confirmé.` };
    }
    return { ...base, ...statusNotification(event.description, event.order.reference) };
  });

  const userNotifications: RawNotification[] = users.map((user) => ({
    key: `admin-user:${user.id}`,
    kind: "USER_CREATED",
    title: "Nouvel utilisateur",
    description: `${user.firstName} ${user.lastName} · ${user.role.replaceAll("_", " ")}`,
    href: `/admin/utilisateurs?user=${user.id}`,
    createdAt: user.createdAt.toISOString(),
    createdAtDate: user.createdAt,
  }));

  const merged = [...orderNotifications, ...userNotifications]
    .sort((a, b) => b.createdAtDate.getTime() - a.createdAtDate.getTime())
    .slice(0, LIMIT);

  const reads = await notificationRead.findMany({
    where: { adminId, notificationKey: { in: merged.map((item) => item.key) } },
    select: { notificationKey: true },
  });
  const readKeys = new Set<string>(reads.map((read: { notificationKey: string }) => read.notificationKey));
  const notifications: AdminNotification[] = merged.map((item) => ({
    key: item.key, kind: item.kind, title: item.title, description: item.description, href: item.href, createdAt: item.createdAt, isRead: readKeys.has(item.key),
  }));

  return { notifications, unreadCount: notifications.filter((item) => !item.isRead).length };
}
