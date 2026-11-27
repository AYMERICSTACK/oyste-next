import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAdminContactEmail,
  buildCustomerConfirmationEmail,
  contactSubjectLabels,
} from "@/lib/contact/contact-email";

const contactSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  company: z.string().trim().min(2).max(120),
  email: z.email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  subject: z.enum([
    "DEVIS",
    "CONSEIL",
    "CONFIGURATION",
    "COMMANDE",
    "SAV",
    "COMMERCIAL",
    "AUTRE",
  ]),
  message: z.string().trim().min(20).max(3000),
  consent: z.literal(true),
});

const qaReceiptPrefix = "qa.stockman.quote.";

async function isIsolatedQuoteDatabase() {
  if (process.env.OYSTE_STOCKMAN_TEST !== "true" ||
      process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "recette-stockman-isolee") return false;
  const markers = await prisma.$queryRaw<Array<{ environment: string }>>`SELECT environment FROM "OysteQaMarker"`;
  return markers.length === 1 && markers[0].environment === "recette-stockman-isolee";
}

export async function GET(request: Request) {
  if (process.env.OYSTE_STOCKMAN_TEST !== "true") return new NextResponse(null, { status: 405 });
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("recette"));
  if (!id.success || !await isIsolatedQuoteDatabase()) return new NextResponse(null, { status: 404 });
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return new NextResponse(null, { status: 401 });
  const receipt = await prisma.siteSetting.findUnique({ where: { key: qaReceiptPrefix + id.data }, select: { value: true } });
  if (!receipt) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ receipt: id.data, record: receipt.value }, { headers: { "Cache-Control": "no-store" } });
}

async function sendResendEmail(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  if (process.env.OYSTE_STOCKMAN_TEST === "true") return;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY_MISSING");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Resend contact error:", response.status, details);
    throw new Error("RESEND_SEND_FAILED");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Merci de vérifier les champs obligatoires du formulaire." },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (process.env.OYSTE_STOCKMAN_TEST === "true") {
      if (data.subject !== "DEVIS" || !data.email.toLowerCase().endsWith("@example.invalid") ||
          !await isIsolatedQuoteDatabase()) {
        return NextResponse.json({ message: "Utilisez une demande de devis et une adresse fictive @example.invalid réservées à la recette." }, { status: 422 });
      }
      const id = randomUUID();
      await prisma.siteSetting.create({
        data: { key: qaReceiptPrefix + id, isPublic: false, value: { subject: data.subject, message: data.message, createdAt: new Date().toISOString() } },
      });
      return NextResponse.json({ message: "Demande enregistrée en recette. Référence : " + id, receipt: id }, { status: 201 });
    }
    const from =
      process.env.CONTACT_FROM_EMAIL || "OYSTE <onboarding@resend.dev>";
    const adminEmail = process.env.CONTACT_TO_EMAIL;
    const subjectLabel = contactSubjectLabels[data.subject];

    if (!adminEmail) {
      console.error("CONTACT_TO_EMAIL is missing.");
      return NextResponse.json(
        {
          message:
            "Le service de contact n’est pas encore configuré. Merci de nous contacter par téléphone.",
        },
        { status: 503 },
      );
    }

    await sendResendEmail({
      from,
      to: [adminEmail],
      subject: `[OYSTE] ${subjectLabel} — ${data.firstName} ${data.lastName}`,
      html: buildAdminContactEmail(data),
      replyTo: data.email,
    });

    try {
      await sendResendEmail({
        from,
        to: [data.email],
        subject: "OYSTE — Nous avons bien reçu votre demande",
        html: buildCustomerConfirmationEmail(data),
        replyTo: adminEmail,
      });
    } catch (confirmationError) {
      console.error("Customer confirmation email failed:", confirmationError);
    }

    return NextResponse.json({
      message:
        "Un e-mail de confirmation vient de vous être envoyé. Notre équipe vous répondra sous un jour ouvré.",
    });
  } catch (error) {
    console.error("Contact route error:", error);
    return NextResponse.json(
      {
        message: "L’envoi a échoué. Merci de réessayer dans quelques instants.",
      },
      { status: 500 },
    );
  }
}
