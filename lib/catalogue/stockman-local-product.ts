import type { CatalogueProduct, CatalogueVariant } from "./repository";
import bc from "@/data/stockman/technical-bc.json";
import { isBlockedStockmanReference } from "@/lib/suppliers/stockman/order-policy";

export type StockmanLocalRecord = { reference: string; title: string; category: string; subcategory: string; imageUrl: string };
/** Public whitelist: no private source data, purchase price or inferred stock. */
export function buildStockmanLocalProduct(record: StockmanLocalRecord, records: StockmanLocalRecord[]): CatalogueProduct {
  const code = record.reference.trim().toUpperCase();
  const technical = bc.products[code as keyof typeof bc.products];
  const familyRecords = technical ? bc.references.flatMap(ref => records.filter(row => row.reference === ref)) : [record];
  const variants: CatalogueVariant[] = familyRecords.filter(row => !isBlockedStockmanReference(row.reference)).map((row): CatalogueVariant => {
    const data = bc.products[row.reference as keyof typeof bc.products];
    return { id: `stockman-local:${row.reference}`, code: row.reference, supplierCode: row.reference,
      name: row.title, label: row.title, priceHT: null, stock: null, delay: "Délai et transport à confirmer",
      shippingMode: "QUOTE", imageRef: "", features: data ? [{ label: "Capacité", value: data.capacity }] : [],
      options: data ? { Capacité: data.capacity } : {} };
  });
  const images = technical ? [technical.imageUrl, ...bc.gallery] : [record.imageUrl];
  return {
    id: `stockman-local:${code}`, code, supplierCode: code, parentCode: technical ? bc.family : code,
    slug: code, name: record.title, shortName: record.title, manufacturer: "STOCKMAN", categorySlug: "stockman",
    categoryPath: `${record.category} > ${record.subcategory}`, categories: [record.category, record.subcategory],
    description: record.title, detailedDescription: record.title, priceHT: null, stock: null,
    delay: "Délai et transport à confirmer", shippingMode: "QUOTE", imageRef: "",
    features: technical ? [{ label: "Capacité", value: technical.capacity }] : [],
    variants, variantCount: variants.length, optionSchema: technical ? [{ label: "Capacité", values: variants.map(v => v.options.Capacité) }] : [],
    href: `/catalogue/stockman/${encodeURIComponent(code)}`, experienceType: "STANDARD",
    presentationManagedKeys: ["media", "documents", "features", "description", "detailedDescription", "relatedProductCodes", "accessoryProductCodes"],
    relatedProductCodes: [], accessoryProductCodes: [],
    media: [...new Set(images.filter(Boolean))].map((url, i) => ({ url, altText: record.title, isPrimary: i === 0, sortOrder: i })),
    documents: technical ? bc.documents.map(doc => ({ name: doc.title, type: "TECHNICAL_SHEET", url: doc.url, isPublic: true })) : [],
  };
}
