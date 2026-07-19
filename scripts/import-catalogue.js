const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = process.cwd();
const SOURCE_CANDIDATES = [
  path.join(ROOT, 'BDD_DATAPLUG_FINAL.xlsx'),
  path.join(ROOT, 'Copie de BDD DATAPLUG FINAL (003).xlsx'),
  path.join(ROOT, 'Copie de BDD DATAPLUG FINAL (003)(2).xlsx'),
  path.join(ROOT, 'data', 'source', 'BDD_DATAPLUG_FINAL.xlsx'),
];

const ALLOWED_MANUFACTURERS = ['ADEI', 'COMEPAL', 'CROMOX', 'HYDROBULL', 'KITO', 'SEW', 'GOLIATH', 'STOCKMAN'];
const CONFIGURATOR_PREFIXES = ['PFI', 'PFT', 'PMI', 'PMT', 'PMA', 'PMAM'];
const OUTPUT_DIR = path.join(ROOT, 'data', 'catalogue');

function findSource() {
  const source = SOURCE_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    throw new Error([
      'BDD catalogue introuvable.',
      'Place le fichier Excel à la racine sous le nom BDD_DATAPLUG_FINAL.xlsx',
      'ou dans data/source/BDD_DATAPLUG_FINAL.xlsx.',
    ].join('\n'));
  }
  return source;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeHeaderMap(headers) {
  const map = new Map();
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function pick(row, map, candidates) {
  for (const name of candidates) {
    const idx = map.get(normalizeHeader(name));
    if (idx !== undefined) {
      const value = row[idx];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  return null;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100) / 100;
  }
  return null;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function categorySlugFromPath(categoryPath, manufacturer, parentCode, name) {
  const text = `${categoryPath} ${manufacturer} ${parentCode} ${name}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (text.includes('motorisation sew') || manufacturer === 'SEW') return 'motorisation-sew';
  if (text.includes('stockage') || text.includes('emballage') || text.includes('cerclage') || text.includes('quai')) return 'stockage-emballage';
  if (text.includes('acces en hauteur') || text.includes('escabeau') || text.includes('marchepied') || text.includes('nacelle') || text.includes('plateforme')) return 'acces-hauteur';
  if (text.includes('manutention au sol') || text.includes('transpalette') || text.includes('gerbeur') || text.includes('diable') || text.includes('grue d') || text.includes('servante') || text.includes('chariot')) return 'manutention-au-sol';
  if (text.includes('portique')) return 'portiques';
  if (text.includes('palan') || text.includes('palonnier') || text.includes('treuil') || text.includes('elingue') || text.includes('levage')) return 'palans-palonniers';
  return 'accessoires-pieces';
}

function shouldExclude({ code, parentCode, categoryPath, name }) {
  const normalizedCode = String(code || '').toUpperCase();
  const normalizedParent = String(parentCode || '').toUpperCase();
  const normalizedText = `${categoryPath} ${name}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!code || !name) return true;
  if (!categoryPath || cleanText(categoryPath) === '') return true;
  if (CONFIGURATOR_PREFIXES.some((prefix) => normalizedCode.startsWith(prefix) || normalizedParent.startsWith(prefix))) return true;
  if (normalizedText.includes('potence')) return true;
  return false;
}

function buildFeatures(row, map) {
  const pairs = [
    ['Nom du premier type d\'option', 'Valeur de la première option'],
    ['Nom du second type d\'option', 'Valeur de la deuxième option'],
    ['Nom du troisième type d\'option', 'Valeur de la troisième option'],
  ];

  const features = [];
  for (const [labelKey, valueKey] of pairs) {
    const label = cleanText(pick(row, map, [labelKey]));
    const value = cleanText(pick(row, map, [valueKey]));
    if (label && value) features.push({ label, value });
  }

  const weight = cleanText(pick(row, map, ['Poids']));
  if (weight) features.push({ label: 'Poids', value: weight });

  const warranty = cleanText(pick(row, map, ['Garantie en mois']));
  if (warranty) features.push({ label: 'Garantie', value: `${warranty} mois` });

  return features;
}

function featureOptions(features) {
  const options = {};
  for (const feature of features) {
    const labelParts = String(feature.label || '').split('/').map((item) => item.trim()).filter(Boolean);
    const valueParts = String(feature.value || '').split('/').map((item) => item.trim()).filter(Boolean);
    if (labelParts.length > 1 && labelParts.length === valueParts.length) {
      labelParts.forEach((label, index) => {
        options[label] = valueParts[index];
      });
    } else if (feature.label && feature.value) {
      options[feature.label] = feature.value;
    }
  }
  return options;
}

function getOptionSchema(variants) {
  const schema = [];
  const labels = [];
  variants.forEach((variant) => {
    Object.keys(variant.options || {}).forEach((label) => {
      if (!labels.includes(label)) labels.push(label);
    });
  });

  for (const label of labels) {
    const values = Array.from(new Set(variants.map((variant) => variant.options?.[label]).filter(Boolean)));
    if (values.length > 1) schema.push({ label, values: values.sort((a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true })) });
  }
  return schema;
}

