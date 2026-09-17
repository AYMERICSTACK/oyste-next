import "server-only";

import { prisma } from "@/lib/db/prisma";

const COMEGE_LOGIN_URL = "https://www.comege.fr/";
const LEAD_TIME_URL = "https://www.comege.fr/fr/delais-produits-standard";
const COMEGE_USERNAME_FIELD = "m592femams_input_username";
const COMEGE_PASSWORD_FIELD = "m592femams_input_password";
const OYSTE_LEAD_TIME_BUFFER_WEEKS = 1;

type CookieJar = Map<string, string>;

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

export type AdeiLeadTimePreviewResult = {
  fetchedAt: string;
  sourceRows: number;
  families: Array<{
    label: string;
    supplierWeeks: number;
    customerWeeks: number;
  }>;
};

function extractSetCookieHeaders(headers: Headers) {
  const nodeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof nodeHeaders.getSetCookie === "function") return nodeHeaders.getSetCookie();

  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
}

function mergeCookies(jar: CookieJar, headers: Headers) {
  for (const setCookie of extractSetCookieHeaders(headers)) {
    const pair = setCookie.split(";", 1)[0]?.trim();
    if (!pair) continue;
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!name) continue;
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

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
    .replace(/&eacute;|&#233;/gi, "é")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHtmlAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === "input" || name === "button") continue;
    attributes.set(name, decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attributes;
}

function extractLoginFormFields(html: string) {
  const fields = new URLSearchParams();

  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = parseHtmlAttributes(match[0]);
    const name = attributes.get("name")?.trim();
    if (!name) continue;

    const type = attributes.get("type")?.toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (!/\bchecked\b/i.test(match[0])) continue;
    }
    fields.set(name, attributes.get("value") ?? "");
  }

  for (const match of html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi)) {
    const openingTag = match[0].match(/^<button\b[^>]*>/i)?.[0];
    if (!openingTag) continue;
    const attributes = parseHtmlAttributes(openingTag);
    const name = attributes.get("name")?.trim();
    if (!name) continue;
    fields.set(name, attributes.get("value") ?? decodeHtml(match[0]));
  }

  return fields;
}

function requireComegeCredentials() {
  const username = process.env.COMEGE_LOGIN?.trim();
  const password = process.env.COMEGE_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("COMEGE_LOGIN et COMEGE_PASSWORD doivent être configurés.");
  }
  return { username, password };
}

async function fetchComegeLeadTimeHtml() {
  const { username, password } = requireComegeCredentials();
  const jar: CookieJar = new Map();
  const commonHeaders = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "OYSTE lead-time sync",
  };

  const loginPage = await fetch(COMEGE_LOGIN_URL, {
    cache: "no-store",
    headers: commonHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (!loginPage.ok) {
    throw new Error(`Page de connexion COMEGE indisponible (${loginPage.status}).`);
  }
  mergeCookies(jar, loginPage.headers);

  const loginHtml = await loginPage.text();
  const fields = extractLoginFormFields(loginHtml);
  if (!fields.has("xt_csrf_name") || !fields.has("xt_csrf_token")) {
    throw new Error("Jeton CSRF COMEGE introuvable sur la page de connexion.");
  }

  fields.set(COMEGE_USERNAME_FIELD, username);
  fields.set(COMEGE_PASSWORD_FIELD, password);

  const loginResponse = await fetch(COMEGE_LOGIN_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://www.comege.fr",
      Referer: COMEGE_LOGIN_URL,
      ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: fields,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (loginResponse.status >= 400) {
    throw new Error(`Connexion COMEGE refusée (${loginResponse.status}).`);
  }
  mergeCookies(jar, loginResponse.headers);

  const response = await fetch(LEAD_TIME_URL, {
    cache: "no-store",
    headers: {
      ...commonHeaders,
      Referer: COMEGE_LOGIN_URL,
      ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Source délais COMEGE indisponible (${response.status}).`);
  }

  const html = await response.text();
  if (/m592femams_input_password/i.test(html) && !/Produits\s*\/\s*d[ée]lais/i.test(html)) {
    throw new Error("Connexion COMEGE non établie : la page des délais demande encore une authentification.");
  }
  return html;
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

function findLeadTimeTable(html: string) {
  const tables = [...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];

  const bySummary = tables.find((match) => {
    const attributes = parseHtmlAttributes(`<table ${match[1]}>`);
    const summary = normalizeFamily(attributes.get("summary"));
    return summary === "PRODUITS DELAIS";
  });
  if (bySummary) return bySummary[2];

  const legacy = html.match(/<table\b[^>]*id=["']tbl_delais["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (legacy) return legacy;

  return null;
}

export function parseLeadTimeTable(html: string): SourceLeadTime[] {
  const table = findLeadTimeTable(html);
  if (!table) {
    throw new Error('Tableau COMEGE "Produits / délais" introuvable.');
  }

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

  const requiredAliases = ["PMT", "PRT", "PORT", "PALANS", "PADC"];
  const allAliases = new Set(rows.flatMap((row) => row.aliases));
  if (
    rows.length < 8 ||
    requiredAliases.some((alias) => !allAliases.has(alias))
  ) {
    throw new Error("Le tableau des délais COMEGE reçu est incomplet ou inattendu.");
  }

  return rows;
}

export async function previewAdeiLeadTimes(): Promise<AdeiLeadTimePreviewResult> {
  const rows = parseLeadTimeTable(await fetchComegeLeadTimeHtml());
  return {
    fetchedAt: new Date().toISOString(),
    sourceRows: rows.length,
    families: rows.map((row) => ({
      label: row.sourceLabel,
      supplierWeeks: row.weeks,
      customerWeeks: row.weeks + OYSTE_LEAD_TIME_BUFFER_WEEKS,
    })),
  };
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
  // IMPORTANT : aucune écriture n'est faite avant que la connexion COMEGE,
  // la récupération de la page et la validation du tableau aient toutes réussi.
  // En cas de panne ou d'authentification refusée, le dernier délai connu reste intact.
  const rows = parseLeadTimeTable(await fetchComegeLeadTimeHtml());

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
