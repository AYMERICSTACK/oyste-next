import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (admin.role === "READ_ONLY") {
    return NextResponse.json(
      { error: "Votre rôle ne permet pas d’ajouter des médias." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || "{}") as {
          productId?: string;
        };
        if (payload.productId !== id) {
          throw new Error("Produit d’upload invalide.");
        }

        const product = await prisma.product.findUnique({
          where: { id },
          select: { id: true, code: true },
        });
        if (!product) throw new Error("Produit introuvable.");

        const expectedPrefix = `products/${product.code.replace(/[^a-zA-Z0-9_-]+/g, "-")}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Chemin média invalide.");
        }

        return {
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          maximumSizeInBytes: MAX_IMAGE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ productId: product.id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de préparer l’upload du média.",
      },
      { status: 400 },
    );
  }
}