function parentDisplayName(items) {
  const first = items[0];
  const names = items.map((item) => item.shortName || item.name).filter(Boolean);
  const common = names.find((name) => names.filter((candidate) => candidate === name).length >= Math.max(2, Math.ceil(names.length * 0.5)));
  if (common) return common;

  return (first.name || '')
    .replace(/\b\d+(?:[,.]\d+)?\s?kg\b/gi, '')
    .replace(/\bport[eé]e\s*\d+(?:[,.]\d+)?\s?m\b/gi, '')
    .replace(/\bH(?:SF)?\s?\d+(?:[,.]\d+)?\s?m?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || first.name;
}

function variantLabel(variant) {
  const values = Object.entries(variant.options || {}).map(([label, value]) => `${label} ${value}`);
  return values.length ? values.join(' · ') : variant.name;
}

function buildCatalogue() {
  const source = findSource();
  const workbook = XLSX.readFile(source, { cellDates: true });
  const rawProducts = [];
  const stats = {
    source: path.basename(source),
    allowedManufacturers: ALLOWED_MANUFACTURERS,
    importedAt: new Date().toISOString(),
    importedProducts: 0,
    importedParentProducts: 0,
    importedVariants: 0,
    ignoredRows: 0,
    groupedProducts: 0,
    byManufacturer: {},
    byCategory: {},
  };

  for (const manufacturer of ALLOWED_MANUFACTURERS) {
    const sheet = workbook.Sheets[manufacturer];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
    const headers = rows[0] || [];
    const map = makeHeaderMap(headers);

    for (const row of rows.slice(1)) {
      const code = cleanText(pick(row, map, ['Code produit', 'Code fournisseur']));
      const supplierCode = cleanText(pick(row, map, ['Code fournisseur']));
      const parentCode = cleanText(pick(row, map, ["Code de l'article parent"]));
      const name = cleanText(pick(row, map, ['Nom COMPLET', 'Nom Complet', 'Nom']));
      const shortName = cleanText(pick(row, map, ['Nom']));
      const categoryPath = cleanText(pick(row, map, ['Nom de la première catégorie']));

      if (shouldExclude({ code, parentCode, categoryPath, name })) {
        stats.ignoredRows += 1;
        continue;
      }

      const categorySlug = categorySlugFromPath(categoryPath, manufacturer, parentCode, name);
      const description = cleanText(pick(row, map, ['Description', 'Description (META description)']));
      const detailedDescription = cleanText(pick(row, map, ['Description détaillée'])) || description;
      const priceHT = toNumber(pick(row, map, ['Prix 1 HT', 'Prix publics', 'Prix manuel'])) || toNumber(pick(row, map, ["Prix d'achats", " Prix d'achats "]));
      const delay = cleanText(pick(row, map, ['Délai de disponibilité'])) || 'Délai sur demande';
      const stock = toNumber(pick(row, map, ['Quantité en stock']));
      const imageRef = cleanText(pick(row, map, ['1ère image zoom'])) || code;
      const categories = [categoryPath];
      for (let i = 2; i <= 10; i++) {
        const cat = cleanText(pick(row, map, [`Nom de la ${i}ème catégorie`, `Nom de la ${i}eme catégorie`]));
        if (cat) categories.push(cat);
      }

      const features = buildFeatures(row, map);

      rawProducts.push({
        id: `${manufacturer}-${code}`,
        code,
        supplierCode,
        parentCode,
        name,
        shortName: shortName || name,
        manufacturer,
        categorySlug,
        categoryPath,
        categories,
        description,
        detailedDescription,
        priceHT,
        delay,
        stock,
        imageRef,
        features,
        options: featureOptions(features),
      });

      stats.importedVariants += 1;
      stats.byManufacturer[manufacturer] = (stats.byManufacturer[manufacturer] || 0) + 1;
    }
  }

  const groups = new Map();
  for (const product of rawProducts) {
    const hasParent = product.parentCode && product.parentCode !== product.code;
    const key = hasParent
      ? `${product.manufacturer}:${product.categorySlug}:${product.parentCode}`
      : `${product.manufacturer}:${product.categorySlug}:${product.code}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }

  const products = Array.from(groups.values()).map((items) => {
    items.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    const first = items[0];
    const parentName = parentDisplayName(items);
    const parentCode = first.parentCode || first.code;
    const slug = slugify(`${parentCode}-${parentName}`);
    const prices = items.map((item) => item.priceHT).filter((price) => typeof price === 'number');
    const minPriceHT = prices.length ? Math.min(...prices) : null;
    const maxPriceHT = prices.length ? Math.max(...prices) : null;
    const variants = items.map((item) => ({
      id: item.id,
      code: item.code,
      supplierCode: item.supplierCode,
      name: item.name,
      label: variantLabel(item),
      priceHT: item.priceHT,
      delay: item.delay,
      stock: item.stock,
      imageRef: item.imageRef,
      features: item.features,
      options: item.options,
    }));

    const product = {
      id: `${first.manufacturer}-${parentCode}-${slug}`,
      code: parentCode,
      supplierCode: first.supplierCode,
      parentCode,
      slug,
      name: parentName,
      shortName: parentName,
      manufacturer: first.manufacturer,
      categorySlug: first.categorySlug,
      categoryPath: first.categoryPath,
      categories: first.categories,
      description: first.description,
      detailedDescription: first.detailedDescription,
      priceHT: minPriceHT,
      minPriceHT,
      maxPriceHT,
      delay: first.delay,
      stock: first.stock,
      imageRef: first.imageRef || first.code,
      features: first.features,
      variantCount: variants.length,
      optionSchema: getOptionSchema(variants),
      variants,
      href: `/catalogue/${first.categorySlug}/${slug}`,
    };

    stats.byCategory[product.categorySlug] = (stats.byCategory[product.categorySlug] || 0) + 1;
    if (variants.length > 1) stats.groupedProducts += 1;
    return product;
  });

  products.sort((a, b) => a.categorySlug.localeCompare(b.categorySlug, 'fr') || a.manufacturer.localeCompare(b.manufacturer, 'fr') || a.name.localeCompare(b.name, 'fr'));

  stats.importedProducts = rawProducts.length;
  stats.importedParentProducts = products.length;

  const categories = [
    { slug: 'portiques', title: 'Portiques', description: "Portiques d'atelier, portiques aluminium et solutions de levage mobiles.", count: stats.byCategory.portiques || 0 },
    { slug: 'palans-palonniers', title: 'Palans & palonniers', description: 'Palans, treuils, palonniers, élingues et accessoires de levage.', count: stats.byCategory['palans-palonniers'] || 0 },
    { slug: 'motorisation-sew', title: 'Motorisation SEW', description: 'Moteurs, variateurs, huiles et consommables SEW.', count: stats.byCategory['motorisation-sew'] || 0 },
    { slug: 'manutention-au-sol', title: 'Manutention au sol', description: "Transpalettes, gerbeurs, diables, grues d'atelier, tables élévatrices et servantes.", count: stats.byCategory['manutention-au-sol'] || 0 },
    { slug: 'stockage-emballage', title: 'Stockage & emballage', description: 'Équipement de quai, cerclage, feuillards et outils de conditionnement.', count: stats.byCategory['stockage-emballage'] || 0 },
    { slug: 'acces-hauteur', title: 'Accès en hauteur', description: 'Escabeaux, marchepieds, nacelles et plateformes.', count: stats.byCategory['acces-hauteur'] || 0 },
    { slug: 'accessoires-pieces', title: 'Accessoires & pièces', description: 'Pièces et compléments catalogue vendables hors configurateur.', count: stats.byCategory['accessoires-pieces'] || 0 },
  ];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'products.json'), JSON.stringify(products, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'categories.json'), JSON.stringify(categories, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log('✅ Import catalogue terminé');
  console.log(`   Source: ${stats.source}`);
  console.log(`   Fabricants: ${ALLOWED_MANUFACTURERS.join(', ')}`);
  console.log(`   Variantes importées: ${stats.importedVariants}`);
  console.log(`   Produits parents générés: ${stats.importedParentProducts}`);
  console.log(`   Produits regroupés: ${stats.groupedProducts}`);
  console.log(`   Lignes ignorées: ${stats.ignoredRows}`);
  console.log(`   Catégories: ${Object.entries(stats.byCategory).map(([k,v]) => `${k}=${v}`).join(', ')}`);
}

buildCatalogue();
