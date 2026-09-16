import { NextRequest, NextResponse } from "next/server";
import productsData from "@/data/catalogue/products.json";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { openStockmanBrowser } from "@/lib/suppliers/stockman/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LegacyProduct = {
  code?: string;
  parentCode?: string;
  categoryPath?: string;
};

const legacyProducts = productsData as LegacyProduct[];

// V2.10.20.17 — la taxonomie OYSTE ne se limite pas aux feuilles qui portent déjà
// un produit dans products.json. Les parents de ces feuilles sont eux aussi des branches
// existantes et peuvent servir de destination sûre au diagnostic breadcrumb.
const KNOWN_CATEGORY_PATHS = new Map<string, string>();
for (const item of legacyProducts) {
  const categoryPath = item.categoryPath?.trim();
  if (!categoryPath) continue;
  const parts = categoryPath.split("\\").map((part) => part.trim()).filter(Boolean);
  for (let depth = 1; depth <= parts.length; depth += 1) {
    const path = parts.slice(0, depth).join("\\");
    KNOWN_CATEGORY_PATHS.set(normalized(path), path);
  }
}

function knownCategoryPath(path: string) {
  return KNOWN_CATEGORY_PATHS.get(normalized(path)) ?? null;
}

async function refreshKnownCategoryPathsFromDatabase() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, path: true, parentId: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  const memo = new Map<string, string>();

  const resolvePath = (id: string, visiting = new Set<string>()): string => {
    const cached = memo.get(id);
    if (cached) return cached;
    const category = byId.get(id);
    if (!category || visiting.has(id)) return "";

    const explicit = category.path?.trim();
    if (explicit) {
      memo.set(id, explicit);
      return explicit;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);
    const parentPath = category.parentId ? resolvePath(category.parentId, nextVisiting) : "";
    const resolved = [parentPath, category.name?.trim()].filter(Boolean).join("\\");
    memo.set(id, resolved);
    return resolved;
  };

  for (const category of categories) {
    const path = resolvePath(category.id);
    if (!path) continue;
    const parts = path.split("\\").map((part) => part.trim()).filter(Boolean);
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const candidate = parts.slice(0, depth).join("\\");
      KNOWN_CATEGORY_PATHS.set(normalized(candidate), candidate);
    }
  }
}


type ManualCategoryOverride = {
  categoryId: string;
  categoryPath: string;
  breadcrumbKey: string;
  breadcrumb: string[];
  updatedAt: string;
};

function cloneSourceData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function getStockmanData(value: unknown): Record<string, unknown> {
  const source = cloneSourceData(value);
  const stockman = source.stockman;
  return stockman && typeof stockman === "object" && !Array.isArray(stockman)
    ? (stockman as Record<string, unknown>)
    : {};
}

