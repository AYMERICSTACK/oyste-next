import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AdminRole,
  DocumentType,
  Prisma,
  PrismaClient,
  PublicationStatus,
  UserStatus,
} from "../generated/prisma/client";

type Feature = { label?: string; value?: string };
type VariantSource = {
  id: string;
  code?: string;
  supplierCode?: string;
  name?: string;
  label?: string;
  priceHT?: number;
  delay?: string;
  stock?: number;
  imageRef?: string;
  features?: Feature[];
  options?: Record<string, string>;
  [key: string]: unknown;
};
type ProductSource = {
  id: string;
  code?: string;
  supplierCode?: string;
  parentCode?: string;
  slug: string;
  name: string;
  shortName?: string;
  manufacturer?: string;
  categorySlug?: string;
  categoryPath?: string;
  description?: string;
  detailedDescription?: string;
  priceHT?: number;
  minPriceHT?: number;
  maxPriceHT?: number;
  delay?: string;
  stock?: number;
  imageRef?: string;
  features?: Feature[];
  optionSchema?: unknown;
  variants?: VariantSource[];
  [key: string]: unknown;
};
type MediaManifestEntry = {
  public?: { image?: string; images?: string[]; documents?: string[] };
  sourceImage?: string;
  sourceImages?: string[];
  sourceDocuments?: string[];
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL est requise pour exécuter le seed Prisma.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const root = process.cwd();
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "sans-nom";

const asText = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const mediaForProduct = (
  manifest: Record<string, MediaManifestEntry>,
  product: ProductSource,
): MediaManifestEntry | undefined => {
  const candidates = [product.imageRef, product.code, product.supplierCode, product.parentCode]
    .filter((value): value is string => Boolean(value));
  return candidates.map((candidate) => manifest[candidate]).find(Boolean);
};

async function loadJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8")) as T;
}

async function seedReferenceData(products: ProductSource[]) {
  const suppliers = [...new Set(products.map((p) => asText(p.manufacturer)).filter(Boolean))].sort();
  const categories = new Map<string, { name: string; path?: string }>();

  for (const product of products) {
    const slug = asText(product.categorySlug);
    if (!slug) continue;
    const fullPath = asText(product.categoryPath);
    const name = fullPath.split("\\").filter(Boolean).at(-1) || slug;
    categories.set(slug, { name, path: fullPath || undefined });
  }

  for (const name of suppliers) {
    await prisma.supplier.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, slug: slugify(name), isActive: true },
    });
  }

  for (const [slug, category] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name: category.name, path: category.path, isActive: true },
      create: { slug, name: category.name, path: category.path, isActive: true },
    });
  }
}

