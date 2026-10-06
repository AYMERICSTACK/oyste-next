import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCmsContent, mergeCms, orderedVisible } from "../../cms-content";
import { cmsContentSchema, publicUrlSchema } from "../../cms-validation";
import { categoryInputSchema, supplierInputSchema } from "../reference-validation";
import { canWriteCatalogue, canWriteContent } from "../catalogue-permissions";

test("ancien CMS : valeurs historiques conservées et collections initialisées", () => {
  const content = mergeCms({ home: { heroTitle: "Titre enregistré" } });
  assert.equal(content.home.heroTitle, "Titre enregistré");
  assert.equal(content.home.quickLinks.length, 5);
  assert.deepEqual(content.home.quickLinks.map(item => item.label), ["Potences", "Palans", "Portiques", "Motorisation SEW", "Manutention"]);
  assert.equal(content.home.slides.length, 3);
  assert.equal(content.home.slides[0].href, "/configurateur");
});
test("CMS absent : rendu historique par défaut", () => assert.deepEqual(mergeCms(null), defaultCmsContent));
test("collections volontairement vides : aucun retour des éléments masqués", () => {
  const content = mergeCms({ home: { slides: [], quickLinks: [] }, navigation: [] });
  assert.deepEqual(content.home.slides, []);
  assert.deepEqual(content.home.quickLinks, []);
  assert.deepEqual(content.navigation, []);
});
test("collections invalides stockées : fallback compatible", () => {
  const content = mergeCms({ home: { quickLinks: null, slides: [{ image: "javascript:alert(1)" }] } });
  assert.deepEqual(content.home.slides, defaultCmsContent.home.slides);
  assert.deepEqual(content.home.quickLinks, defaultCmsContent.home.quickLinks);
});
test("ordre et visibilité depuis la source CMS, sans mutation", () => {
  const source = [{ label: "B", enabled: true, order: 4 }, { label: "Masqué", enabled: false, order: 0 }, { label: "A", enabled: true, order: 1 }];
  assert.deepEqual(orderedVisible(source).map(item => item.label), ["A", "B"]);
  assert.equal(source[0].label, "B");
});
test("valeurs par défaut valides pour sauvegarde", () => assert.equal(cmsContentSchema.safeParse(defaultCmsContent).success, true));
for (const value of ["javascript:alert(1)", "data:text/html,evil", "//evil.example", "/\\evil.example", "https://site.example\n"]) {
  test(`URL dangereuse refusée : ${JSON.stringify(value)}`, () => assert.equal(publicUrlSchema.safeParse(value).success, false));
}
test("liens internes avec paramètres et images HTTPS acceptés", () => {
  assert.equal(publicUrlSchema.safeParse("/catalogue/levage?famille=palan").success, true);
  assert.equal(publicUrlSchema.safeParse("https://example.org/photo.png").success, true);
});
test("CMS : rejet booléen incorrect, ordre négatif et clé technique", () => {
  assert.equal(cmsContentSchema.safeParse({ ...defaultCmsContent, topbar: { ...defaultCmsContent.topbar, enabled: "false" } }).success, false);
  assert.equal(cmsContentSchema.safeParse({ ...defaultCmsContent, home: { ...defaultCmsContent.home, quickLinks: [{ label: "Lien", href: "/", enabled: true, order: -1 }] } }).success, false);
  assert.equal(cmsContentSchema.safeParse({ ...defaultCmsContent, cron: "override" }).success, false);
});
test("rôles catalogue explicitement autorisés", () => {
  for (const role of ["SUPER_ADMIN", "CATALOG_MANAGER"]) assert.equal(canWriteCatalogue({ role }), true);
  for (const role of ["READ_ONLY", "ORDER_MANAGER", "CONTENT_EDITOR", "unknown"]) assert.equal(canWriteCatalogue({ role }), false);
  assert.equal(canWriteCatalogue(null), false);
});
test("rôles éditoriaux explicitement autorisés", () => {
  assert.equal(canWriteContent({ role: "CONTENT_EDITOR" }), true);
  assert.equal(canWriteContent({ role: "SUPER_ADMIN" }), true);
  assert.equal(canWriteContent({ role: "ORDER_MANAGER" }), false);
});
const supplier = { name: "Nouveau", slug: "nouveau", logoUrl: null, contactName: null, email: null, phone: null, website: null, averageLeadTime: null, internalNotes: null, isActive: false };
const category = { name: "Famille", slug: "famille", description: null, seoTitle: null, seoDescription: null, imageUrl: null, sortOrder: 0, isActive: true, parentId: null };
test("fournisseur : création et désactivation validées", () => assert.equal(supplierInputSchema.safeParse(supplier).success, true));
test("fournisseur : intégration technique et e-mail invalide refusés", () => {
  assert.equal(supplierInputSchema.safeParse({ ...supplier, code: "STOCKMAN" }).success, false);
  assert.equal(supplierInputSchema.safeParse({ ...supplier, email: "bad" }).success, false);
});
test("catégorie : parent nullable et ordre validés", () => {
  assert.equal(categoryInputSchema.safeParse(category).success, true);
  assert.equal(categoryInputSchema.safeParse({ ...category, sortOrder: 1.5 }).success, false);
  assert.equal(categoryInputSchema.safeParse({ ...category, slug: "INVALID URL" }).success, false);
});

test('CMS version 2 : une nouvelle zone et un nouveau libellé navigation ne sont plus réécrits',()=>{const input={...defaultCmsContent,version:2,footer:{...defaultCmsContent.footer,area:'France & Europe'},navigation:[{label:'Réalisations personnalisées',href:'/a-propos'}]};const output=mergeCms(input);assert.equal(output.footer.area,'France & Europe');assert.equal(output.navigation[0].label,'Réalisations personnalisées');});