function getManualCategoryOverride(value: unknown): ManualCategoryOverride | null {
  const candidate = getStockmanData(value).categoryOverride;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const raw = candidate as Record<string, unknown>;
  const categoryId = typeof raw.categoryId === "string" ? raw.categoryId : "";
  const categoryPath = typeof raw.categoryPath === "string" ? raw.categoryPath : "";
  const breadcrumbKeyValue = typeof raw.breadcrumbKey === "string" ? raw.breadcrumbKey : "";
  const breadcrumb = Array.isArray(raw.breadcrumb)
    ? raw.breadcrumb.filter((item): item is string => typeof item === "string")
    : [];
  if (!categoryId || !categoryPath || !breadcrumbKeyValue) return null;
  return {
    categoryId,
    categoryPath,
    breadcrumbKey: breadcrumbKeyValue,
    breadcrumb,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function makeBreadcrumbKey(levels: string[]) {
  return normalized(levels.join(" > "));
}

async function listCategoryOptions() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, path: true, parentId: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const byId = new Map(categories.map((category) => [category.id, category]));
  const memo = new Map<string, string>();

  const resolve = (id: string, visiting = new Set<string>()): string => {
    const cached = memo.get(id);
    if (cached) return cached;
    const category = byId.get(id);
    if (!category || visiting.has(id)) return "";
    if (category.path?.trim()) {
      memo.set(id, category.path.trim());
      return category.path.trim();
    }
    const next = new Set(visiting);
    next.add(id);
    const parentPath = category.parentId ? resolve(category.parentId, next) : "";
    const path = [parentPath, category.name.trim()].filter(Boolean).join("\\");
    memo.set(id, path);
    return path;
  };

  return categories
    .map((category) => ({ id: category.id, name: category.name, path: resolve(category.id) }))
    .filter((category) => category.path)
    .sort((a, b) => a.path.localeCompare(b.path, "fr"));
}

function slugifyCategory(value: string) {
  return normalized(value).replace(/\s+/g, "-") || `categorie-${Date.now()}`;
}

async function ensureCategoryPath(path: string) {
  const parts = path.split("\\").map((part) => part.trim()).filter(Boolean);
  let parentId: string | null = null;
  let currentPath = "";

  for (const name of parts) {
    currentPath = currentPath ? `${currentPath}\\${name}` : name;
    const existing: { id: string; path: string | null } | null =
      await prisma.category.findFirst({
        where: {
          OR: [
            { path: currentPath },
            { AND: [{ name }, { parentId }] },
          ],
        },
        select: { id: true, path: true },
      });

    if (existing) {
      parentId = existing.id;
      if (!existing.path) {
        await prisma.category.update({ where: { id: existing.id }, data: { path: currentPath } });
      }
      continue;
    }

    let slug = slugifyCategory(currentPath);
    let suffix = 2;
    while (await prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slugifyCategory(currentPath)}-${suffix++}`;
    }

    const created: { id: string } = await prisma.category.create({
      data: { name, slug, path: currentPath, parentId, isActive: true },
      select: { id: true },
    });
    parentId = created.id;
  }
}

function sourceUrlFromData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const stockman = (value as Record<string, unknown>).stockman;
  if (!stockman || typeof stockman !== "object" || Array.isArray(stockman)) return "";
  return typeof (stockman as Record<string, unknown>).sourceUrl === "string"
    ? String((stockman as Record<string, unknown>).sourceUrl)
    : "";
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function legacyCategory(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const exact = legacyProducts.find((item) => item.code?.trim().toUpperCase() === normalizedCode);
  if (exact?.categoryPath) return exact.categoryPath;
  const parent = legacyProducts.find((item) => item.parentCode?.trim().toUpperCase() === normalizedCode);
  return parent?.categoryPath || null;
}

const PRECISE_EXISTING_RULES: Array<{ markers: string[]; path: string; reason: string }> = [
  { markers: ["diables-leve-charges-encombrantes"], path: "Manutention au sol\\Diable\\Diable aluminium et inox", reason: "chemin Stockman + taxonomie OYSTE existante : diable aluminium" },
  { markers: ["leve-futs"], path: "Manutention au sol\\Chariot et servante\\Chariot porte-fût", reason: "chemin Stockman + taxonomie OYSTE existante : chariot porte-fût" },
  { markers: ["transpalettes-peseurs"], path: "Manutention au sol\\Transpalette\\Transpalette peseur", reason: "chemin Stockman + taxonomie OYSTE existante : transpalette peseur" },
  { markers: ["plateformes-motorisees"], path: "Manutention au sol\\Chariot et servante\\Plateforme motorisée", reason: "chemin Stockman + taxonomie OYSTE existante : plateforme motorisée" },
  { markers: ["grues-repliables-et-transformables-miload"], path: "Manutention au sol\\Grue d'atelier\\Grue d'atelier porte à faux", reason: "chemin Stockman + taxonomie OYSTE existante : grue d'atelier porte à faux" },
  { markers: ["nacelles-magasinage"], path: "Accès en hauteur\\Nacelle", reason: "chemin Stockman + taxonomie OYSTE existante : nacelle" },
  { markers: ["chariots-porte-panneaux"], path: "Manutention au sol\\Chariot et servante\\Chariot porte panneau", reason: "chemin Stockman + taxonomie OYSTE existante : chariot porte panneau" },
  { markers: ["electric-lithium-pallet-trucks", "electric-pallet-truck"], path: "Manutention au sol\\Transpalette\\Transpalette éléctrique", reason: "chemin Stockman + taxonomie OYSTE existante : transpalette électrique" },
];

const URL_RULES: Array<{ markers: string[]; path: string; reason: string }> = [
  { markers: ["elevateurs-leve-charge-manuels", "elevateur-leve-charge"], path: "Levage\\Élévateur de charge", reason: "chemin Stockman élévateurs lève-charge" },
  { markers: ["palans-electriques", "palans-manuels", "palans-et-accessoires-de-levage"], path: "Levage\\Palan", reason: "chemin Stockman palans" },
  { markers: ["gerbeurs-electriques", "gerbeurs-manuels", "gerbeurs-et-elevateurs-leve-charge"], path: "Manutention au sol\\Gerbeur", reason: "chemin Stockman gerbeurs" },
  { markers: ["transpalettes-electriques", "transpalettes-manuels", "transpalettes-haute-levee", "transpalettes--"], path: "Manutention au sol\\Transpalette", reason: "chemin Stockman transpalettes" },
  { markers: ["diables-acier", "diables-monte-escaliers", "diables-porte-bouteilles"], path: "Manutention au sol\\Diable", reason: "chemin Stockman diables" },
  { markers: ["chariots-et-servantes"], path: "Manutention au sol\\Chariot et servante", reason: "chemin Stockman chariots et servantes" },
  { markers: ["grues-datelier"], path: "Manutention au sol\\Grue d'atelier", reason: "chemin Stockman grues d'atelier" },
  { markers: ["tables-elevatrices"], path: "Manutention au sol\\Table élévatrice", reason: "chemin Stockman tables élévatrices" },
  { markers: ["tracteurs", "tireur", "pousseur"], path: "Manutention au sol\\Tireur pousseur", reason: "chemin Stockman tracteurs/tireurs" },
  { markers: ["feuillards-et-consommables", "emballage"], path: "Stockage et emballage", reason: "chemin Stockman emballage" },
  { markers: ["equipement-de-quai", "presentoirs-et-etageres", "pont-de-chargement"], path: "Stockage et emballage", reason: "chemin Stockman stockage/quai" },
  { markers: ["escabeaux", "marchepieds", "acces-en-hauteur"], path: "Accès en hauteur", reason: "chemin Stockman accès en hauteur" },
];

function proposedCategory(code: string, sourceUrl: string, name: string) {
  const fromLegacy = legacyCategory(code);
  if (fromLegacy) return { path: fromLegacy, reason: "taxonomie OYSTE historique correspondant à la famille" };

  const haystack = normalized(`${sourceUrl} ${name}`).replace(/\s/g, "-");

  for (const rule of PRECISE_EXISTING_RULES) {
    if (!rule.markers.some((marker) => haystack.includes(marker))) continue;
    const existingPath = knownCategoryPath(rule.path);
    if (existingPath) return { path: existingPath, reason: rule.reason };
  }

  for (const rule of URL_RULES) {
    if (rule.markers.some((marker) => haystack.includes(marker))) {
      return { path: rule.path, reason: rule.reason };
    }
  }
  return { path: null, reason: "aucune catégorie précise proposée automatiquement" };
}

function pathDepth(path: string | null) {
  return (path || "").split("\\").map((part) => part.trim()).filter(Boolean).length;
}

const PRODUCT_ACCESSORY_URL_MARKERS = [
  "options-et-accessoires-diables-electriques-et-ergonomiques",
  "workshop-crane-accessories",
];

const PRODUCT_ACCESSORY_PREFIXES = [
  "chargeur ",
  "station de chargement",
  "support ",
  "bequille ",
  "poignee auxiliaire",
  "porte-bonbonne",
  "porte chaise",
  "fixation ",
  "fixations ",
  "rampe ",
  "grande bavette",
  "glissiere ",
  "batterie ",
  "extensions laterales",
  "rallonge ",
  "roue avant ",
  "roue arriere ",
  "kit stabilisateur",
  "kit de nivellement",
  "pompe a main",
  "crochet ",
  "compartiment a outils",
];

function productKind(name: string, sourceUrl: string) {
  const text = normalized(name);
  const url = sourceUrl.toLowerCase();
  if (text.includes("produit arrete")) return "discontinued" as const;
  if (PRODUCT_ACCESSORY_URL_MARKERS.some((marker) => url.includes(marker))) return "accessory" as const;
  if (PRODUCT_ACCESSORY_PREFIXES.some((marker) => text.startsWith(normalized(marker)))) return "accessory" as const;
  return "product" as const;
}

function categoryVeto(name: string, proposed: string | null, reason: string) {
  // Une correspondance explicite avec la taxonomie historique OYSTE est prioritaire.
  // Le veto métier protège uniquement contre les classifications déduites du chemin Stockman.
  if (reason.startsWith("taxonomie OYSTE historique")) return null;
  const text = normalized(name);
  if (!proposed) return null;

  const accessoryPatterns = [
    "chargeur ",
    "station de chargement",
    "rallonge ",
    "roue avant ",
    "roue arriere ",
    "kit stabilisateur",
    "kit de stabilisateur",
    "support ",
    "plateau ",
    "jeu de roulettes",
  ];
  if (accessoryPatterns.some((marker) => text.startsWith(normalized(marker)))) {
    return "désignation métier d'accessoire : le chemin Stockman ne peut pas imposer la catégorie de la machine porteuse";
  }

  // « Levage magnétique » est une famille métier de levage, pas un palan par nature.
  if (text.startsWith("levage magnetique") && normalized(proposed).includes("palan")) {
    return "désignation métier incompatible avec un classement automatique en palan";
  }

  return null;
}

function categoryDecision(
  current: string | null,
  proposed: string | null,
  reason: string,
  veto: string | null,
  kind: "product" | "accessory" | "discontinued",
) {
  if (kind === "accessory") return { needsReview: false, confidence: "accessory_product" as const };
  if (kind === "discontinued") return { needsReview: false, confidence: "discontinued_product" as const };
  if (veto) return { needsReview: false, confidence: "semantic_veto" as const };
  if (!proposed) {
    if (current && pathDepth(current) >= 2) {
      return { needsReview: false, confidence: "kept_existing_precise" as const };
    }
    return { needsReview: false, confidence: "unresolved" as const };
  }
  if (normalized(proposed) === normalized(current || "")) return { needsReview: false, confidence: "already_correct" as const };
  if (!current || normalized(current) === "manutention au sol" || normalized(current) === "levage") {
    return { needsReview: true, confidence: "high" as const };
  }
  // La taxonomie historique OYSTE est notre source la plus fiable, y compris pour un changement de branche.
  if (reason.startsWith("taxonomie OYSTE historique")) return { needsReview: true, confidence: "high" as const };

  const currentNorm = normalized(current);
  const proposedNorm = normalized(proposed);
  // Une règle Stockman peut préciser une catégorie existante, jamais la remonter vers un parent plus générique.
  if (proposedNorm.startsWith(`${currentNorm} `) && pathDepth(proposed) > pathDepth(current)) {
    return { needsReview: true, confidence: "high" as const };
  }
  return { needsReview: false, confidence: "kept_more_specific" as const };
}

const STRONG_ACCESSORY_PREFIXES = [
  "support ", "support v ", "support projecteur", "plateau ", "grand plateau", "petit plateau",
  "kit roues", "kit roue", "jeu de roulettes", "roue avant", "roue arriere",
  "pied stabilisateur", "pieds stabilisateurs", "trois pieds", "quatre pieds",
  "rallonge ", "dosseret", "sangle ", "bac ", "bavette ", "capot ", "protection ",
  "station de chargement",
];

function variantKind(name: string) {
  const text = normalized(name);
  if (text.includes("produit arrete")) return "discontinued" as const;
  // Haute confiance uniquement : on exige une désignation qui décrit elle-même un accessoire.
  // Les mentions batterie/roues/fourches dans la désignation d'une machine ne suffisent jamais.
  if (STRONG_ACCESSORY_PREFIXES.some((marker) => text.startsWith(normalized(marker)))) return "accessory" as const;
  return "variant" as const;
}


function validateStockmanPageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/(^|\.)stockman\.fr$/i.test(url.hostname)) {
    throw new Error("URL Stockman invalide.");
  }
  return url.toString();
}

const BREADCRUMB_ACCESSORY_MARKERS: RegExp[] = [
  /\boptions?\s+et\s+accessoires?\b/,
  /\baccessoires?\s+pour\b/,
  /\baccessoires?\s+de\b/,
  /\bpieces?\s+detachees?\b/,
];

function breadcrumbLooksLikeAccessory(levels: string[]) {
  // Le mot "accessoires" dans une branche parente ne suffit pas :
  // "Palans et accessoires de levage > Palans électriques" est bien un palan.
  // On qualifie l'accessoire sur le niveau métier le plus précis uniquement.
  const leaf = normalized(levels.at(-1) || "");
  return BREADCRUMB_ACCESSORY_MARKERS.some((marker) => marker.test(leaf));
}

const BREADCRUMB_RULES: Array<{ markers: RegExp[]; paths: string[]; reason: string }> = [
  {
    markers: [/\bpresses?\s+hydrauliques?\b/],
    paths: ["Équipement d'atelier\\Presse hydraulique"],
    reason: "breadcrumb Stockman réel : presses hydrauliques",
  },
  {
    markers: [/\bchariots?\s+retractables?\b/],
    paths: ["Manutention au sol\\Chariot élévateur\\Chariot à mât rétractable"],
    reason: "breadcrumb Stockman réel : chariots à mât rétractable",
  },

  // V2.10.20.17 — familles restantes : destinations candidates validées uniquement
  // si elles existent réellement dans la taxonomie OYSTE chargée depuis la base.
  {
    markers: [/\bpresses?\s+hydrauliques?\b/],
    paths: ["Équipement d'atelier\\Presse hydraulique", "Equipement d'atelier\\Presse hydraulique", "Presse hydraulique"],
    reason: "breadcrumb Stockman réel : presses hydrauliques",
  },
  {
    markers: [/\bchariots?\s+retractables?\b/],
    paths: ["Manutention au sol\\Chariot élévateur\\Chariot rétractable", "Manutention au sol\\Chariot rétractable", "Chariot élévateur\\Chariot rétractable", "Chariot rétractable"],
    reason: "breadcrumb Stockman réel : chariots à mât rétractable",
  },
  // V2.10.20.17 — règles les plus spécifiques en premier.
  // V2.10.20.17 — derniers mappings sûrs vers des branches OYSTE existantes.
  {
    markers: [/\bchariots?\s+porte[- ]palans?\b/, /\bgriffes?\s+d.?accrochage\b/],
    paths: ["Levage\\Chariot porte palan"],
    reason: "breadcrumb Stockman réel : chariots porte-palans / griffes d’accrochage",
  },
  {
    markers: [/\bpoteaux?\b.*\bprotection\b/, /\barceaux?\b.*\bprotection\b/, /\blisses?\b.*\bprotection\b/],
    paths: ["Stockage et emballage\\Équipement de quai"],
    reason: "breadcrumb Stockman réel : protection de quai / stockage",
  },
  {
    markers: [/\bpresentoirs?\s+et\s+etageres?\b/, /\bracks?\s+de\s+stockage\b/],
    paths: ["Stockage et emballage"],
    reason: "breadcrumb Stockman réel : présentoirs / étagères / rayonnages",
  },
  {
    markers: [/\bfeuillards?\s+et\s+consommables?\b/],
    paths: ["Stockage et emballage"],
    reason: "breadcrumb Stockman réel : feuillards / consommables d’emballage",
  },
  {
    markers: [/\bdevidoirs?\b/],
    paths: ["Stockage et emballage\\Dérouleurs", "Stockage et emballage"],
    reason: "breadcrumb Stockman réel : dévidoirs / dérouleurs",
  },
  {
    markers: [/\belevateurs?\s+leve[- ]charge\s+manuels?\b/],
    paths: ["Levage\\Élévateur de charge"],
    reason: "breadcrumb Stockman réel : élévateurs lève-charge manuels",
  },
  {
    markers: [/\bpalans?\s+electriques?\b/],
    paths: ["Levage\\Palan\\Palan électrique"],
    reason: "breadcrumb Stockman réel : palans électriques",
  },
  {
    markers: [/\blevage\s+magnetique\b/],
    paths: ["Levage\\Accessoires de levage\\Porteur magnétique"],
    reason: "breadcrumb Stockman réel : levage magnétique",
  },
  {
    markers: [/\btrans[- ]gerbeurs?\b/],
    paths: ["Manutention au sol\\Gerbeur\\Gerbeur éléctrique"],
    reason: "breadcrumb Stockman réel : trans-gerbeurs",
  },
  {
    markers: [/\bgerbeurs?\s+embarques?\s+autonomes?\b/],
    paths: ["Manutention au sol\\Gerbeur\\Gerbeur éléctrique"],
    reason: "breadcrumb Stockman réel : gerbeurs embarqués autonomes",
  },

  {
    markers: [/\bchariots?\s+et\s+servantes?\b/],
    paths: ["Manutention au sol\\Chariot et servante\\Chariot"],
    reason: "breadcrumb Stockman réel : chariots et servantes",
  },
  {
    markers: [/\bdiables?\s+acier\b/],
    paths: ["Manutention au sol\\Diable\\Diable acier"],
    reason: "breadcrumb Stockman réel : diables acier",
  },
  {
    markers: [/\bdiables?\s+monte[- ]escaliers?\b/],
    paths: ["Manutention au sol\\Diable\\Diable escaliers"],
    reason: "breadcrumb Stockman réel : diables monte-escaliers",
  },
  {
    markers: [/\bponts?\s+de\s+chargement\b/],
    paths: ["Stockage et emballage\\Équipement de quai"],
    reason: "breadcrumb Stockman réel : équipement / pont de chargement",
  },
  {
    markers: [/\blevage\s+magnetique\b/],
    paths: ["Levage\\Accessoires de levage\\Porteur magnétique"],
    reason: "breadcrumb Stockman réel : levage magnétique",
  },
  {
    markers: [/\bplateaux?\s+roulants?\b/],
    paths: ["Manutention au sol\\Chariot et servante\\Plateau roulant"],
    reason: "breadcrumb Stockman réel : plateaux roulants",
  },
  {
    markers: [/\btranspalettes?\s+tout[- ]terrain\b/],
    paths: ["Manutention au sol\\Transpalette\\Transpalette spéciaux"],
    reason: "breadcrumb Stockman réel : transpalette tout-terrain",
  },
  {
    markers: [/\btranspalettes?\s+manuels?\b/],
    paths: ["Manutention au sol\\Transpalette\\Transpalette manuel"],
    reason: "breadcrumb Stockman réel : transpalettes manuels",
  },
  {
    markers: [/\btables?\s+elevatrices?.*\belectriques?\b/],
    paths: ["Manutention au sol\\Table élévatrice\\Table élévatrice éléctrique"],
    reason: "breadcrumb Stockman réel : tables élévatrices électriques",
  },
  {
    markers: [/\btables?\s+elevatrices?\s+tout\s+terrain\b/],
    paths: ["Manutention au sol\\Table élévatrice\\Table élévatrice manuel"],
    reason: "breadcrumb Stockman réel : table élévatrice manuelle tout-terrain",
  },
  {
    markers: [/\bpalans?\s+electriques?\b/],
    paths: ["Levage\\Palan\\Palan électrique"],
    reason: "breadcrumb Stockman réel : palans électriques",
  },
  {
    markers: [/\btracteurs?\b/],
    paths: ["Manutention au sol\\Tireur pousseur"],
    reason: "breadcrumb Stockman réel : tracteurs",
  },
  {
    markers: [/\bpresentoirs?\s+et\s+etageres?\b/, /\brayonnages?\b/],
    paths: ["Stockage\\Rayonnage", "Manutention au sol\\Rayonnage"],
    reason: "breadcrumb Stockman réel : présentoirs / étagères / rayonnages",
  },
  {
    markers: [/\btracteurs?\s+pousseurs?\s+electriques?\b/],
    paths: ["Manutention au sol\\Tireur pousseur"],
    reason: "breadcrumb Stockman réel : tracteurs pousseurs électriques",
  },
  {
    markers: [/\bdiables?\s+monte[- ]escaliers?\s+electriques?\b/, /\bdiables?\s+electriques?\b/],
    paths: ["Manutention au sol\\Diable"],
    reason: "breadcrumb Stockman réel : diables électriques",
  },
  {
    markers: [/\bchariots?\s+porte[- ]futs?\b/, /\bmanutention\s+des\s+futs?\b/],
    paths: ["Manutention au sol\\Chariot et servante\\Chariot porte-fût"],
    reason: "breadcrumb Stockman réel : manutention des fûts",
  },
  {
    markers: [/\bequipement\s+de\s+quai\s+et\s+de\s+stockage\b/],
    paths: ["Stockage", "Manutention au sol"],
    reason: "breadcrumb Stockman réel : équipement de quai et stockage",
  },

  {
    markers: [/\btracteurs?\s+pousseurs?\s+electriques?\b/, /\btracteurs?\s+tireurs?\b/],
    paths: ["Manutention au sol\\Tireur pousseur"],
    reason: "breadcrumb Stockman : tracteurs / pousseurs électriques",
  },
  {
    markers: [/\btranspalettes?\s+electriques?\b/, /\belectric\s+lithium\s+pallet\s+trucks?\b/],
    paths: ["Manutention au sol\\Transpalette\\Transpalette éléctrique"],
    reason: "breadcrumb Stockman : transpalettes électriques",
  },
  {
    markers: [/\btranspalettes?\s+peseurs?\b/],
    paths: ["Manutention au sol\\Transpalette\\Transpalette peseur", "Manutention au sol\\Transpalette\\Tanspalette peseur"],
    reason: "breadcrumb Stockman : transpalettes peseurs",
  },
  {
    markers: [/\btranspalettes?\s+haute\s+levee\b/],
    paths: ["Manutention au sol\\Transpalette\\Transpalette haute levée"],
    reason: "breadcrumb Stockman : transpalettes haute levée",
  },
  {
    markers: [/\bgerbeurs?.*\belectri/, /\bgerbeurs?\s+a\s+utilisation\s+moderee\b/],
    paths: ["Manutention au sol\\Gerbeur\\Gerbeur éléctrique"],
    reason: "breadcrumb Stockman : gerbeurs électriques",
  },
  {
    markers: [/\bgerbeurs?.*\bmanuels?\b/],
    paths: ["Manutention au sol\\Gerbeur\\Gerbeur manuel"],
    reason: "breadcrumb Stockman : gerbeurs manuels",
  },
  {
    markers: [/\bchariots?\s+porte[- ]panneaux?\b/],
    paths: ["Manutention au sol\\Chariot et servante\\Chariot porte panneau"],
    reason: "breadcrumb Stockman : chariots porte-panneaux",
  },
  {
    markers: [/\bplateformes?\s+motorisees?\b/],
    paths: ["Manutention au sol\\Chariot et servante\\Plateforme motorisée"],
    reason: "breadcrumb Stockman : plateformes motorisées",
  },
  {
    markers: [/\bleve[- ]futs?\b/, /\bchariots?\s+porte[- ]futs?\b/],
    paths: ["Manutention au sol\\Chariot et servante\\Chariot porte-fût"],
    reason: "breadcrumb Stockman : manutention des fûts",
  },
  {
    markers: [/\bnacelles?\s+magasinage\b/, /\bnacelles?\b/],
    paths: ["Accès en hauteur\\Nacelle"],
    reason: "breadcrumb Stockman : nacelles",
  },
  {
    markers: [/\bgrues?\s+repliables?\s+et\s+transformables?\b/, /\bgrues?\s+d.?atelier\b/],
    paths: ["Manutention au sol\\Grue d'atelier\\Grue d'atelier porte à faux", "Manutention au sol\\Grue d'atelier"],
    reason: "breadcrumb Stockman : grues d'atelier",
  },
  {
    markers: [/\bpalans?\b/],
    paths: ["Levage\\Palan"],
    reason: "breadcrumb Stockman : palans",
  },
  {
    markers: [/\belevateurs?\s+leve[- ]charge\s+manuels?\b/],
    paths: ["Levage\\Élévateur de charge"],
    reason: "breadcrumb Stockman : élévateurs lève-charge",
  },
  {
    markers: [/\bdiables?\s+porte[- ]bouteilles?\b/],
    paths: ["Manutention au sol\\Diable\\Diable porte fût et bouteille"],
    reason: "breadcrumb Stockman : diables porte-bouteilles",
  },
  {
    markers: [/\bdiables?\s+leve[- ]charges?\s+encombrantes?\b/],
    paths: ["Manutention au sol\\Diable\\Diable aluminium et inox", "Manutention au sol\\Diable"],
    reason: "breadcrumb Stockman : diables lève-charges",
  },
  {
    markers: [/\bdiables?\b/],
    paths: ["Manutention au sol\\Diable"],
    reason: "breadcrumb Stockman : diables",
  },
  {
    markers: [/\btables?\s+elevatrices?\b/],
    paths: ["Manutention au sol\\Table élévatrice"],
    reason: "breadcrumb Stockman : tables élévatrices",
  },
];

function breadcrumbCategory(levels: string[], productName = "") {
  const searchable = normalized(levels.join(" > "));
  const normalizedProductName = normalized(productName);

  if (normalizedProductName.includes("produit arrete")) {
    return {
      path: null as string | null,
      kind: "discontinued" as const,
      reason: "produit explicitement arrêté : aucune nouvelle catégorie imposée",
    };
  }

  if (breadcrumbLooksLikeAccessory(levels)) {
    return {
      path: null as string | null,
      kind: "accessory" as const,
      reason: "breadcrumb Stockman réel : branche Options / Accessoires détectée, aucune catégorie machine imposée",
    };
  }

  for (const rule of BREADCRUMB_RULES) {
    if (!rule.markers.some((marker) => marker.test(searchable))) continue;
    for (const path of rule.paths) {
      const existing = knownCategoryPath(path);
      if (existing) return { path: existing, kind: "category" as const, reason: rule.reason };
    }
  }
  return {
    path: null as string | null,
    kind: "review" as const,
    reason: "breadcrumb lu mais aucune branche OYSTE correspondante à haute confiance",
  };
}

async function readBreadcrumb(
  page: import("playwright").Page,
  sourceUrl: string,
) {
  const requestedUrl = validateStockmanPageUrl(sourceUrl);
  await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });

  // Stockman injecte le fil d'Ariane après DOMContentLoaded.
  // Le conteneur peut donc exister alors que ses liens sont encore absents.
  // On attend explicitement au moins un lien réel du breadcrumb.
  await page
    .waitForSelector(
      ".container.content-ariane a, #div_ariane_content .content-ariane a, .content-ariane a",
      { state: "attached", timeout: 15_000 },
    )
    .catch(() => undefined);

  // Petit délai de stabilisation pour laisser Stockman injecter tous les niveaux.
  await page.waitForTimeout(350);

  const data = await page.evaluate(() => {
    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

    const container =
      document.querySelector(".container.content-ariane")
      || document.querySelector("#div_ariane_content .content-ariane")
      || document.querySelector(".content-ariane");

    if (!container) {
      return {
        levels: [] as string[],
        productName: "",
        htmlFound: false,
      };
    }

    const allAnchors = Array.from(container.querySelectorAll("a"))
      .map((node) => ({
        text: clean(node.textContent),
        title: clean(node.getAttribute("title")),
        href: clean(node.getAttribute("href")),
        className: clean(node.getAttribute("class")),
      }))
      .filter((item) => item.text || item.title);

    const rawLevels = allAnchors
      .map((item) => item.text || item.title)
      .filter(Boolean);

    const levels = rawLevels.filter(
      (value) => !/^accueil$/i.test(value) && !/^produits?$/i.test(value),
    );

    const productName = clean(container.querySelector(".nameProduct")?.textContent);

    return {
      levels,
      rawLevels,
      anchors: allAnchors,
      productName,
      htmlFound: true,
      linkCount: allAnchors.length,
      arianeLinkCount: container.querySelectorAll("a.ariane-link").length,
      anchorDetails: Array.from(container.querySelectorAll("a")).map((node) => ({ text: clean(node.textContent), title: clean(node.getAttribute("title")), href: clean(node.getAttribute("href")), className: clean(node.getAttribute("class")) })),
      containerText: clean(container.textContent),
    };
  });

  return {
    requestedUrl,
    finalUrl: page.url(),
    ...data,
  };
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  await refreshKnownCategoryPathsFromDatabase();

  const body = await request.json().catch(() => ({}));

  if (body?.action === "category_options") {
    return NextResponse.json({ version: "V2.10.20.17", categories: await listCategoryOptions() });
  }

  if (body?.action === "ensure_missing_taxonomy") {
    const paths = [
      "Équipement d'atelier\\Presse hydraulique",
      "Manutention au sol\\Chariot élévateur\\Chariot à mât rétractable",
    ];
    for (const path of paths) await ensureCategoryPath(path);
    await refreshKnownCategoryPathsFromDatabase();
    return NextResponse.json({
      version: "V2.10.20.17",
      createdOrConfirmed: paths,
      categories: await listCategoryOptions(),
    });
  }

  if (body?.action === "save_category_override") {
    const productId = String(body?.productId || "").trim();
    const categoryId = String(body?.categoryId || "").trim();
    const levels = Array.isArray(body?.breadcrumb)
      ? body.breadcrumb.filter((item: unknown): item is string => typeof item === "string")
      : [];

    if (!productId || !categoryId || levels.length === 0) {
      return NextResponse.json({ message: "Produit, catégorie et breadcrumb requis." }, { status: 400 });
    }

    const [product, categoryOptions] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, sourceData: true, supplier: { select: { slug: true, name: true } } },
      }),
      listCategoryOptions(),
    ]);

    const selectedCategory = categoryOptions.find((item) => item.id === categoryId);
    if (!product || !selectedCategory) {
      return NextResponse.json({ message: "Produit ou catégorie introuvable." }, { status: 404 });
    }

    if (
      product.supplier
      && product.supplier.slug?.toLowerCase() !== "stockman"
      && product.supplier.name?.toLowerCase() !== "stockman"
    ) {
      return NextResponse.json({ message: "Ce produit n'appartient pas à STOCKMAN." }, { status: 400 });
    }

    const sourceData = cloneSourceData(product.sourceData);
    const currentStockman = getStockmanData(product.sourceData);
    const override: ManualCategoryOverride = {
      categoryId,
      categoryPath: selectedCategory.path,
      breadcrumbKey: makeBreadcrumbKey(levels),
      breadcrumb: levels,
      updatedAt: new Date().toISOString(),
    };

    sourceData.stockman = { ...currentStockman, categoryOverride: override };

    await prisma.product.update({
      where: { id: product.id },
      data: { sourceData: sourceData as never },
    });

    return NextResponse.json({ version: "V2.10.20.17", saved: true, override });
  }


  if (body?.action === "apply_category_selection") {
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    const confirmation = String(body?.confirmation || "").trim();

    if (changes.length === 0) {
      return NextResponse.json({ message: "Aucun changement sélectionné." }, { status: 400 });
    }
    if (changes.length > 136) {
      return NextResponse.json({ message: "Sélection trop importante." }, { status: 400 });
    }
    if (confirmation !== `APPLIQUER ${changes.length}`) {
      return NextResponse.json({ message: `Confirmation attendue : APPLIQUER ${changes.length}` }, { status: 400 });
    }

    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { name: { equals: "STOCKMAN", mode: "insensitive" } },
          { slug: { equals: "stockman", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (!supplier) return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });

    const categoryOptions = await listCategoryOptions();
    const categoryByPath = new Map(categoryOptions.map((item) => [normalized(item.path), item]));
    const ids = changes.map((item: any) => String(item?.id || "").trim()).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ message: "La sélection contient des produits dupliqués." }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, supplierId: supplier.id },
      include: { category: { select: { name: true, path: true } } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const prepared: Array<{ id: string; code: string; from: string | null; to: string; categoryId: string | null; sourceData: Record<string, unknown> }> = [];
    const rejected: Array<{ id: string; reason: string }> = [];

    for (const raw of changes) {
      const id = String(raw?.id || "").trim();
      const targetPath = String(raw?.proposedCategory || "").trim();
      const expectedCurrent = String(raw?.currentCategory || "").trim();
      const product = productById.get(id);
      if (!product) {
        rejected.push({ id, reason: "produit Stockman introuvable" });
        continue;
      }
      const actualCurrent = product.category?.path || product.category?.name || "";
      if (normalized(actualCurrent) !== normalized(expectedCurrent)) {
        rejected.push({ id, reason: `catégorie modifiée depuis l'audit (${actualCurrent || "aucune"})` });
        continue;
      }
      const target = categoryByPath.get(normalized(targetPath)) || null;
      if (normalized(actualCurrent) === normalized(targetPath)) {
        rejected.push({ id, reason: "catégorie déjà appliquée" });
        continue;
      }

      const sourceData = cloneSourceData(product.sourceData);
      prepared.push({
        id,
        code: product.code,
        from: actualCurrent || null,
        to: target?.path || targetPath,
        categoryId: target?.id || null,
        sourceData,
      });
    }

    // Sécurité forte : tout ou rien. Si une seule ligne est devenue obsolète, aucune écriture.
    if (rejected.length > 0 || prepared.length !== changes.length) {
      return NextResponse.json({
        message: "Application annulée : la sélection n'est plus parfaitement cohérente avec l'audit. Aucune modification effectuée.",
        rejected,
      }, { status: 409 });
    }

    const applied = await prisma.$transaction(async (tx) => {
      const ensured = new Map<string, { id: string; path: string }>();

      const ensureTarget = async (requestedPath: string) => {
        const key = normalized(requestedPath);
        const cached = ensured.get(key);
        if (cached) return cached;

        const parts = requestedPath.split("\\").map((part) => part.trim()).filter(Boolean);
        let parentId: string | null = null;
        let currentPath = "";
        let finalId = "";

        for (const name of parts) {
          currentPath = currentPath ? `${currentPath}\\${name}` : name;

          const existing: { id: string; path: string | null } | null =
            await tx.category.findFirst({
              where: {
                OR: [
                  { path: currentPath },
                  { AND: [{ name }, { parentId }] },
                ],
              },
              select: { id: true, path: true },
            });

          if (existing) {
            finalId = existing.id;
            parentId = existing.id;
            if (!existing.path) {
              await tx.category.update({
                where: { id: existing.id },
                data: { path: currentPath },
              });
            }
            continue;
          }

          let slug = slugifyCategory(currentPath);
          let suffix = 2;
          while (await tx.category.findUnique({ where: { slug }, select: { id: true } })) {
            slug = `${slugifyCategory(currentPath)}-${suffix++}`;
          }

          const created: { id: string } = await tx.category.create({
            data: { name, slug, path: currentPath, parentId, isActive: true },
            select: { id: true },
          });
          finalId = created.id;
          parentId = created.id;
        }

        if (!finalId) throw new Error(`Impossible de résoudre la catégorie cible : ${requestedPath}`);
        const result = { id: finalId, path: requestedPath };
        ensured.set(key, result);
        return result;
      };

      const results: Array<{ id: string; code: string; from: string | null; to: string }> = [];

      for (const item of prepared) {
        const target = item.categoryId
          ? { id: item.categoryId, path: item.to }
          : await ensureTarget(item.to);

        const stockman = getStockmanData(item.sourceData);
        const previousHistory = Array.isArray(stockman.categoryClassificationHistory)
          ? stockman.categoryClassificationHistory.slice(-19)
          : [];
        const sourceData = {
          ...item.sourceData,
          stockman: {
            ...stockman,
            categoryClassificationHistory: [
              ...previousHistory,
              {
                version: "V2.10.22.2",
                appliedAt: new Date().toISOString(),
                fromCategory: item.from,
                toCategory: target.path,
                targetCategoryId: target.id,
              },
            ],
          },
        };

        // Relecture anti-dérive dans la transaction juste avant l'écriture.
        const fresh = await tx.product.findUnique({
          where: { id: item.id },
          include: { category: { select: { name: true, path: true } } },
        });
        const freshCurrent = fresh?.category?.path || fresh?.category?.name || "";
        if (!fresh || normalized(freshCurrent) !== normalized(item.from || "")) {
          throw new Error(`ANTI_DRIFT:${item.code}:${freshCurrent || "aucune"}`);
        }

        await tx.product.update({
          where: { id: item.id },
          data: { categoryId: target.id, sourceData: sourceData as never },
        });
        results.push({ id: item.id, code: item.code, from: item.from, to: target.path });
      }

      return results;
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    return NextResponse.json({
      version: "V2.10.22.2",
      applied: applied.length,
      changes: applied,
      message: `${applied.length} catégorie(s) Stockman appliquée(s) avec succès.`,
    });
  }

  if (body?.action === "breadcrumb_debug") {
    const code = String(body?.code || "LFC300").trim().toUpperCase();
    const supplier = await prisma.supplier.findFirst({
      where: { OR: [
        { name: { equals: "STOCKMAN", mode: "insensitive" } },
        { slug: { equals: "stockman", mode: "insensitive" } },
      ] },
      select: { id: true },
    });
    if (!supplier) return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });

    const product = await prisma.product.findFirst({
      where: { supplierId: supplier.id, code: { equals: code, mode: "insensitive" } },
      select: { id: true, code: true, name: true, sourceData: true },
    });
    if (!product) return NextResponse.json({ message: `Référence ${code} introuvable chez STOCKMAN.` }, { status: 404 });
    const sourceUrl = sourceUrlFromData(product.sourceData);
    if (!sourceUrl) return NextResponse.json({ message: `Aucune URL source Stockman pour ${code}.` }, { status: 404 });

    const { browser, context } = await openStockmanBrowser();
    const page = await context.newPage();
    try {
      const requestedUrl = validateStockmanPageUrl(sourceUrl);
      const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(2500);
      const diagnostic = await page.evaluate(() => {
        const root = document.querySelector("#div_ariane_content");
        const exact = document.querySelector(".container.content-ariane");
        const generic = document.querySelector(".content-ariane");
        const container = exact || root?.querySelector(".content-ariane") || generic;
        const trim = (v: string | null | undefined, max = 4000) => (v || "").replace(/\s+/g, " ").trim().slice(0, max);
        const allLinks = container ? Array.from(container.querySelectorAll("a")) : [];
        const arianeLinks = container ? Array.from(container.querySelectorAll("a.ariane-link")) : [];
        return {
          title: document.title,
          readyState: document.readyState,
          rootFound: Boolean(root),
          exactContainerFound: Boolean(exact),
          genericContainerFound: Boolean(generic),
          allLinksCount: allLinks.length,
          arianeLinksCount: arianeLinks.length,
          allLinks: allLinks.slice(0, 20).map((a) => ({ text: trim(a.textContent, 300), href: (a as HTMLAnchorElement).href, className: (a as HTMLElement).className })),
          arianeLinks: arianeLinks.slice(0, 20).map((a) => ({ text: trim(a.textContent, 300), href: (a as HTMLAnchorElement).href })),
          containerText: trim(container?.textContent, 3000),
          containerHtml: trim(container?.innerHTML, 6000),
          bodyTextStart: trim(document.body?.innerText, 2500),
        };
      });
      return NextResponse.json({
        version: "V2.10.20.17", readOnly: true, code: product.code, name: product.name,
        requestedUrl, finalUrl: page.url(), httpStatus: response?.status() ?? null, diagnostic,
      });
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 });
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }

  if (body?.action !== "breadcrumb_batch") {
    return NextResponse.json({ message: "Action d'audit breadcrumb inconnue." }, { status: 400 });
  }

  const offset = Math.max(0, Number(body.offset) || 0);
  const limit = Math.min(5, Math.max(1, Number(body.limit) || 4));

  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: "STOCKMAN", mode: "insensitive" } },
        { slug: { equals: "stockman", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (!supplier) return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });

  const overrideSources = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: { sourceData: true },
  });
  const manualOverrides = new Map<string, ManualCategoryOverride>();
  for (const item of overrideSources) {
    const override = getManualCategoryOverride(item.sourceData);
    if (override) manualOverrides.set(override.breadcrumbKey, override);
  }

  const total = await prisma.product.count({ where: { supplierId: supplier.id } });
  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    include: { category: { select: { name: true, path: true } } },
    orderBy: { code: "asc" },
    skip: offset,
    take: limit,
  });

  const { browser, context } = await openStockmanBrowser();
  const page = await context.newPage();

  try {
    const rows = [];
    for (const product of products) {
      const sourceUrl = sourceUrlFromData(product.sourceData);
      const currentCategory = product.category?.path || product.category?.name || null;
      if (!sourceUrl) {
        rows.push({
          id: product.id,
          code: product.code,
          name: product.name,
          currentCategory,
          sourceUrl,
          breadcrumb: [],
          productName: "",
          proposedCategory: null,
          breadcrumbKind: "review",
          reason: "aucune URL Stockman enregistrée sur le produit",
          error: null,
        });
        continue;
      }

      try {
        const breadcrumb = await readBreadcrumb(page, sourceUrl);
        const manualOverride = manualOverrides.get(makeBreadcrumbKey(breadcrumb.levels));
        const proposed = manualOverride
          ? {
              path: manualOverride.categoryPath,
              kind: "category" as const,
              reason: "override manuel OYSTE mémorisé pour ce breadcrumb",
            }
          : breadcrumbCategory(breadcrumb.levels, product.name);
        rows.push({
          id: product.id,
          code: product.code,
          name: product.name,
          currentCategory,
          sourceUrl,
          finalUrl: breadcrumb.finalUrl,
          breadcrumb: breadcrumb.levels,
          productName: breadcrumb.productName,
          proposedCategory: proposed.path,
          breadcrumbKind: proposed.kind,
          manualOverride: manualOverride || null,
          reason: proposed.reason,
          error: !breadcrumb.htmlFound
            ? "conteneur breadcrumb Stockman introuvable dans le DOM"
            : breadcrumb.linkCount === 0
              ? `conteneur trouvé mais aucun lien breadcrumb après attente${breadcrumb.containerText ? ` · texte: ${breadcrumb.containerText.slice(0, 180)}` : ""}`
              : null,
        });
      } catch (error) {
        rows.push({
          id: product.id,
          code: product.code,
          name: product.name,
          currentCategory,
          sourceUrl,
          breadcrumb: [],
          productName: "",
          proposedCategory: null,
          breadcrumbKind: "review",
          reason: "lecture breadcrumb impossible",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      version: "V2.10.20.17",
      readOnly: true,
      total,
      offset,
      processed: rows.length,
      nextOffset: offset + rows.length,
      finished: offset + rows.length >= total,
      rows,
    });
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: "STOCKMAN", mode: "insensitive" } },
        { slug: { equals: "stockman", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (!supplier) return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    include: {
      category: { select: { name: true, path: true } },
      variants: { select: { id: true, code: true, name: true, sourceData: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows = products.map((product) => {
    const sourceUrl = sourceUrlFromData(product.sourceData);
    const proposed = proposedCategory(product.code, sourceUrl, product.name);
    const currentCategory = product.category?.path || product.category?.name || null;
    const kind = productKind(product.name, sourceUrl);
    const veto = kind === "product" ? categoryVeto(product.name, proposed.path, proposed.reason) : null;
    const categoryDecisionResult = categoryDecision(currentCategory, proposed.path, proposed.reason, veto, kind);
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      code: variant.code,
      name: variant.name,
      kind: variantKind(variant.name),
    }));
    const accessoryCandidates = variants.filter((variant) => variant.kind === "accessory");
    const discontinued = variants.filter((variant) => variant.kind === "discontinued");

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      sourceUrl,
      currentCategory,
      proposedCategory: proposed.path,
      categoryReason: proposed.reason,
      categoryVeto: veto,
      categoryNeedsReview: categoryDecisionResult.needsReview,
      categoryConfidence: categoryDecisionResult.confidence,
      productKind: kind,
      variants: variants.length,
      accessoryCandidates,
      discontinued,
      normalVariants: variants.filter((variant) => variant.kind === "variant").length,
    };
  });

  return NextResponse.json({
    version: "V2.10.20.17",
    readOnly: true,
    totals: {
      products: rows.length,
      categoryChangesProposed: rows.filter((row) => row.categoryNeedsReview).length,
      categoriesKeptMoreSpecific: rows.filter((row) => row.categoryConfidence === "kept_more_specific").length,
      categorySuggestionsBlocked: rows.filter((row) => row.categoryConfidence === "semantic_veto").length,
      categoryUnresolved: rows.filter((row) => row.categoryConfidence === "unresolved").length,
      productsWithAccessoryCandidates: rows.filter((row) => row.accessoryCandidates.length > 0).length,
      accessoryProducts: rows.filter((row) => row.productKind === "accessory").length,
      accessoryCandidates:
        rows.filter((row) => row.productKind === "accessory").length
        + rows.reduce((sum, row) => sum + row.accessoryCandidates.length, 0),
      discontinuedProducts: rows.filter((row) => row.productKind === "discontinued").length,
      discontinuedVariants: rows.reduce((sum, row) => sum + row.discontinued.length, 0),
      discontinuedTotal:
        rows.filter((row) => row.productKind === "discontinued").length
        + rows.reduce((sum, row) => sum + row.discontinued.length, 0),
    },
    rows,
  });
}
