
import { stockmanCommercialLocation } from "./commercial-scope";
import { STOCKMAN_EQUIVALENCES } from "./equivalences.generated";
import { isBlockedStockmanReference } from "./order-policy";
import type { StockmanDiscoveredReference } from "./catalog-scanner";

type Target = { id: string; code: string; supplierCode?: string | null; name: string; productId?: string; publicationStatus?: string };
type Occurrence = { reference: string; sourceUrl: string; relationType: string; payload: StockmanDiscoveredReference };
type DurableReference = { reference: string; isActive: boolean; targetId?: string | null };
type Page = { canonicalUrl: string; updatedAt: string };
const exact = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();
const compact = (value: string) => exact(value).replace(/[^A-Z0-9]/g, "");
function push<T>(map: Map<string, T[]>, key: string, value: T) {
  if (!key) return;
  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
}

export function qualifyStockmanCommercialCandidates(input: {
  occurrences: Occurrence[]; parents: Target[]; variants: Target[]; durable: DurableReference[]; pages: Page[];
  liveFields?: Array<{
    reference: string; description?: boolean; technical?: boolean; image?: boolean; document?: boolean; role?: string; technicalDetails?: string; verifiedPhoto?: string; verifiedDocument?: string;
    commercial?: { price: number | null; stock: number | null; priceState: string; stockState: string; stockText?: string; sourceUrl: string; observedAt: string };
  }>;
  excludedReferences?: string[];
}) {
  const parentsById = new Map(input.parents.map((row) => [row.id, row]));
  const targetsById = new Map([...input.parents, ...input.variants].map((row) => [row.id, row]));
  const equivalentCodes = new Map<string, string[]>();
  for (const row of STOCKMAN_EQUIVALENCES) push(equivalentCodes, exact(row.supplierReference), exact(row.productCode));
  const exactTargets = new Map<string, Target[]>(), codeTargets = new Map<string, Target[]>(), normalizedTargets = new Map<string, Target[]>();
  const byFamily = new Map<string, Set<string>>();
  const durable = new Map(input.durable.map((row) => [exact(row.reference), row]));
  const checked = new Map(input.pages.map((row) => [row.canonicalUrl, row.updatedAt]));
  const live = new Map((input.liveFields ?? []).map((row) => [exact(row.reference), row]));
  for (const item of [...input.parents, ...input.variants]) {
    const supplierCode = exact(item.supplierCode ?? item.code);
    push(exactTargets, supplierCode, item);
    push(codeTargets, exact(item.code), item);
    push(normalizedTargets, compact(supplierCode), item);
  }
  const references = new Map<string, Array<Occurrence & { category: string; family: string }>>();
  for (const item of input.occurrences) {
    const loc = stockmanCommercialLocation(item.sourceUrl);
    if (!loc) continue;
    const family = exact(item.payload.familyReference);
    const key = exact(item.reference);
    push(references, key, { ...item, category: loc.category.label, family });
    if (!family) continue;
    const targetParents = [...new Set((exactTargets.get(key) ?? []).map((target) => target.productId ?? target.id))];
    if (targetParents.length === 1) {
      const parent = targetParents[0];
      const pair = family + "\u001f" + parent;
      const siblings = byFamily.get(pair) ?? new Set();
      siblings.add(key);
      byFamily.set(pair, siblings);
    }
  }
  const excluded = new Set((input.excludedReferences ?? []).map(exact));
  const output = [];
  for (const [reference, evidence] of references) {
    if (exactTargets.has(reference) || excluded.has(reference)) continue;
    const hardBlocked = isBlockedStockmanReference(reference);
    const stopped = hardBlocked || evidence.some((row) => /\bproduit\s+arr[êe]t[ée](?=$|[\s.,;:])|\bdiscontinued\b/i.test(row.payload.commercialText ?? ""));
    const families = [...new Set(evidence.map((row) => row.family).filter(Boolean))];
    const native = live.get(reference);
    const roles = [...new Set(evidence.map((row) => row.relationType))];
    const classifications = new Set(evidence.map((row) => row.payload.classificationConfidence));
    const regularRoles = roles.every((role) => role === "PRIMARY" || role === "PRIMARY_VARIANT");
    const explicitAccessory = roles.some((role) => ["ACCESSORY", "OPTION", "SPARE_PART"].includes(role)) &&
      evidence.some((row) => row.payload.classificationConfidence === "EXPLICIT" && ["ACCESSORY", "OPTION", "SPARE_PART"].includes(row.relationType));
    const old = durable.get(reference);
    const historical = old?.targetId ? targetsById.get(old.targetId) : undefined;
    const equivalentTargets = (equivalentCodes.get(reference) ?? []).flatMap((code) => codeTargets.get(code) ?? []);
    const matches = [...(codeTargets.get(reference) ?? []), ...(normalizedTargets.get(compact(reference)) ?? []), ...equivalentTargets];
    if (historical) matches.push(historical);
    const candidates = [...new Map(matches.map((target) => [target.id, target])).values()];
    const parentCandidates = new Set<string>();
    if (families.length === 1) {
      const family = families[0];
      for (const item of exactTargets.get(family) ?? []) if (!item.productId) parentCandidates.add(item.id);
      for (const [pair, siblings] of byFamily) {
        const [code, parent] = pair.split("\u001f");
        if (code === family && siblings.size >= 2) parentCandidates.add(parent);
      }
    }
    const byQuality = [...evidence].sort((a, b) => {
      const quality = (item: Occurrence) => Object.values(item.payload.supplierData ?? {}).filter((value) => typeof value === "number").length;
      return quality(b) - quality(a) || a.sourceUrl.localeCompare(b.sourceUrl);
    });
    const best = byQuality[0];
    const data = best.payload.supplierData;
    const commercial = native?.commercial;
    const purchasePriceExVat = commercial ? commercial.price : data?.purchasePriceExVat ?? null;
    const stock = commercial ? commercial.stock : data?.stock ?? null;
    const stockState = commercial?.stockState ?? data?.stockState;
    const stockAvailability = commercial?.stockText ?? data?.stockAvailabilityText;
    const priceState = commercial?.priceState ?? data?.priceState;
    const weightKg = data?.weightKg ?? null;
    const reasons: string[] = [];
    const missing: string[] = [];
    if (!old?.isActive) reasons.push(old ? "Référentiel inactif à confirmer" : "Référence absente du référentiel durable");
    if (families.length !== 1) reasons.push("Famille multiple ou non prouvée");
    if (classifications.has("UNKNOWN")) reasons.push("Rôle fournisseur incertain");
    if (parentCandidates.size > 1) reasons.push("Plusieurs parents OYSTE possibles");
    if (candidates.length > 1) reasons.push("Plusieurs codes OYSTE possibles");
    if (evidence.some((x) => x.relationType !== best.relationType)) reasons.push("Rôles divergents");
    if (new Set(evidence.map((x) => x.payload.supplierData?.purchasePriceExVat).filter((v) => v != null)).size > 1) reasons.push("Prix fournisseur divergents");
    if (new Set(evidence.map((x) => x.payload.supplierData?.stock).filter((v) => v != null)).size > 1) reasons.push("Stocks fournisseur divergents");
    if (purchasePriceExVat == null && priceState !== "ON_REQUEST") missing.push("Prix d’achat HT");
    if (stock == null && stockState !== "ON_REQUEST" && stockState !== "RESTOCK") missing.push("Stock ou disponibilité");
    if (weightKg == null || weightKg <= 0) missing.push("Poids");
    if (!native?.description) missing.push("Description vérifiée");
    if (!native?.technical) missing.push("Caractéristiques, capacité ou dimensions vérifiées");
    if (!native?.image && !best.payload.referenceMedia?.images.length) missing.push("Photographies attribuées");
    if (!native?.document && !best.payload.referenceMedia?.documents.length) missing.push("Documents attribués");
    const target = parentCandidates.size === 1 ? parentsById.get([...parentCandidates][0]) : undefined;
    const classification = stopped ? "Arrêtée" : candidates.length === 1 ? "Déjà présente, rapprochement à confirmer"
      : (native?.role === "option" || native?.role === "accessory") || (explicitAccessory && !regularRoles) ? "Accessoire ou option"
      : candidates.length > 1 || !regularRoles || classifications.has("UNKNOWN") || families.length !== 1 || parentCandidates.size > 1 ? "Décision commerciale"
      : target ? "Nouvelle variante proposée"
      : "Nouveau parent proposé";
    if (target && target.publicationStatus === "PUBLISHED") reasons.push("Parent publié, variante à préparer en attente");
    output.push({
      reference, classification, categories: [...new Set(evidence.map((row) => row.category))], family: families.join(" · "),
      roles, description: best.payload.designation, technicalDetails: native?.technicalDetails, verifiedPhoto: native?.verifiedPhoto, verifiedDocument: native?.verifiedDocument, purchasePriceExVat, priceState, stock, stockState, stockAvailability, weightKg,
      sourceUrl: commercial?.sourceUrl ?? best.sourceUrl,
      checkedAt: commercial?.observedAt ?? checked.get(best.sourceUrl) ?? null,
      parent: target ? { id: target.id, code: target.code, name: target.name, status: target.publicationStatus } : null,
      candidates: candidates.map((item) => item.code), missing, reasons, proposedStatus: "DRAFT" as const,
    });
  }
  return output.sort((a, b) => a.reference.localeCompare(b.reference, "fr"));
}
