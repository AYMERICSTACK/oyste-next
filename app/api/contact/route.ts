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
  subject: z.enum(["DEVIS", "CONSEIL", "CONFIGURATION", "COMMANDE", "SAV", "COMMERCIAL", "AUTRE"]),
  message: z.string().trim().min(20).max(3000),
  consent: z.literal(true),
});

async function sendResendEmail(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
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
        { status: 400 }
      );
    }

    const data = parsed.data;
    const from = process.env.CONTACT_FROM_EMAIL || "OYSTE <onboarding@resend.dev>";
    const adminEmail = process.env.CONTACT_TO_EMAIL;
    const subjectLabel = contactSubjectLabels[data.subject];

    if (!adminEmail) {
      console.error("CONTACT_TO_EMAIL is missing.");
      return NextResponse.json(
        { message: "Le service de contact n’est pas encore configuré. Merci de nous contacter par téléphone." },
        { status: 503 }
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
      message: "Un e-mail de confirmation vient de vous être envoyé. Notre équipe vous répondra sous un jour ouvré.",
    });
  } catch (error) {
    console.error("Contact route error:", error);
    return NextResponse.json(
      { message: "L’envoi a échoué. Merci de réessayer dans quelques instants." },
      { status: 500 }
    );
  }
}
