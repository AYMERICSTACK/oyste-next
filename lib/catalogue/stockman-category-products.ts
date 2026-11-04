import { getStockmanSellingPriceHT } from "@/lib/catalogue/stockman-selling-prices";
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CatalogueProduct } from "./repository";

type StockmanRecord = {
  reference?: string;
  title?: string;
  category?: string;
  subcategory?: string;
  imageUrl?: string;
};

type Destination = {
  rayon: string;
  famille: string;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(record: StockmanRecord): Destination | null {


  // STOCKMAN_RAYONNAGE_V52
  const rayonCategory = normalize(record.category || "");
  const rayonSubcategory = normalize(record.subcategory || "");

  if (
    /equipement de quai et de stockage/.test(rayonCategory) &&
    /presentoirs et etageres/.test(rayonSubcategory)
  ) {
    return {
      rayon: "stockage-emballage",
      famille: "rayonnage"
    };
  }

  // STOCKMAN_PRECISION_V50
  const preciseCategory = normalize(record.category || "");
  const preciseSubcategory = normalize(record.subcategory || "");

  if (/plv stockman/.test(preciseCategory)) return null;

  if (/accessoires de grues/.test(preciseSubcategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "accessoires-grues-atelier"
    };
  }

  if (/options et accessoires pour tables elevatrices/.test(preciseSubcategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "accessoires-tables-elevatrices"
    };
  }

  if (/retention et stockage/.test(preciseSubcategory) &&
      /manutention des futs/.test(preciseCategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "retention-futs"
    };
  }

  if (/feuillards et consommables/.test(preciseSubcategory)) {
    return {
      rayon: "stockage-emballage",
      famille: "feuillards-consommables"
    };
  }

  // STOCKMAN_PRIORITY_V47
  const priorityCategory = normalize(record.category || "");
  const prioritySubcategory = normalize(record.subcategory || "");

  if (/plv stockman/.test(priorityCategory)) return null;

  if (/pneus stellana/.test(priorityCategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "pneus-chariots-elevateurs"
    };
  }

  if (/chariots retractables/.test(prioritySubcategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "chariot-retractable"
    };
  }

  if (/chariots et servantes/.test(prioritySubcategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "chariot-et-servante"
    };
  }

  if (/pinces de levage|aimants de levage|griffes de levage|elingues|palonniers|crochets de levage|accessoires de levage/.test(prioritySubcategory)) {
    return {
      rayon: "levage",
      famille: "accessoires-de-levage"
    };
  }

  if (/tables elevatrices/.test(priorityCategory)) {
    return {
      rayon: "manutention-au-sol",
      famille: "table-elevatrice"
    };
  }

  if (/convoyeurs/.test(priorityCategory)) {
    return {
      rayon: "stockage-emballage",
      famille: "convoyeur"
    };
  }

  const category = normalize(record.category || "");
  const subcategory = normalize(record.subcategory || "");
  const title = normalize(record.title || "");
  const text = `${category} ${subcategory}`;
  const all = `${text} ${title}`;

  // Les familles hors navigation OYSTE ne sont pas forcees
  // dans une sous-categorie inappropriee.
  if (/presentoir|plv stockman/.test(text)) return null;
  if (/pneus stellana pour chariot elevateur/.test(category)) {
    return {
      rayon: "manutention-au-sol",
      famille: "pneus-chariots-elevateurs"
    };
  }

  // Levage
  if (/palan/.test(text)) {
    return { rayon: "levage", famille: "palan" };
  }
  if (/treuil/.test(text)) {
    return { rayon: "levage", famille: "treuil" };
  }
  if (/portique/.test(text)) {
    return { rayon: "levage", famille: "portique" };
  }
  if (/potence murale/.test(text)) {
    return { rayon: "levage", famille: "potence-murale" };
  }
  if (/potence/.test(text)) {
    return { rayon: "levage", famille: "potence-sur-fut" };
  }
  if (/pince de levage|accessoire de levage|aimant de levage|griffe de levage|anneau de levage|elingue|palonnier|crochet de levage/.test(text)) {
    return { rayon: "levage", famille: "accessoires-de-levage" };
  }

  // Manutention
  if (/accessoire.*chariot elevateur|equipement.*chariot elevateur/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "accessoire-de-chariot-elevateur" };
  }
  if (/gerbeur|chariot retractable/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "gerbeur" };
  }
  if (/transpalette/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "transpalette" };
  }
  if (/diable/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "diable" };
  }
  if (/table elevatrice/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "table-elevatrice" };
  }
  if (/grue d atelier|grue datelier/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "grue-datelier" };
  }
  if (/cric|verin/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "cric-et-verin" };
  }
  if (/patin rouleur|coin roulant|rouleur/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "coins-roulants-et-patins-rouleurs" };
  }
  if (/tireur pousseur|tracteur pousseur/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "tireur-pousseur" };
  }
  if (/chariot et servante|chariots et servantes|chariot de manutention|servante/.test(text)) {
    return { rayon: "manutention-au-sol", famille: "chariot-et-servante" };
  }

  // Stockage et emballage
  if (/derouleur|devidoir/.test(text)) {
    return { rayon: "stockage-emballage", famille: "derouleurs" };
  }
  if (/kit de cerclage/.test(text)) {
    return { rayon: "stockage-emballage", famille: "kits-de-cerclage" };
  }
  if (/cerclage|cercleuse|tendeur de feuillard/.test(text)) {
    return { rayon: "stockage-emballage", famille: "outils-de-cerclage" };
  }
  if (/equipement de quai|rampe de chargement|pont de chargement|cale de roue|but[eo]ir de quai/.test(text)) {
    return { rayon: "stockage-emballage", famille: "equipement-de-quai" };
  }

  // Acces en hauteur
  if (/escabeau/.test(text)) {
    return { rayon: "acces-hauteur", famille: "escabeau" };
  }
  if (/marchepied/.test(text)) {
    return { rayon: "acces-hauteur", famille: "marchepied" };
  }
  if (/nacelle/.test(text)) {
    return { rayon: "acces-hauteur", famille: "nacelle" };
  }
  if (/plate.forme individuelle/.test(text)) {
    return { rayon: "acces-hauteur", famille: "plate-forme-individuelle-modulable" };
  }

  // STOCKMAN_CLASSIFICATION_V41

  if (/tables elevatrices/.test(category)) {
    return { rayon: "manutention-au-sol", famille: "table-elevatrice" };
  }

  if (/equipement datelier/.test(category)) {
    if (/grue/.test(subcategory)) {
      return { rayon: "manutention-au-sol", famille: "grue-datelier" };
    }
    if (/presse/.test(subcategory)) {
      return { rayon: "manutention-au-sol", famille: "presse-atelier" };
    }
  }

  if (/convoyeurs/.test(category)) {
    return { rayon: "stockage-emballage", famille: "convoyeur" };
  }

  if (/emballage/.test(category)) {
    if (/feuillard|consommable/.test(subcategory)) {
      return { rayon: "stockage-emballage", famille: "feuillards-consommables" };
    }
    if (/adhesif/.test(subcategory)) {
      return { rayon: "stockage-emballage", famille: "adhesif" };
    }
    if (/banderoleuse/.test(subcategory)) {
      return { rayon: "stockage-emballage", famille: "banderoleuse" };
    }
    return { rayon: "stockage-emballage", famille: "outils-de-cerclage" };
  }

  if (/manutention des futs/.test(category)) {
    return { rayon: "manutention-au-sol", famille: "manutention-des-futs" };
  }

  if (/gamme magasinage/.test(category)) {
    if (/chariots retractables/.test(subcategory)) {
      return { rayon: "manutention-au-sol", famille: "chariot-retractable" };
    }
    if (/preparateurs de commande/.test(subcategory)) {
      return { rayon: "manutention-au-sol", famille: "preparateur-de-commandes" };
    }
    if (/tracteurs/.test(subcategory)) {
      return { rayon: "manutention-au-sol", famille: "tracteur-industriel" };
    }
  }

  if (/equipement de quai et de stockage/.test(category)) {
    return { rayon: "stockage-emballage", famille: "rayonnage" };
  }

  if (/tabouret de mecanicien/.test(subcategory)) {
    return { rayon: "manutention-au-sol", famille: "equipement-atelier" };
  }

  if (/diables a pneus/.test(subcategory)) {
    return { rayon: "manutention-au-sol", famille: "diable" };
  }

  // Aucun classement par defaut : evite les faux positifs.
  void all;
  return null;
}