async function seedProducts(
  products: ProductSource[],
  manifest: Record<string, MediaManifestEntry>,
) {
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const supplierIds = new Map(suppliers.map((supplier) => [supplier.name, supplier.id]));
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));

  for (let index = 0; index < products.length; index += 1) {
    const source = products[index];
    const status = index % 19 === 0
      ? PublicationStatus.HIDDEN
      : index % 11 === 0
        ? PublicationStatus.DRAFT
        : PublicationStatus.PUBLISHED;
    const media = mediaForProduct(manifest, source);
    const publicImages = [...new Set(media?.public?.images ?? (media?.public?.image ? [media.public.image] : []))];
    const sourceImages = media?.sourceImages ?? (media?.sourceImage ? [media.sourceImage] : []);
    const publicDocuments = [...new Set(media?.public?.documents ?? [])];
    const sourceDocuments = media?.sourceDocuments ?? [];

    await prisma.product.upsert({
      where: { id: source.id },
      update: {
        code: asText(source.code, source.id),
        supplierCode: asText(source.supplierCode) || null,
        parentCode: asText(source.parentCode) || null,
        slug: source.slug,
        name: source.name,
        shortName: asText(source.shortName) || null,
        description: asText(source.description) || null,
        detailedDescription: asText(source.detailedDescription) || null,
        priceHt: source.priceHT ?? 0,
        minPriceHt: source.minPriceHT ?? null,
        maxPriceHt: source.maxPriceHT ?? null,
        stock: source.stock ?? 0,
        leadTime: asText(source.delay) || null,
        imageReference: asText(source.imageRef) || null,
        publicationStatus: status,
        supplierId: supplierIds.get(asText(source.manufacturer)) ?? null,
        categoryId: categoryIds.get(asText(source.categorySlug)) ?? null,
        optionSchema: source.optionSchema ?? undefined,
        sourceData: toInputJson(source),
        publishedAt: status === PublicationStatus.PUBLISHED ? new Date() : null,
      },
      create: {
        id: source.id,
        code: asText(source.code, source.id),
        supplierCode: asText(source.supplierCode) || null,
        parentCode: asText(source.parentCode) || null,
        slug: source.slug,
        name: source.name,
        shortName: asText(source.shortName) || null,
        description: asText(source.description) || null,
        detailedDescription: asText(source.detailedDescription) || null,
        priceHt: source.priceHT ?? 0,
        minPriceHt: source.minPriceHT ?? null,
        maxPriceHt: source.maxPriceHT ?? null,
        stock: source.stock ?? 0,
        leadTime: asText(source.delay) || null,
        imageReference: asText(source.imageRef) || null,
        publicationStatus: status,
        supplierId: supplierIds.get(asText(source.manufacturer)) ?? null,
        categoryId: categoryIds.get(asText(source.categorySlug)) ?? null,
        optionSchema: source.optionSchema ?? undefined,
        sourceData: toInputJson(source),
        publishedAt: status === PublicationStatus.PUBLISHED ? new Date() : null,
      },
    });

    await prisma.productFeature.deleteMany({ where: { productId: source.id } });
    await prisma.productVariant.deleteMany({ where: { productId: source.id } });
    await prisma.productMedia.deleteMany({ where: { productId: source.id } });
    await prisma.productDocument.deleteMany({ where: { productId: source.id } });

    if (source.features?.length) {
      await prisma.productFeature.createMany({
        data: source.features
          .filter((feature) => feature.label && feature.value)
          .map((feature, sortOrder) => ({
            productId: source.id,
            label: asText(feature.label),
            value: asText(feature.value),
            sortOrder,
          })),
      });
    }

    const variants = source.variants ?? [];
    const variantIdCounts = new Map<string, number>();
    for (const variant of variants) {
      const rawId = asText(variant.id, asText(variant.code, "variant"));
      variantIdCounts.set(rawId, (variantIdCounts.get(rawId) ?? 0) + 1);
    }

    const insertedVariantIds = new Set<string>();
    for (const variant of variants) {
      const rawId = asText(variant.id, asText(variant.code, "variant"));
      const baseVariantId = `${source.id}::${rawId}`;
      const hasDuplicateSourceId = (variantIdCounts.get(rawId) ?? 0) > 1;

      // Some ERP rows share the same variant ID while representing different products.
      // Add a deterministic fingerprint only when needed, so IDs stay stable across seeds.
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({
          code: asText(variant.code),
          supplierCode: asText(variant.supplierCode),
          name: asText(variant.name),
          label: asText(variant.label),
          priceHT: variant.priceHT ?? null,
          imageRef: asText(variant.imageRef),
          options: variant.options ?? null,
        }))
        .digest("hex")
        .slice(0, 12);
      const variantId = hasDuplicateSourceId
        ? `${baseVariantId}::${fingerprint}`
        : baseVariantId;

      // Ignore a strictly duplicated ERP row while preserving distinct variants that
      // accidentally reuse the same source ID.
      if (insertedVariantIds.has(variantId)) continue;
      insertedVariantIds.add(variantId);

      await prisma.productVariant.create({
        data: {
          id: variantId,
          productId: source.id,
          code: asText(variant.code, variant.id),
          supplierCode: asText(variant.supplierCode) || null,
          name: asText(variant.name, source.name),
          label: asText(variant.label) || null,
          priceHt: variant.priceHT ?? source.priceHT ?? 0,
          stock: variant.stock ?? 0,
          leadTime: asText(variant.delay) || null,
          imageReference: asText(variant.imageRef) || null,
          options: variant.options ?? undefined,
          sourceData: toInputJson(variant),
          features: variant.features?.length
            ? {
                create: variant.features
                  .filter((feature) => feature.label && feature.value)
                  .map((feature, sortOrder) => ({
                    label: asText(feature.label),
                    value: asText(feature.value),
                    sortOrder,
                  })),
              }
            : undefined,
        },
      });
    }

    if (publicImages.length) {
      await prisma.productMedia.createMany({
        data: publicImages.map((url, sortOrder) => ({
          productId: source.id,
          url,
          sourceUrl: sourceImages[sortOrder] ?? null,
          altText: source.name,
          isPrimary: sortOrder === 0,
          sortOrder,
        })),
      });
    }

    if (publicDocuments.length) {
      await prisma.productDocument.createMany({
        data: publicDocuments.map((url, sortOrder) => ({
          productId: source.id,
          name: path.basename(url),
          type: DocumentType.TECHNICAL_SHEET,
          url,
          sourceUrl: sourceDocuments[sortOrder] ?? null,
          isPublic: true,
          sortOrder,
        })),
      });
    }

    if ((index + 1) % 50 === 0 || index === products.length - 1) {
      console.log(`Catalogue importé : ${index + 1}/${products.length}`);
    }
  }
}

async function seedAdministration() {
  await prisma.adminUser.upsert({
    where: { email: "admin@oyste.fr" },
    update: { role: AdminRole.SUPER_ADMIN, status: UserStatus.INVITED },
    create: {
      email: "admin@oyste.fr",
      firstName: "Administrateur",
      lastName: "OYSTE",
      role: AdminRole.SUPER_ADMIN,
      status: UserStatus.INVITED,
      invitedAt: new Date(),
    },
  });

  const settings = [
    { key: "site.name", value: "OYSTE", description: "Nom public du site", isPublic: true },
    { key: "site.currency", value: "EUR", description: "Devise du catalogue", isPublic: true },
    { key: "site.taxRate", value: 20, description: "Taux de TVA par défaut", isPublic: false },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    });
  }
}

async function main() {
  const products = await loadJson<ProductSource[]>("data/catalogue/products.json");
  const manifest = await loadJson<Record<string, MediaManifestEntry>>("data/catalogue/media-manifest.json");

  console.log(`Initialisation OYSTE : ${products.length} produits détectés.`);
  await seedReferenceData(products);
  await seedProducts(products, manifest);
  await seedAdministration();

  const [productCount, variantCount, supplierCount, categoryCount] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.supplier.count(),
    prisma.category.count(),
  ]);

  console.log("Seed OYSTE terminé.", { productCount, variantCount, supplierCount, categoryCount });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
