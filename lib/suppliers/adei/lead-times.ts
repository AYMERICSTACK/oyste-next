import "server-only";

import { prisma } from "@/lib/db/prisma";

const COMEGE_LOGIN_URL = "https://www.comege.fr/";
const LEAD_TIME_URL = "https://www.comege.fr/fr/delais-produits-standard";
const COMEGE_USERNAME_FIELD = "m592femams_input_username";
const COMEGE_PASSWORD_FIELD = "m592femams_input_password";
const OYSTE_LEAD_TIME_BUFFER_WEEKS = 1;

type CookieJar = Map<string, string>;

type LoginForm = {
  action: string;
  method: string;
  fields: URLSearchParams;
};

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

export type AdeiLeadTimePreview = {
  fetchedAt: string;
  sourceRows: number;
  preview: true;
  writes: 0;
  families: Array<{
    label: string;
    supplierWeeks: number;
    oysteWeeks: number;
  }>;
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

function parseHtmlAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === "input" || name === "button" || name === "form") continue;
    attributes.set(name, decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""));
  }

  return attributes;
}

function extractFieldsFromForm(formHtml: string) {
  const fields = new URLSearchParams();

  for (const match of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = parseHtmlAttributes(match[0]);
    const name = attributes.get("name")?.trim();
    if (!name) continue;

    const type = attributes.get("type")?.toLowerCase();
    if ((type === "checkbox" || type === "radio") && !/\bchecked\b/i.test(match[0])) {
      continue;
    }

    fields.set(name, attributes.get("value") ?? "");
  }

  for (const match of formHtml.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi)) {
    const openingTag = match[0].match(/^<button\b[^>]*>/i)?.[0];
    if (!openingTag) continue;

    const attributes = parseHtmlAttributes(openingTag);
    const name = attributes.get("name")?.trim();
    if (!name) continue;

    fields.set(name, attributes.get("value") ?? decodeHtml(match[0]));
  }

  return fields;
}

function extractLoginForm(html: string): LoginForm {
  for (const match of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)) {
    const formHtml = match[0];
    if (!formHtml.includes(COMEGE_USERNAME_FIELD) || !formHtml.includes(COMEGE_PASSWORD_FIELD)) {
      continue;
    }

    const openingTag = formHtml.match(/^<form\b[^>]*>/i)?.[0];
    if (!openingTag) continue;

    const attributes = parseHtmlAttributes(openingTag);
    const action = attributes.get("action")?.trim() || COMEGE_LOGIN_URL;
    const method = (attributes.get("method")?.trim() || "POST").toUpperCase();
    const fields = extractFieldsFromForm(formHtml);

    if (!fields.has("xt_csrf_name") || !fields.has("xt_csrf_token")) {
      throw new Error("Jeton CSRF COMEGE introuvable dans le formulaire de connexion.");
    }

    return { action, method, fields };
  }

  throw new Error("Formulaire de connexion COMEGE introuvable.");
}

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

function browserHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  };
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
  const commonHeaders = browserHeaders();

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
  const form = extractLoginForm(loginHtml);

  form.fields.set(COMEGE_USERNAME_FIELD, username);
  form.fields.set(COMEGE_PASSWORD_FIELD, password);

  const loginActionUrl = new URL(form.action, COMEGE_LOGIN_URL).toString();
  if (form.method !== "POST") {
    throw new Error(`Méthode de connexion COMEGE inattendue (${form.method}).`);
  }

  const loginResponse = await fetch(loginActionUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://www.comege.fr",
      Referer: COMEGE_LOGIN_URL,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: form.fields,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });

  mergeCookies(jar, loginResponse.headers);

  const redirectLocation = loginResponse.headers.get("location") || "";

  // COMEGE peut rediriger une connexion valide soit vers la page d'accueil,
  // soit directement vers la page des délais. La destination du POST n'est
  // donc pas utilisée comme preuve d'authentification : seul l'accès réel à
  // la page protégée ci-dessous valide la session.
  if (loginResponse.status >= 300 && loginResponse.status < 400) {
    // Redirection attendue après soumission du formulaire : les cookies ont
    // déjà été fusionnés dans le jar juste au-dessus.
  } else if (loginResponse.ok) {
    // Certains parcours COMEGE peuvent répondre 200 au POST. On conserve les
    // cookies éventuels et on vérifie la session sur LEAD_TIME_URL.
    await loginResponse.text();
  } else {
    throw new Error(`Connexion COMEGE refusée (${loginResponse.status}).`);
  }

  const response = await fetch(LEAD_TIME_URL, {
    cache: "no-store",
    headers: {
      ...commonHeaders,
      Referer: redirectLocation || COMEGE_LOGIN_URL,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Source délais COMEGE indisponible (${response.status}) après connexion HTTP ${loginResponse.status}.`,
    );
  }

  const html = await response.text();
  if (html.includes(COMEGE_PASSWORD_FIELD) && !/summary=["'][^"']*Produits\s*\/\s*d[ée]lais/i.test(html)) {
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

export function parseLeadTimeTable(html: string): SourceLeadTime[] {
  const table =
    html.match(/<table\b[^>]*summary=["'][^"']*Produits\s*\/\s*d[ée]lais[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1] ??
    html.match(/<table\b[^>]*id=["']tbl_delais["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];

  if (!table) throw new Error("Tableau des délais COMEGE introuvable.");

  const rows: SourceLeadTime[] = [];
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      decodeHtml(match[1]),
    );
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
    throw new Error("Le tableau des délais COMEGE reçu est incomplet ou inattendu.");
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

type ManualLeadTimeRule = {
  productLeadTime: string;
  variantLeadTime?: (variantCode: string) => string | null;
};

function formatWeeks(weeks: number) {
  return `Délai indicatif : ${weeks} semaine${weeks > 1 ? "s" : ""}`;
}

function manualAdeiLeadTimeRule(product: {
  code: string;
  parentCode: string | null;
  supplierCode: string | null;
}): ManualLeadTimeRule | null {
  const code = compact(product.code);
  const parentCode = compact(product.parentCode);
  const supplierCode = compact(product.supplierCode);
  const candidates = [code, parentCode];

  // Délais confirmés manuellement par ADEI. Contrairement au tableau COMEGE,
  // ces valeurs sont déjà les délais OYSTE : aucun buffer de +1 semaine.
  if (candidates.includes("CROCHETAUTO")) {
    return {
      productLeadTime: "Délai indicatif : 1 à 4 semaines",
      variantLeadTime: (variantCode) => {
        const match = compact(variantCode).match(/^IS(\d+(?:\.\d+)?)$/);
        if (!match) return null;

        const capacityTons = Number(match[1]);
        if (!Number.isFinite(capacityTons)) return null;
        if (capacityTons === 1 || capacityTons === 2) return formatWeeks(1);
        if (capacityTons === 5) return formatWeeks(2);
        if (capacityTons > 5) return formatWeeks(4);
        return null;
      },
    };
  }

  if (candidates.includes("LIGNEALIM") || supplierCode.startsWith("LSR")) {
    return { productLeadTime: "Délai indicatif : 1 à 2 semaines" };
  }

  if (candidates.includes("PALFIX") || supplierCode.startsWith("PALECOF")) {
    return { productLeadTime: formatWeeks(2) };
  }

  if (candidates.includes("PALREG") || supplierCode.startsWith("PALECOR")) {
    return { productLeadTime: formatWeeks(2) };
  }

  if (candidates.includes("TRA") || supplierCode.startsWith("TRI")) {
    return { productLeadTime: formatWeeks(7) };
  }

  return null;
}

export async function previewAdeiLeadTimes(): Promise<AdeiLeadTimePreview> {
  const rows = parseLeadTimeTable(await fetchComegeLeadTimeHtml());
  return {
    fetchedAt: new Date().toISOString(),
    sourceRows: rows.length,
    preview: true,
    writes: 0,
    families: rows.map((row) => ({
      label: row.sourceLabel,
      supplierWeeks: row.weeks,
      oysteWeeks: row.weeks + OYSTE_LEAD_TIME_BUFFER_WEEKS,
    })),
  };
}

export async function syncAdeiLeadTimes(): Promise<AdeiLeadTimeSyncResult> {
  // IMPORTANT : aucune écriture n'est faite avant que la connexion COMEGE,
  // la récupération de la page et la validation du tableau aient toutes réussi.
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
      supplierCode: true,
      parentCode: true,
      configuratorFamily: true,
      variants: { select: { id: true, code: true } },
    },
  });

  let updatedProducts = 0;
  let updatedVariants = 0;
  let skippedProducts = 0;
  const operations: Array<
    ReturnType<typeof prisma.product.update> | ReturnType<typeof prisma.productVariant.update>
  > = [];

  for (const product of products) {
    const manualRule = manualAdeiLeadTimeRule(product);
    if (manualRule) {
      operations.push(
        prisma.product.update({
          where: { id: product.id },
          data: { leadTime: manualRule.productLeadTime },
        }),
      );

      if (manualRule.variantLeadTime) {
        for (const variant of product.variants) {
          const variantLeadTime = manualRule.variantLeadTime(variant.code);
          if (!variantLeadTime) continue;
          operations.push(
            prisma.productVariant.update({
              where: { id: variant.id },
              data: { leadTime: variantLeadTime },
            }),
          );
          updatedVariants += 1;
        }
      } else {
        for (const variant of product.variants) {
          operations.push(
            prisma.productVariant.update({
              where: { id: variant.id },
              data: { leadTime: manualRule.productLeadTime },
            }),
          );
          updatedVariants += 1;
        }
      }

      updatedProducts += 1;
      continue;
    }

    const matched = resolveLeadTime(product, rows);
    if (!matched) {
      skippedProducts += 1;
      continue;
    }

    const customerWeeks = matched.weeks + OYSTE_LEAD_TIME_BUFFER_WEEKS;
    const leadTime = formatWeeks(customerWeeks);
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
