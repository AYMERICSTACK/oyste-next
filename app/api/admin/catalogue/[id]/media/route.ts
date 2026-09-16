import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";

const createMediaSchema = z.object({
  url: z.string().url(),
});

const deleteMediaSchema = z.object({
  url: z.string().url(),
});

function isVercelBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "blob.vercel-storage.com" ||
        url.hostname.endsWith(".blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

async function requireWritableAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) return { response: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  if (admin.role === "READ_ONLY") {
    return {
      response: NextResponse.json(
        { error: "Votre rôle ne permet pas de modifier les médias." },
        { status: 403 },
      ),
    };
  }
  return { admin };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWritableAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = createMediaSchema.safeParse(await request.json());
  if (!parsed.success || !isVercelBlobUrl(parsed.data.url)) {
    return NextResponse.json({ error: "URL média invalide." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { media: true } },
      media: { select: { sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const media = await prisma.productMedia.upsert({
    where: { productId_url: { productId: id, url: parsed.data.url } },
    update: {},
    create: {
      productId: id,
      type: "IMAGE",
      url: parsed.data.url,
      sourceUrl: parsed.data.url,
      isPrimary: product._count.media === 0,
      sortOrder: (product.media[0]?.sortOrder ?? -1) + 1,
    },
    select: { id: true, url: true, isPrimary: true, sortOrder: true },
  });

  return NextResponse.json({ media });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWritableAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = deleteMediaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "URL média invalide." }, { status: 400 });
  }

  const media = await prisma.productMedia.findUnique({
    where: { productId_url: { productId: id, url: parsed.data.url } },
    select: { id: true, url: true, isPrimary: true },
  });
  if (!media) {
    return NextResponse.json(
      { error: "Cette image n’est pas un média administrable de ce produit." },
      { status: 404 },
    );
  }

  if (isVercelBlobUrl(media.url)) {
    await del(media.url);
  }

  await prisma.$transaction(async (tx) => {
    await tx.productMedia.delete({ where: { id: media.id } });
    if (media.isPrimary) {
      const next = await tx.productMedia.findFirst({
        where: { productId: id, type: "IMAGE" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (next) {
        await tx.productMedia.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
  });

  return NextResponse.json({ deleted: true, url: media.url });
}
