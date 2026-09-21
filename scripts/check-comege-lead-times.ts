import "dotenv/config";

const COMEGE_LOGIN_URL = "https://www.comege.fr/";
const LEAD_TIME_URL = "https://www.comege.fr/fr/delais-produits-standard";

const USERNAME_FIELD = "m592femams_input_username";
const PASSWORD_FIELD = "m592femams_input_password";

type CookieJar = Map<string, string>;

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
  const pattern =
    /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

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

function extractSetCookieHeaders(headers: Headers) {
  const nodeHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof nodeHeaders.getSetCookie === "function") {
    return nodeHeaders.getSetCookie();
  }

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
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function requireCredentials() {
  const username = process.env.COMEGE_LOGIN?.trim();
  const password = process.env.COMEGE_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error(
      "COMEGE_LOGIN et COMEGE_PASSWORD sont absents de l'environnement.",
    );
  }

  return { username, password };
}

function extractTableRows(html: string, tableId: string) {
  const escapedId = tableId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const table =
    html.match(
      new RegExp(
        `<table\\b[^>]*id=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/table>`,
        "i",
      ),
    )?.[1] ?? null;

  if (!table) return [];

  const rows: string[][] = [];

  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi),
    ].map((match) => decodeHtml(match[1]));

    if (cells.length) rows.push(cells);
  }

  return rows;
}

function listTableIds(html: string) {
  const result: string[] = [];

  for (const match of html.matchAll(/<table\b[^>]*>/gi)) {
    const attrs = parseHtmlAttributes(match[0]);
    result.push(attrs.get("id") || "(sans id)");
  }

  return result;
}

async function main() {
  const { username, password } = requireCredentials();
  const jar: CookieJar = new Map();

  const commonHeaders = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "OYSTE COMEGE delay diagnostic",
  };

  console.log("\nOYSTE — diagnostic délais COMEGE");
  console.log("--------------------------------");
  console.log("Mode : LECTURE SEULE");
  console.log("Aucune écriture DB ne sera effectuée.\n");

  console.log("1) Ouverture de la page de connexion...");
  const loginPage = await fetch(COMEGE_LOGIN_URL, {
    cache: "no-store",
    headers: commonHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });

  console.log(`   HTTP ${loginPage.status}`);
  if (!loginPage.ok) {
    throw new Error(
      `Page de connexion COMEGE indisponible (${loginPage.status}).`,
    );
  }

  mergeCookies(jar, loginPage.headers);

  const loginHtml = await loginPage.text();
  const fields = extractLoginFormFields(loginHtml);

  console.log(
    `   CSRF : ${
      fields.has("xt_csrf_name") && fields.has("xt_csrf_token")
        ? "OK"
        : "ABSENT"
    }`,
  );

  if (!fields.has("xt_csrf_name") || !fields.has("xt_csrf_token")) {
    throw new Error("Jeton CSRF COMEGE introuvable.");
  }

  fields.set(USERNAME_FIELD, username);
  fields.set(PASSWORD_FIELD, password);

  console.log("\n2) Connexion COMEGE...");
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

  console.log(`   HTTP ${loginResponse.status}`);
  console.log(
    `   Redirection : ${loginResponse.headers.get("location") || "(aucune)"}`,
  );

  if (loginResponse.status >= 400) {
    throw new Error(`Connexion COMEGE refusée (${loginResponse.status}).`);
  }

  mergeCookies(jar, loginResponse.headers);

  console.log("\n3) Lecture de la page des délais...");
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

  console.log(`   HTTP ${response.status}`);

  if (!response.ok) {
    throw new Error(`Source délais COMEGE indisponible (${response.status}).`);
  }

  const html = await response.text();

  if (/m592femams_input_password/i.test(html) && !/tbl_delais/i.test(html)) {
    throw new Error("La page des délais demande encore une authentification.");
  }

  const tableIds = listTableIds(html);
  console.log(
    `   Tables détectées : ${tableIds.length} (${tableIds.join(", ")})`,
  );

  const rows = extractTableRows(html, "tbl_delais");

  console.log("\n4) Contenu BRUT de #tbl_delais");
  console.log("--------------------------------");

  if (!rows.length) {
    console.log("Aucune ligne trouvée dans #tbl_delais.");
    process.exitCode = 2;
    return;
  }

  rows.forEach((cells, index) => {
    console.log(`${String(index + 1).padStart(2, "0")} | ${cells.join(" | ")}`);
  });

  console.log("\n5) Interprétation familles → semaines");
  console.log("--------------------------------------");

  let parsed = 0;

  for (const cells of rows) {
    if (cells.length < 2) continue;

    const sourceLabel = cells[0]?.trim();
    const weeksMatch = cells[1]?.match(/(\d+)\s*semaine/i);

    if (!sourceLabel || !weeksMatch) continue;

    const supplierWeeks = Number(weeksMatch[1]);
    const oysteWeeks = supplierWeeks + 1;

    console.log(
      `COMEGE ${String(supplierWeeks).padStart(2, " ")} sem. → OYSTE ${String(
        oysteWeeks,
      ).padStart(2, " ")} sem. | ${sourceLabel}`,
    );

    parsed += 1;
  }

  console.log("\nRésumé");
  console.log(`- lignes HTML #tbl_delais : ${rows.length}`);
  console.log(`- règles interprétables : ${parsed}`);
  console.log("- écritures DB : 0");
  console.log("\nDiagnostic terminé.");
}

main().catch((error) => {
  console.error("\nERREUR :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
