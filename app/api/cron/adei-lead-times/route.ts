import { NextResponse } from "next/server";

import { syncAdeiLeadTimes } from "@/lib/suppliers/adei/lead-times";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parisHour = Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );

  // Vercel planifie en UTC. Le cron est déclenché à 16 h et 17 h UTC afin
  // de couvrir heure d'été / heure d'hiver ; seule l'occurrence de 18 h
  // heure de Paris lance réellement la synchronisation.
  if (parisHour !== 18) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Hors créneau 18h Europe/Paris." });
  }

  try {
    const result = await syncAdeiLeadTimes();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Synchronisation des délais impossible.",
        retained: true,
      },
      { status: 502 },
    );
  }
}
