import { prisma } from "@/lib/db/prisma";

type CategoryCandidate = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
};

export type StockmanCategoryResolution = {
  id: string;
  name: string;
  slug: string;
  reason: string;
};

type PreciseRule = {
  path: string;
  markers: RegExp[];
  reason: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[%_+]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-") || "sans-nom";
}

function categoryText(category: CategoryCandidate) {
  return normalize([category.slug, category.name, category.path].filter(Boolean).join(" "));
}

/*
 * IMPORTANT : la base historique OYSTE ne contient pas encore une ligne Category
 * pour chaque sous-famille du catalogue. Plusieurs chemins ont été regroupés sous
 * un même slug racine (ex. manutention-au-sol), ce qui explique le faux chemin
 * "Cric et vérin\\Vérin" vu en V2.10.0.
 *
 * Ces règles utilisent les chemins DEJA présents dans data/catalogue/products.json.
 * Si la ligne précise n'existe pas encore dans Category, elle est matérialisée à
 * partir de cette taxonomie OYSTE, sans inventer une nouvelle famille commerciale.
 */
const PRECISE_RULES: PreciseRule[] = [
  {
    path: "Manutention au sol\\Grue d'atelier\\Grue d'atelier éléctrique",
    markers: [
      /\bgrue\b.*\batelier\b.*\b(?:electrique|electriques|telecommande)\b/,
      /\bscp05e(?:e|et)?(?: 1000)?\b/,
    ],
    reason: "sous-famille OYSTE Grue d’atelier > Grue d’atelier électrique",
  },
  {
    path: "Manutention au sol\\Grue d'atelier\\Grue d'atelier porte à faux",
    markers: [
      /\bgrue\b.*\batelier\b.*\bporte\b.*\bfaux\b.*\bmanuel/,
      /\bscp05m\b/,
    ],
    reason: "sous-famille OYSTE Grue d’atelier > Grue d’atelier porte à faux",
  },
  {
    path: "Manutention au sol\\Grue d'atelier",
    markers: [
      /\baccessoires?\b.*\bgrues?\b.*\batelier\b/,
      /\brallonge\b.*\bbras\b.*\bgrue/,
      /\brallonge\b.*\b(?:scp05m304|scp05m)\b/,
      /\bpzg[ -]?aisi\b/,
      /\bgrues?\b.*\batelier\b/,
    ],
    reason: "famille OYSTE Grue d’atelier issue de la structure commerciale STOCKMAN",
  },
  {
    path: "Manutention au sol\\Gerbeur\\Gerbeur éléctrique",
    markers: [/\bgerbeur\b.*\b(?:electrique|lithium)\b/, /\bgerbeur\s+electrique\b/],
    reason: "sous-famille OYSTE Gerbeur > Gerbeur électrique",
  },
  {
    path: "Manutention au sol\\Gerbeur\\Gerbeur manuel",
    markers: [/\bgerbeur\s+manuel\b/],
    reason: "sous-famille OYSTE Gerbeur > Gerbeur manuel",
  },
  {
    path: "Manutention au sol\\Transpalette\\Transpalette électrique",
    markers: [/\btranspalette\b.*\b(?:electrique|lithium)\b/, /\btranspalette\s+electrique\b/],
    reason: "sous-famille OYSTE Transpalette > Transpalette électrique",
  },
  {
    path: "Manutention au sol\\Transpalette\\Transpalette manuel",
    markers: [/\btranspalette\s+manuel\b/],
    reason: "sous-famille OYSTE Transpalette > Transpalette manuel",
  },
];

