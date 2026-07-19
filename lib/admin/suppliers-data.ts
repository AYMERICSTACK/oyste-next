import { adminCatalogueProducts } from "@/lib/admin/catalogue-admin";

export type AdminSupplier = {
  id: string;
  name: string;
  productCount: number;
  publishedCount: number;
  draftCount: number;
  incompleteCount: number;
  averagePrice: number | null;
  documentCount: number;
  imageCount: number;
  status: "Actif" | "À compléter";
  contactName: string;
  email: string;
  phone: string;
  website: string;
  averageLeadTime: string;
  lastUpdate: string;
};

const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const grouped = new Map<string, typeof adminCatalogueProducts>();
for (const product of adminCatalogueProducts) {
  const manufacturer = product.manufacturer?.trim() || "Sans fournisseur";
  const current = grouped.get(manufacturer) ?? [];
  current.push(product);
  grouped.set(manufacturer, current);
}

export const adminSuppliers: AdminSupplier[] = Array.from(grouped.entries())
  .map<AdminSupplier>(([name, products], index) => {
    const priced = products.filter((product) => typeof product.priceHT === "number");
    const averagePrice = priced.length ? priced.reduce((total, product) => total + (product.priceHT ?? 0), 0) / priced.length : null;
    const complete = products.filter((product) => product.completeness >= 70).length;
    const status: AdminSupplier["status"] = name === "Sans fournisseur" ? "À compléter" : "Actif";

    return {
      id: slugify(name) || `supplier-${index}`,
      name,
      productCount: products.length,
      publishedCount: products.filter((product) => product.status === "Publié").length,
      draftCount: products.filter((product) => product.status === "Brouillon").length,
      incompleteCount: products.length - complete,
      averagePrice,
      documentCount: products.reduce((total, product) => total + product.documentCount, 0),
      imageCount: products.reduce((total, product) => total + product.images.length, 0),
      status,
      contactName: "Contact commercial",
      email: name === "Sans fournisseur" ? "" : `contact@${slugify(name)}.fr`,
      phone: "+33 (0)4 00 00 00 00",
      website: name === "Sans fournisseur" ? "" : `www.${slugify(name)}.fr`,
      averageLeadTime: index % 3 === 0 ? "3 à 5 jours" : index % 3 === 1 ? "1 à 2 semaines" : "Sur consultation",
      lastUpdate: `${String((index % 17) + 1).padStart(2, "0")}/07/2026`,
    };
  })
  .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, "fr"));

export const supplierStats = {
  total: adminSuppliers.length,
  active: adminSuppliers.filter((supplier) => supplier.status === "Actif").length,
  products: adminSuppliers.reduce((total, supplier) => total + supplier.productCount, 0),
  incomplete: adminSuppliers.reduce((total, supplier) => total + supplier.incompleteCount, 0),
};

export function getAdminSupplier(id: string) {
  return adminSuppliers.find((supplier) => supplier.id === id);
}
