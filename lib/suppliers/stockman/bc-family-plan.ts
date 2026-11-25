import bc from "@/data/stockman/technical-bc.json";
export const BC_CATEGORY = { id: "cmta7ilyc001kxoj3drtvfrsc", name: "Accessoires de levage", path: "Levage\\Accessoires de levage", parentId: "cmt1i6gfd05wdokj399h1zehz" } as const;
export const BC_REFERENCES = ["BC10", "BC20", "BC30", "BC50", "BC100"];
export type BcInventory = {
 supplierIds: string[];
 products: Array<{ id: string; code: string; supplierCode: string | null }>;
 variants: Array<{ id: string; code: string; supplierCode: string | null; productId: string }>;
 drafts: Array<{ id: string; reference: string; status: string; sourceUrl: string }>;
 categories: Array<{ id: string; name: string; slug: string; path: string | null; isActive: boolean; catalogueVisible: boolean; parentId: string | null; parent: { id: string; isActive: boolean } | null }>;
 activeReferences: string[];
 prices: Map<string, number>;
};
/** A review plan only. No persistence or supplier calls. */
export function buildBcFamilyPlan(input: BcInventory) {
 const blockers: string[] = [];
 if (input.supplierIds.length !== 1) blockers.push("Fournisseur STOCKMAN absent ou ambigu.");
 if (input.products.length || input.variants.length) blockers.push("Identités ou liaisons existantes : rapprochement manuel requis, aucune création autorisée.");
 if (input.drafts.length) blockers.push("Brouillons existants à rapprocher et réutiliser avant application.");
 const category = input.categories.length === 1 ? input.categories[0] : null;
 const categoryValidated = !!category && category.id === BC_CATEGORY.id && category.name === BC_CATEGORY.name && category.path === BC_CATEGORY.path
   && category.isActive === true && category.catalogueVisible === true && category.parentId === BC_CATEGORY.parentId
   && category.parent?.id === BC_CATEGORY.parentId && category.parent.isActive === true;
 if (!categoryValidated) blockers.push("Catégorie BC validée absente, modifiée, inactive, masquée ou rattachement parent invalide.");
 for (const ref of BC_REFERENCES) {
  if (!input.activeReferences.includes(ref)) blockers.push(`${ref} absent du référentiel actif.`);
  if (!(Number.isFinite(input.prices.get(ref)) && input.prices.get(ref)! > 0)) blockers.push(`${ref} : tarif Neon absent ou invalide.`);
 }
 const variants = BC_REFERENCES.map(reference => ({
  code: reference, supplierCode: reference, name: `Griffe d’accrochage ${reference}`, priceHt: input.prices.get(reference) ?? null,
  options: { Capacité: bc.products[reference as keyof typeof bc.products].capacity },
  stock: null, shippingMode: "QUOTE", imageUrl: bc.products[reference as keyof typeof bc.products].imageUrl,
  features: [{ label: "Capacité", value: bc.products[reference as keyof typeof bc.products].capacity }],
  sourceData: { stockman: { reference, stock: null, stockOnRequest: true, stockReadAt: null, freightIncludedValidated: false } },
 }));
 return { mode: "SIMULATION_ONLY", writes: 0, applicationImplemented: false,
  status: blockers.length ? "BLOCKED_FOR_REVIEW" : "READY_FOR_EXPLICIT_APPROVAL", blockers,
  categoryValidation: { expected: BC_CATEGORY, validated: categoryValidated },
  inventory: { supplierIds: input.supplierIds, products: input.products, variants: input.variants, drafts: input.drafts.map(({sourceUrl, ...row}) => row), categories: input.categories, activeReferences: input.activeReferences },
  proposed: { parent: { code: "BC", supplierCode: null, parentCode: "BC", slug: "stockman-griffes-accrochage-bc", name: "Griffes d’accrochage pour palan BC", publicationStatus: "DRAFT", shippingMode: "QUOTE", stock: null, priceHt: null, parentPricePolicy: "RANGE_FROM_NEON_VARIANTS_NO_SEPARATE_BC_TARIFF", supplierId: input.supplierIds.length === 1 ? input.supplierIds[0] : null, categoryId: categoryValidated ? BC_CATEGORY.id : null }, variants,
   media: BC_REFERENCES.map(ref => ({reference:ref,url:bc.products[ref as keyof typeof bc.products].imageUrl})), gallery: bc.gallery, documents: bc.documents },
  prerequisites: ["Catégorie métier explicitement validée par l’utilisateur ; revérifier son état en base et les médias fournisseur.", "Résoudre les brouillons et doublons éventuels sans suppression automatique.", "Valider les URL fournisseur exactes avant activation des cibles de synchronisation.", "Relire identités et tarifs dans la future transaction avant création.", "Product.stock étant non nullable : définir explicitement son zéro technique avec stockman.stock=null ; jamais une rupture réelle.", "Autorisation explicite séparée pour application. Aucun POST existant create_products ne doit être utilisé pour créer cinq parents."] };
}