const FAMILY_RULES: Array<{ path: string; markers: RegExp[]; reason: string }> = [
  {
    path: "Manutention au sol",
    markers: [/\bgerbeur/, /\btranspalette/, /\bdiable/, /\bchariot/, /\bgamme\s+magasinage/],
    reason: "famille Stockman de manutention au sol",
  },
  {
    path: "Levage",
    markers: [/\bpalan/, /\bportique/, /\bpotence/, /\btripode/, /\bcrics?\b/, /\baccessoires?\s+de\s+levage/],
    reason: "famille Stockman de levage",
  },
  {
    path: "Stockage et emballage",
    markers: [/\bemballage/, /\bcerclage/, /\bderouleur/, /\bconvoyeur/, /\betagere/, /\brack\s+de\s+stockage/, /\bequipement\s+de\s+quai/],
    reason: "famille Stockman de stockage ou emballage",
  },
  {
    path: "Accès en hauteur",
    markers: [/\bacces\s+en\s+hauteur/, /\bescabeau/, /\bmarchepied/, /\bnacelle/],
    reason: "famille Stockman d’accès en hauteur",
  },
];

async function ensureCategoryForPath(path: string, reason: string): Promise<StockmanCategoryResolution> {
  const leafName = path.split("\\").filter(Boolean).at(-1) || path;
  const preciseSlug = `oyste-${slugify(path)}`;

  const existing = await prisma.category.findFirst({
    where: {
      OR: [
        { path: { equals: path, mode: "insensitive" } },
        { slug: preciseSlug },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  if (existing) return { ...existing, reason };

  const created = await prisma.category.create({
    data: {
      name: leafName,
      slug: preciseSlug,
      path,
      isActive: true,
    },
    select: { id: true, name: true, slug: true },
  });
  return { ...created, reason: `${reason} (catégorie précise matérialisée depuis la taxonomie OYSTE)` };
}

export async function resolveStockmanCategory(input: {
  sourceUrl?: string | null;
  designation?: string | null;
  categoryHint?: string | null;
}): Promise<StockmanCategoryResolution | null> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, path: true },
  });

  let decodedUrl = input.sourceUrl ?? "";
  try {
    decodedUrl = decodeURIComponent(decodedUrl);
  } catch {
    // Une URL mal encodée ne doit jamais bloquer l'import.
  }

  const haystack = normalize([
    input.designation,
    input.categoryHint,
    decodedUrl,
  ].filter(Boolean).join(" "));

  // 1. Toujours privilégier une sous-famille métier précise.
  for (const rule of PRECISE_RULES) {
    if (rule.markers.some((marker) => marker.test(haystack))) {
      return ensureCategoryForPath(rule.path, rule.reason);
    }
  }

  // 2. Un hint Stockman peut déjà correspondre exactement à un chemin OYSTE.
  const directHint = normalize(input.categoryHint);
  if (directHint) {
    const exact = categories.find((category) =>
      [normalize(category.name), normalize(category.slug), normalize(category.path)]
        .filter(Boolean)
        .includes(directHint),
    );
    if (exact) return { id: exact.id, name: exact.name, slug: exact.slug, reason: "correspondance exacte avec la catégorie Stockman" };
  }

  // 3. Recherche lexicale : le chemin le plus spécifique gagne.
  const lexical = categories
    .map((category) => ({ category, text: categoryText(category) }))
    .filter(({ text }) => text.length >= 5 && haystack.includes(text))
    .sort((a, b) => b.text.length - a.text.length)[0]?.category;
  if (lexical) {
    return { id: lexical.id, name: lexical.name, slug: lexical.slug, reason: "correspondance lexicale avec une catégorie OYSTE existante" };
  }

  // 4. Seulement en dernier recours, rattachement à une famille racine.
  for (const rule of FAMILY_RULES) {
    if (!rule.markers.some((marker) => marker.test(haystack))) continue;
    const exactPath = categories.find((category) => normalize(category.path) === normalize(rule.path));
    if (exactPath) {
      return { id: exactPath.id, name: exactPath.name, slug: exactPath.slug, reason: rule.reason };
    }
    // Si la racine métier n'existe pas encore en BDD, on la matérialise.
    // Une catégorie reconnue par Stockman ne doit jamais être perdue à l'import.
    return ensureCategoryForPath(rule.path, rule.reason);
  }

  return null;
}
