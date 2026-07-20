import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminNotifications } from "@/lib/admin/notifications";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";


type NotificationReadDelegate = {
  deleteMany(args: { where: { adminId: string; notificationKey: string } }): Promise<unknown>;
  upsert(args: {
    where: { adminId_notificationKey: { adminId: string; notificationKey: string } };
    update: { readAt: Date };
    create: { adminId: string; notificationKey: string };
  }): Promise<unknown>;
  createMany(args: { data: Array<{ adminId: string; notificationKey: string }>; skipDuplicates: boolean }): Promise<unknown>;
};

const notificationRead = (prisma as unknown as { adminNotificationRead: NotificationReadDelegate }).adminNotificationRead;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), key: z.string().min(1).max(200) }),
  z.object({ action: z.literal("unread"), key: z.string().min(1).max(200) }),
  z.object({ action: z.literal("read-all"), keys: z.array(z.string().min(1).max(200)).max(50) }),
]);

async function activeAdmin() {
  const admin = await getCurrentAdmin();
  return admin?.status === "ACTIVE" ? admin : null;
}

export async function GET() {
  const admin = await activeAdmin();
  if (!admin) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  return NextResponse.json(await getAdminNotifications(admin.id));
}

export async function POST(request: Request) {
  const admin = await activeAdmin();
  if (!admin) return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Action invalide." }, { status: 400 });

  if (parsed.data.action === "unread") {
    await notificationRead.deleteMany({ where: { adminId: admin.id, notificationKey: parsed.data.key } });
  } else if (parsed.data.action === "read") {
    await notificationRead.upsert({
      where: { adminId_notificationKey: { adminId: admin.id, notificationKey: parsed.data.key } },
      update: { readAt: new Date() },
      create: { adminId: admin.id, notificationKey: parsed.data.key },
    });
  } else if (parsed.data.keys.length) {
    await notificationRead.createMany({
      data: parsed.data.keys.map((notificationKey) => ({ adminId: admin.id, notificationKey })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true });
}
