import "server-only";

import { prisma } from "@/lib/db/prisma";

const LEAD_TIME_URL = "https://configurateur.comege.fr/delais";
const OYSTE_LEAD_TIME_BUFFER_WEEKS = 1;

type SourceLeadTime = {
  sourceLabel: string;
  weeks: number;
  aliases: string[];
};

export type AdeiLeadTimeSyncResult = {
  fetchedAt: string;
  sourceRows: number;
  updatedProducts: number;
  updatedVariants: number;
  skippedProducts: number;
  families: Array<{ label: string; weeks: number }>;
};

function decodeHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFamily(value: string | null | undefined) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: string | null | undefined) {
  return normalizeFamily(value).replace(/\s+/g, "");
}

function aliasesFromSourceLabel(label: string) {
  return label
    .split("/")
    .map((value) => normalizeFamily(value))
    .filter(Boolean);
}

export function parseLeadTimeTable(html: string): SourceLeadTime[] {
  const table = html.match(/<table\b[^>]*id=["']tbl_delais["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw new Error("Tableau des délais introuvable.");

  const rows: SourceLeadTime[] = [];
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => decodeHtml(match[1]));
    if (cells.length < 2) continue;

    const sourceLabel = cells[0].trim();
    const weeksMatch = cells[1].match(/(\d+)\s*semaine/i);
    if (!sourceLabel || !weeksMatch) continue;

    const weeks = Number(weeksMatch[1]);
    if (!Number.isInteger(weeks) || weeks <= 0 || weeks > 52) continue;

    rows.push({
      sourceLabel,
      weeks,
      aliases: aliasesFromSourceLabel(sourceLabel),
    });
  }

  if (rows.length < 8 || !rows.some((row) => row.aliases.includes("PORT"))) {
    throw new Error("Le tableau des délais reçu est incomplet ou inattendu.");
  }

  return rows;
}

function resolveLeadTime(
  product: { code: string; parentCode: string | null; configuratorFamily: string | null },
  rows: SourceLeadTime[],
) {
  const exactFamily = normalizeFamily(product.configuratorFamily);
  if (exactFamily) {
    const exact = rows.find((row) => row.aliases.includes(exactFamily));
    if (exact) return exact;
  }

  const candidates = [compact(product.code), compact(product.parentCode)].filter(Boolean);
  const aliases = rows
    .flatMap((row) => row.aliases.map((alias) => ({ alias: compact(alias), row })))
    .filter((item) => item.alias.length >= 3)
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const candidate of candidates) {
    const match = aliases.find((item) => candidate.startsWith(item.alias));
    if (match) return match.row;
  }

  return null;
}

export async function syncAdeiLeadTimes(): Promise<AdeiLeadTimeSyncResult> {
  const response = await fetch(LEAD_TIME_URL, {
    cache: "no-store",
    headers: { "User-Agent": "OYSTE lead-time sync" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Source délais indisponible (${response.status}).`);
  }

  // IMPORTANT : aucune écriture n'est faite avant que la source ait été
  // entièrement récupérée et validée. En cas de panne, le dernier délai connu
  // reste donc intact dans OYSTE.
  const rows = parseLeadTimeTable(await response.text());

  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "ADEI", mode: "insensitive" } },
    select: { id: true },
  });
  if (!supplier) throw new Error("Fournisseur ADEI introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      id: true,
      code: true,
      parentCode: true,
      configuratorFamily: true,
      variants: { select: { id: true } },
    },
  });

  let updatedProducts = 0;
  let updatedVariants = 0;
  let skippedProducts = 0;
  const operations: Array<ReturnType<typeof prisma.product.update>> = [];

  for (const product of products) {
    const matched = resolveLeadTime(product, rows);
    if (!matched) {
      skippedProducts += 1;
      continue;
    }

    const customerWeeks = matched.weeks + OYSTE_LEAD_TIME_BUFFER_WEEKS;
    const leadTime = `Délai indicatif : ${customerWeeks} semaine${customerWeeks > 1 ? "s" : ""}`;
    operations.push(
      prisma.product.update({
        where: { id: product.id },
        data: {
          leadTime,
          variants: {
            updateMany: {
              where: {},
              data: { leadTime },
            },
          },
        },
      }),
    );
    updatedProducts += 1;
    updatedVariants += product.variants.length;
  }

  // Transactions volontairement courtes pour rester sûres sur une base distante.
  for (let index = 0; index < operations.length; index += 40) {
    await prisma.$transaction(operations.slice(index, index + 40));
  }

  return {
    fetchedAt: new Date().toISOString(),
    sourceRows: rows.length,
    updatedProducts,
    updatedVariants,
    skippedProducts,
    families: rows.map((row) => ({
      label: row.sourceLabel,
      weeks: row.weeks + OYSTE_LEAD_TIME_BUFFER_WEEKS,
    })),
  };
}