export function getStockmanCategoryProducts(rayon: string): CatalogueProduct[] {
  const filename = path.join(
    process.cwd(),
    "data", "stockman", "catalogue-produits.json"
  );

  if (!fs.existsSync(filename)) return [];

  const data = JSON.parse(
    fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, "")
  );

  const records: StockmanRecord[] = Array.isArray(data.products)
    ? data.products
    : [];

  return records.flatMap((record): CatalogueProduct[] => {
    if (!record.reference || !record.title) return [];

    const destination = classify(record);
    if (!destination || destination.rayon !== rayon) return [];

    const reference = record.reference.trim();

    return [{
      id: "stockman-" + reference,
      code: reference,
      supplierCode: reference,
      parentCode: "",
      slug: reference.toLowerCase(),
      name: record.title,
      shortName: record.title,
      manufacturer: "STOCKMAN",
      categorySlug: destination.rayon,
      categoryPath: destination.rayon + " > " + destination.famille,
      categories: [destination.rayon, destination.famille],
      description: record.title,
      detailedDescription: "",
      priceHT: getStockmanSellingPriceHT(reference),
      minPriceHT: getStockmanSellingPriceHT(reference),
      delay: "",
      stock: null,
      imageRef: reference,
      features: [],
      href: "/catalogue/stockman/" + encodeURIComponent(reference),
      experienceType: "STANDARD",
      marketingBadges: ["Nous consulter"],
      media: record.imageUrl
        ? [{ url: record.imageUrl, isPrimary: true }]
        : []
    }];
  });
}
