import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

let admin: { id: string; role: string } | null;
let sequence = 0;
let audit: unknown[] = [];
let storedContent: unknown = null;
const categories = new Map<string, any>();
const suppliers = new Map<string, any>();
const products = new Map<string, any>();
function model(store: Map<string, any>) {
  return {
    async findUnique({ where }: any) { return store.get(where.id) ?? null; },
    async findFirst({ where }: any) { return [...store.values()].find(item => Object.entries(where).every(([key, value]) => item[key] === value)) ?? null; },
    async findMany() { return [...store.values()]; },
    async create({ data }: any) { const item = { id: `item-${++sequence}`, variants: [], _count: { products: 0, children: 0, orderItems: 0 }, ...data }; store.set(item.id, item); return item; },
    async update({ where, data }: any) { const item = { ...store.get(where.id), ...data }; store.set(where.id, item); return item; },
    async delete({ where }: any) { const item = store.get(where.id); store.delete(where.id); return item; },
  };
}
const db: any = {
  siteSetting: {
    async findUnique() { return storedContent ? { value: storedContent } : null; },
    async upsert({ update, create }: any) { storedContent = (storedContent ? update : create).value; return { value: storedContent }; },
  },
  productMedia: { async findUnique() { return { id: "supplier-media", url: "https://supplier.test/image.jpg", sourceUrl: "https://supplier.test/image.jpg", isPrimary: true }; } },
  category: model(categories), supplier: model(suppliers), product: model(products),
  productVariant: { update() { throw new Error("Unexpected variant write"); } },
  auditLog: { async create(value: unknown) { audit.push(value); return value; } },
  async $executeRaw() {},
  async $transaction(callback: any) {
    if (Array.isArray(callback)) return Promise.all(callback);
    const snapshots = [categories, suppliers, products].map(store => new Map(store));
    const oldAudit = [...audit];
    try { return await callback(db); }
    catch (error) { [categories, suppliers, products].forEach((store, index) => { store.clear(); snapshots[index].forEach((value, key) => store.set(key, value)); }); audit = oldAudit; throw error; }
  },
};
function replace(path: string, exports: object) {
  const filename = require.resolve(path);
  const module = new Module(filename);
  module.filename = filename; module.loaded = true; module.exports = exports;
  require.cache[filename] = module;
}
replace("../../db/prisma", { prisma: db });
replace("../../auth/admin-session", { getCurrentAdmin: async () => admin });
const references = require("../reference-api") as typeof import("../reference-api");
const creation = require("../../../app/api/admin/catalogue/route") as typeof import("../../../app/api/admin/catalogue/route");
const productApi = require("../../../app/api/admin/catalogue/[id]/route") as typeof import("../../../app/api/admin/catalogue/[id]/route");
const cmsApi = require("../../../app/api/admin/cms/route") as typeof import("../../../app/api/admin/cms/route");
const mediaApi = require("../../../app/api/admin/catalogue/[id]/media/route") as typeof import("../../../app/api/admin/catalogue/[id]/media/route");
const { defaultCmsContent } = require("../../cms-content") as typeof import("../../cms-content");
const request = (body: unknown, method = "POST") => new Request("https://oyste.test/api", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const supplier = { name: "Test", slug: "test", logoUrl: null, contactName: null, email: null, phone: null, website: null, averageLeadTime: null, internalNotes: null, isActive: true };
const category = { name: "Famille", slug: "famille", description: null, seoTitle: null, seoDescription: null, imageUrl: null, sortOrder: 0, isActive: true, parentId: null };
const shipment = { weightKg: null, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, shippingMode: "QUOTE", publicationStatus: "DRAFT", variants: [] };
beforeEach(() => { categories.clear(); suppliers.clear(); products.clear(); audit = []; storedContent = null; admin = { id: "admin", role: "CATALOG_MANAGER" }; });

test("API fournisseur : créer, modifier, désactiver et supprimer avec audits", async () => {
  const created = await references.saveReference("supplier", request(supplier));
  assert.equal(created.status, 201);
  const { item } = await created.json();
  const changed = await references.saveReference("supplier", request({ ...supplier, name: "Modifié", isActive: false }, "PATCH"), item.id);
  assert.equal(changed.status, 200);
  assert.equal(suppliers.get(item.id).name, "Modifié"); assert.equal(suppliers.get(item.id).isActive, false);
  assert.equal((await references.deleteReference("supplier", request({}), item.id)).status, 200);
  assert.equal(suppliers.size, 0); assert.equal(audit.length, 3);
});
test("API catégorie : créer, modifier ordre et SEO, puis supprimer", async () => {
  const { item } = await (await references.saveReference("category", request(category))).json();
  assert.equal((await references.saveReference("category", request({ ...category, sortOrder: 7, seoTitle: "SEO" }), item.id)).status, 200);
  assert.equal(categories.get(item.id).sortOrder, 7); assert.equal(categories.get(item.id).seoTitle, "SEO");
  assert.equal((await references.deleteReference("category", request({}), item.id)).status, 200);
});
test("API catégorie : parent absent refusé", async () => {
  assert.equal((await references.saveReference("category", request({ ...category, parentId: "missing" }))).status, 400);
  assert.equal(categories.size, 0);
});
test("API catégorie : cycle refusé sans modification ni audit", async () => {
  categories.set("a", { ...category, id: "a", parentId: null });
  categories.set("b", { ...category, id: "b", parentId: "a" });
  assert.equal((await references.saveReference("category", request({ ...category, parentId: "b" }), "a")).status, 400);
  assert.equal(categories.get("a").parentId, null); assert.equal(audit.length, 0);
});
test("API référence : slug existant conservé", async () => {
  suppliers.set("s", { ...supplier, id: "s" });
  assert.equal((await references.saveReference("supplier", request({ ...supplier, slug: "changed" }), "s")).status, 400);
  assert.equal(suppliers.get("s").slug, "test");
});
test("API suppression : produits/enfants et intégrations bloqués", async () => {
  suppliers.set("s", { ...supplier, id: "s", _count: { products: 1 } });
  categories.set("c", { ...category, id: "c", _count: { products: 0, children: 1 } });
  suppliers.set("stockman", { ...supplier, slug: "stockman", id: "stockman", _count: { products: 0 } });
  for (const [kind, id] of [["supplier", "s"], ["category", "c"], ["supplier", "stockman"]] as const) assert.equal((await references.deleteReference(kind, request({}), id)).status, 409);
  assert.equal(suppliers.size, 2); assert.equal(categories.size, 1); assert.equal(audit.length, 0);
});
test("API : anonymes et rôles sans permission bloqués avant mutation", async () => {
  admin = null;
  assert.equal((await references.saveReference("supplier", request(supplier))).status, 401);
  assert.equal((await productApi.PATCH(request(shipment), { params: Promise.resolve({ id: "p" }) })).status, 401);
  for (const role of ["READ_ONLY", "CONTENT_EDITOR", "ORDER_MANAGER"]) {
    admin = { id: "a", role };
    assert.equal((await references.saveReference("category", request(category))).status, 403);
    assert.equal((await creation.POST(request({}))).status, 403);
    assert.equal((await productApi.PATCH(request(shipment), { params: Promise.resolve({ id: "p" }) })).status, 403);
  }
  assert.equal(products.size + suppliers.size + categories.size, 0); assert.equal(audit.length, 0);
});
test("API : JSON malformé renvoie 400", async () => {
  const bad = () => new Request("https://oyste.test/api", { method: "POST", body: "{" });
  assert.equal((await creation.POST(bad())).status, 400);
  assert.equal((await references.saveReference("supplier", bad())).status, 400);
  assert.equal((await productApi.PATCH(bad(), { params: Promise.resolve({ id: "p" }) })).status, 400);
});
test("API produit : création manuelle en brouillon et audit", async () => {
  const result = await creation.POST(request({ name: "Manuel", code: "MANUEL", slug: "manuel", priceHt: 10, categoryId: null }));
  assert.equal(result.status, 201);
  const { id } = await result.json();
  assert.equal(products.get(id).publicationStatus, "DRAFT"); assert.equal(products.get(id).sourceData.adminCreated, true); assert.equal(audit.length, 1);
});
test("API produit : référence existante refusée sans duplication", async () => {
  products.set("old", { code: "MANUEL" });
  assert.equal((await creation.POST(request({ name: "Manuel", code: "MANUEL", slug: "manuel", priceHt: 10, categoryId: null }))).status, 409);
  assert.equal(products.size, 1);
});
test("ProductEditor : champs manuels réellement passés en persistance", async () => {
  products.set("p", { id: "p", sourceData: { adminCreated: true }, variants: [], publishedAt: null });
  const manual = { name: "Modifié", description: "Court", detailedDescription: "Détails", seoTitle: "SEO", seoDescription: "Meta", stock: 3, priceHt: 45 };
  assert.equal((await productApi.PATCH(request({ ...shipment, manual }), { params: Promise.resolve({ id: "p" }) })).status, 200);
  for (const [key, value] of Object.entries(manual)) assert.equal(products.get("p")[key], value);
  assert.equal(audit.length, 1);
});
test("ProductEditor : pas d’écrasement des produits importés", async () => {
  products.set("p", { id: "p", sourceData: { stockman: {} }, variants: [], publishedAt: null, name: "Fournisseur" });
  const manual = { name: "Écrasé", description: "", detailedDescription: "", seoTitle: "", seoDescription: "", stock: 0, priceHt: 1 };
  assert.equal((await productApi.PATCH(request({ ...shipment, manual }), { params: Promise.resolve({ id: "p" }) })).status, 409);
  assert.equal(products.get("p").name, "Fournisseur"); assert.equal(audit.length, 0);
});
test("ProductEditor : variante étrangère et colis partiel refusés", async () => {
  products.set("p", { id: "p", variants: [], sourceData: null });
  assert.equal((await productApi.PATCH(request({ ...shipment, packageLengthCm: 3 }), { params: Promise.resolve({ id: "p" }) })).status, 400);
  assert.equal((await productApi.PATCH(request({ ...shipment, variants: [{ id: "other", weightKg: null, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, shippingMode: null }] }), { params: Promise.resolve({ id: "p" }) })).status, 400);
});

test("API CMS : sauvegarde et relecture des contenus home depuis SiteSetting", async () => {
  admin = { id: "editor", role: "CONTENT_EDITOR" };
  const value = { ...defaultCmsContent, home: { ...defaultCmsContent.home, heroTitle: "Titre administré", slides: [{ ...defaultCmsContent.home.slides[0], title: "Promotion", order: 8 }] } };
  assert.equal((await cmsApi.PUT(request(value, "PUT"))).status, 200);
  const loaded = await (await cmsApi.GET()).json();
  assert.equal(loaded.home.heroTitle, "Titre administré");
  assert.equal(loaded.home.slides[0].title, "Promotion");
  assert.equal(loaded.home.slides[0].order, 8);
  assert.equal(audit.length, 1);
});
test("API CMS : payload invalide et rôle non éditorial refusés sans écriture", async () => {
  assert.equal((await cmsApi.PUT(request(defaultCmsContent, "PUT"))).status, 403);
  admin = { id: "editor", role: "CONTENT_EDITOR" };
  assert.equal((await cmsApi.PUT(request({ ...defaultCmsContent, navigation: [{ label: "Danger", href: "javascript:alert(1)" }] }, "PUT"))).status, 400);
  assert.equal(storedContent, null); assert.equal(audit.length, 0);
});
test("API médias : suppression des images fournisseur protégée", async () => {
  assert.equal((await mediaApi.DELETE(request({ url: "https://supplier.test/image.jpg" }, "DELETE"), { params: Promise.resolve({ id: "p" }) })).status, 409);
  assert.equal(audit.length, 0);
});
test("API produit : publication conserve sa date lors d’une édition", async () => {
  const date = new Date("2026-01-01T00:00:00Z");
  products.set("p", { id: "p", variants: [], sourceData: null, publishedAt: date });
  assert.equal((await productApi.PATCH(request({ ...shipment, publicationStatus: "PUBLISHED" }), { params: Promise.resolve({ id: "p" }) })).status, 200);
  assert.equal(products.get("p").publishedAt, date);
});
test("API fournisseur : identité intégration conservée", async () => {
  suppliers.set("s", { ...supplier, id: "s", name: "KITO", slug: "kito" });
  assert.equal((await references.saveReference("supplier", request({ ...supplier, slug: "kito", name: "Renommé" }), "s")).status, 400);
  assert.equal(suppliers.get("s").name, "KITO");
});

test("API produit : suppression importée bloquée ; suppression manuelle auditée", async () => {
  products.set("imported", { id: "imported", sourceData: { stockman: {} }, _count: { orderItems: 0 } });
  assert.equal((await productApi.DELETE(request({}, "DELETE"), { params: Promise.resolve({ id: "imported" }) })).status, 409);
  products.set("manual", { id: "manual", code: "MANUAL", sourceData: { adminCreated: true }, _count: { orderItems: 0 } });
  assert.equal((await productApi.DELETE(request({}, "DELETE"), { params: Promise.resolve({ id: "manual" }) })).status, 200);
  assert.equal(products.has("manual"), false); assert.equal(products.has("imported"), true); assert.equal(audit.length, 1);
});
