function endpoint(value: string) {
  const normalized = value.trim().toLowerCase();
  const [label, ...domain] = normalized.split(".");
  return [label.replace(/-pooler$/, ""), ...domain].join(".");
}

export function verifiedDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const value = env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL est manquante.");
  if (env.VERCEL_ENV !== "preview" && env.OYSTE_STOCKMAN_TEST !== "true") return value;

  const test = env.OYSTE_TEST_DB_HOST;
  const production = env.OYSTE_PRODUCTION_DB_HOST;
  const dedicatedPreview = env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === "recette-stockman-isolee"
    && env.OYSTE_STOCKMAN_TEST === "true";
  const database = env.OYSTE_TEST_DB_NAME;
  const role = env.OYSTE_TEST_DB_ROLE;
  const url = new URL(value);
  const allowedParameters = new Set(["sslmode", "channel_binding", "uselibpqcompat"]);
  if (!test || (!production && !dedicatedPreview) || !database || !role
    || (production && endpoint(test) === endpoint(production))
    || endpoint(url.hostname) !== endpoint(test)
    || (production && endpoint(url.hostname) === endpoint(production))
    || decodeURIComponent(url.pathname.slice(1)) !== database || decodeURIComponent(url.username) !== role
    || (url.protocol !== "postgresql:" && url.protocol !== "postgres:")
    || (dedicatedPreview && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? ""))
    || (url.port || "5432") !== (env.OYSTE_TEST_DB_PORT ?? "5432")
    || [...url.searchParams.keys()].some(key => !allowedParameters.has(key))) {
    throw new Error("Connexion refusée : la base de test isolée doit correspondre à l’hôte, à la base et au rôle configurés.");
  }
  return value;
}
