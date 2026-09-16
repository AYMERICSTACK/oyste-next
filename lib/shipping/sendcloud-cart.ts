import "server-only";

import { getSendcloudShippingOptions, isSendcloudConfigured } from "@/lib/integrations/sendcloud";
import { calculateCartShipping } from "./shipping-engine";
import type { ShippingCartResult, ShippingLineResult, ShippingProductInput } from "./types";

function isFrenchPostcode(value?: string) {
  return /^\d{5}$/.test((value || "").trim());
}

function positive(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getSmallParcelMaxWeightKg() {
  const configured = Number(process.env.SENDCLOUD_SMALL_PARCEL_MAX_WEIGHT_KG || "29");
  return Number.isFinite(configured) && configured > 0 ? configured : 29;
}

function pickPricedOption(options: Awaited<ReturnType<typeof getSendcloudShippingOptions>>) {
  return options.find((option) => option.price != null && Number.isFinite(option.price) && option.price >= 0 && (!option.currency || option.currency === "EUR")) || null;
}

async function resolveSendcloudLine(product: ShippingProductInput, postcode: string, country: string): Promise<ShippingLineResult | null> {
  if (!isSendcloudConfigured()) return null;
  if (product.kind !== "catalogue") return null;
  if (product.pfiShipping || product.wallPotenceShipping) return null;

  const supplier = String(product.supplier || "").trim().toUpperCase();
  const isKito = supplier === "KITO";
  const sendcloudEligibleMode = product.shippingMode === "QUOTE" || (isKito && product.shippingMode === "MESSAGERIE");
  if (!sendcloudEligibleMode) return null;

  // V2.12.13.8.1 : les petits colis KITO (<= 29 kg par défaut) passent par Sendcloud.
  // Le poids utilisé est celui reconstitué côté serveur, donc il inclut les mètres
  // supplémentaires de chaîne configurés par le client. À partir de 30 kg, la
  // logique transport OYSTE existante reprend la main.
  const weightKg = positive(product.weightKg);
  const lengthCm = positive(product.packageLengthCm);
  const widthCm = positive(product.packageWidthCm);
  const heightCm = positive(product.packageHeightCm);
  const quantity = Math.max(1, product.quantity || 1);

  if (!weightKg) return null;
  if (weightKg > getSmallParcelMaxWeightKg()) return null;

  // Hors KITO, on conserve la règle V2.12.13.1 : aucune estimation Sendcloud
  // sans dimensions colis réelles. Pour KITO <= 29 kg, le devis transport peut
  // être demandé au poids seul ; les dimensions restent à confirmer lors de
  // la préparation réelle de l'expédition.
  if (!isKito && (!lengthCm || !widthCm || !heightCm)) return null;

  // Sans moteur d'emballage, plusieurs unités ne doivent pas être chiffrées
  // avec les dimensions d'un seul carton : on conserve le devis par sécurité.
  if (quantity !== 1) return null;

  try {
    const option = pickPricedOption(await getSendcloudShippingOptions({
      weightKg,
      ...(lengthCm && widthCm && heightCm ? { lengthCm, widthCm, heightCm } : {}),
      toCountry: country || "FR",
      toPostalCode: postcode,
    }));
    if (!option || option.price == null) return null;

    const leadTime = option.leadTimeHours != null
      ? ` · Livraison estimée sous ${Math.max(1, Math.ceil(option.leadTimeHours / 24))} jour${Math.max(1, Math.ceil(option.leadTimeHours / 24)) > 1 ? "s" : ""} ouvré${Math.max(1, Math.ceil(option.leadTimeHours / 24)) > 1 ? "s" : ""}`
      : "";

    return {
      mode: "messagerie",
      label: `Colis · ${option.carrierName}`,
      description: `${option.name}${leadTime}.`,
      amountHT: option.price,
      weightKg,
      reason: lengthCm && widthCm && heightCm
        ? `Tarif Sendcloud · colis ${lengthCm} × ${widthCm} × ${heightCm} cm`
        : `Tarif Sendcloud KITO · ${weightKg} kg · dimensions à confirmer à l'expédition`,
      rateCode: `SENDCLOUD:${option.code}`,
    };
  } catch (error) {
    console.error("Sendcloud cart quote error", error);
    return null;
  }
}

export async function calculateCartShippingWithSendcloud(
  products: ShippingProductInput[],
  postcode?: string,
  country = "FR",
): Promise<ShippingCartResult> {
  const base = calculateCartShipping(products, postcode);
  if (!isFrenchPostcode(postcode)) return base;

  const normalizedPostcode = postcode!.trim();
  const normalizedCountry = country.toUpperCase();
  const maxSmallParcelWeightKg = getSmallParcelMaxWeightKg();

  // V2.12.13.12 : les références KITO qui transitent par ADEI peuvent être
  // regroupées dans un seul colis client lorsque leur poids final cumulé reste
  // dans la limite Sendcloud. Le poids est déjà sécurisé/recalculé côté serveur
  // (chaîne supplémentaire incluse).
  const groupedKitoIndexes = products.reduce<number[]>((indexes, product, index) => {
    const supplier = String(product.supplier || "").trim().toUpperCase();
    const weightKg = positive(product.weightKg);
    const sendcloudEligibleMode = product.shippingMode === "QUOTE" || product.shippingMode === "MESSAGERIE";

    if (
      supplier === "KITO" &&
      product.kind === "catalogue" &&
      !product.pfiShipping &&
      !product.wallPotenceShipping &&
      sendcloudEligibleMode &&
      weightKg &&
      weightKg <= maxSmallParcelWeightKg &&
      base.lines[index]?.amountHT === null
    ) indexes.push(index);

    return indexes;
  }, []);

  const groupedKitoWeightKg = groupedKitoIndexes.reduce((sum, index) => {
    const product = products[index];
    return sum + (positive(product.weightKg) || 0) * Math.max(1, product.quantity || 1);
  }, 0);

  const groupedKitoLines = new Map<number, ShippingLineResult>();

  if (
    groupedKitoIndexes.length > 1 &&
    groupedKitoWeightKg > 0 &&
    groupedKitoWeightKg <= maxSmallParcelWeightKg &&
    isSendcloudConfigured()
  ) {
    try {
      const option = pickPricedOption(await getSendcloudShippingOptions({
        weightKg: groupedKitoWeightKg,
        toCountry: normalizedCountry || "FR",
        toPostalCode: normalizedPostcode,
      }));

      if (option?.price != null) {
        const days = option.leadTimeHours != null ? Math.max(1, Math.ceil(option.leadTimeHours / 24)) : null;
        const leadTime = days != null
          ? ` · Livraison estimée sous ${days} jour${days > 1 ? "s" : ""} ouvré${days > 1 ? "s" : ""}`
          : "";
        const firstIndex = groupedKitoIndexes[0];

        groupedKitoIndexes.forEach((index) => {
          const isFirst = index === firstIndex;
          groupedKitoLines.set(index, {
            mode: "messagerie",
            label: isFirst ? `Colis regroupé · ${option.carrierName}` : "Colis regroupé avec les autres articles KITO",
            description: isFirst
              ? `${option.name}${leadTime}.`
              : "Cet article est regroupé dans le même envoi depuis ADEI ; son transport est déjà compté sur le premier article KITO.",
            amountHT: isFirst ? option.price : 0,
            weightKg: isFirst ? groupedKitoWeightKg : (positive(products[index].weightKg) || undefined),
            reason: isFirst
              ? `Tarif Sendcloud KITO regroupé · ${groupedKitoWeightKg} kg · dimensions à confirmer à l'expédition`
              : "Transport inclus dans le colis KITO regroupé",
            rateCode: `SENDCLOUD:${option.code}:GROUPED-KITO`,
          });
        });
      }
    } catch (error) {
      console.error("Sendcloud grouped KITO quote error", error);
    }
  }

  const lines = await Promise.all(base.lines.map(async (line, index) => {
    const groupedLine = groupedKitoLines.get(index);
    if (groupedLine) return groupedLine;
    if (line.amountHT !== null) return line;
    return (await resolveSendcloudLine(products[index], normalizedPostcode, normalizedCountry)) || line;
  }));

  const hasQuote = lines.some((line) => line.amountHT === null);
  const confirmedAmountHT = lines.reduce((sum, line) => sum + (line.amountHT || 0), 0);
  const modeCounts = lines.reduce<Record<ShippingLineResult["mode"], number>>(
    (counts, line) => ({ ...counts, [line.mode]: counts[line.mode] + 1 }),
    { included: 0, messagerie: 0, affretement: 0, quote: 0 },
  );

  return {
    lines,
    amountHT: hasQuote ? null : confirmedAmountHT,
    confirmedAmountHT,
    hasQuote,
    postcodeValid: true,
    modeCounts,
  };
}
