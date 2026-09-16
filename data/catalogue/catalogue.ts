import {
  type LucideIcon,
  Archive,
  ArrowUpFromLine,
  Boxes,
  Cable,
  Component,
  Factory,
  Forklift,
  Gauge,
  HardHat,
  Layers3,
  Magnet,
  Move3D,
  PackageCheck,
  PackagePlus,
  Pickaxe,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Wrench,
} from "lucide-react";

export type CatalogueUniverse = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  countLabel: string;
  icon: LucideIcon;
  accent: string;
  href: string;
  mode: "assistant" | "catalogue" | "coming";
  tags: string[];
};

export type CatalogueProductGroup = {
  code: string;
  name: string;
  family: string;
  price: string;
  description: string;
  href: string;
  cta: string;
  imageRef?: string;
  badge?: string;
};

export const configuredPotenceFamilies = ["PFI", "PFT", "PMI", "PMT", "PMA", "PMAM"];

export const catalogueUniverses: CatalogueUniverse[] = [
  {
    slug: "levage",
    title: "Levage",
    subtitle: "Palans, portiques et potences",
    countLabel: "9 familles",
    description:
      "Accessoires de levage, charges d’essai, élévateurs de charge, palans, treuils, portiques, potences et tripodes. Les potences murales et sur fût passent par le configurateur.",
    icon: Factory,
    accent: "bg-[#007f8f]",
    href: "/catalogue/levage",
    mode: "catalogue",
    tags: ["Palan", "Treuil", "Portique", "Potence"],
  },
  {
    slug: "manutention-au-sol",
    title: "Manutention au sol",
    subtitle: "Atelier & logistique",
    countLabel: "10 familles",
    description:
      "Chariots, diables, gerbeurs, grues d’atelier, tables élévatrices, tireurs pousseurs, transpalettes et accessoires de chariot élévateur.",
    icon: Forklift,
    accent: "bg-orange-600",
    href: "/catalogue/manutention-au-sol",
    mode: "catalogue",
    tags: ["Chariots", "Diables", "Gerbeurs", "Transpalettes"],
  },
  {
    slug: "motorisation-sew",
    title: "Motorisation SEW",
    subtitle: "Huile, moteur, variateur",
    countLabel: "3 familles",
    description:
      "Huiles, moteurs et variateurs SEW pour les besoins de motorisation industrielle.",
    icon: Gauge,
    accent: "bg-[#005466]",
    href: "/catalogue/motorisation-sew",
    mode: "catalogue",
    tags: ["Huile", "Moteur", "Variateur"],
  },
  {
    slug: "stockage-emballage",
    title: "Stockage et emballage",
    subtitle: "Quai & cerclage",
    countLabel: "4 familles",
    description:
      "Dérouleurs, équipements de quai, kits de cerclage et outils de cerclage.",
    icon: Archive,
    accent: "bg-slate-950",
    href: "/catalogue/stockage-emballage",
    mode: "catalogue",
    tags: ["Dérouleurs", "Quai", "Cerclage", "Outils"],
  },
  {
    slug: "acces-hauteur",
    title: "Accès en hauteur",
    subtitle: "Sécurité & poste de travail",
    countLabel: "4 familles",
    description:
      "Escabeaux, marchepieds, nacelles et plateformes individuelles modulables pour intervenir en hauteur en sécurité.",
    icon: ArrowUpFromLine,
    accent: "bg-[#007f8f]",
    href: "/catalogue/acces-hauteur",
    mode: "catalogue",
    tags: ["Escabeau", "Marchepied", "Nacelle", "Plateforme"],
  },
];

export const mainFamilies = catalogueUniverses;

export const catalogueHighlights = [
  {
    label: "Données de départ",
    value: "2 040",
    text: "lignes produit dans la base catalogue analysée",
  },
  {
    label: "Assistant dédié",
    value: "6",
    text: "familles de potences sorties du catalogue classique",
  },
  {
    label: "Catalogue standard",
    value: "1 900+",
    text: "références orientées navigation, recherche et fiche produit",
  },
];

export const featuredSolutions: CatalogueProductGroup[] = [
  {
    code: "CONFIG-POTENCE",
    name: "Configurer une potence",
    family: "Assistant guidé",
    price: "Prix calculé selon vos choix",
    description:
      "Pour les potences PFI, PFT, PMI, PMT, PMA et PMAM, le client répond à des questions simples au lieu de choisir des références techniques.",
    href: "/configurateur",
    cta: "Lancer l'assistant",
    imageRef: "PFI2502000",
    badge: "Configurateur",
  },
  {
    code: "PORT500080004500",
    name: "Portique d'atelier déplacable en charge",
    family: "Portiques",
    price: "Produit catalogue",
    description:
      "Gamme portiques vendue comme produit standard : capacité, hauteur et portée sont consultées dans le catalogue.",
    href: "/catalogue/levage/port-portique-d-atelier-deplacable-en-charge",
    cta: "Voir la fiche",
    imageRef: "PORT500080004500",
    badge: "Standard",
  },
  {
    code: "PORTI20004000H2",
    name: "Portique aluminium mobile",
    family: "Portiques aluminium",
    price: "Produit catalogue",
    description:
      "Portique mobile léger pour interventions, maintenance et postes temporaires.",
    href: "/catalogue/levage/porti-portique-aluminium-mobile",
    cta: "Voir la fiche",
    imageRef: "PORTI20004000H2",
    badge: "Mobile",
  },
  {
    code: "PALFIX",
    name: "Palans et palonniers",
    family: "Levage standard",
    price: "Levage standard",
    description:
      "Palans, palonniers, treuils et équipements de levage pouvant être vendus seuls ou associés à une installation.",
    href: "/catalogue/levage",
    cta: "Voir la gamme",
    imageRef: "ER2M001HL",
    badge: "Levage",
  },
  {
    code: "MANUTENTION",
    name: "Manutention au sol",
    family: "Atelier & logistique",
    price: "Catalogue manutention",
    description:
      "Transpalettes, gerbeurs, diables, tables élévatrices, grues d'atelier et rouleurs.",
    href: "/catalogue/manutention-au-sol",
    cta: "Découvrir",
    imageRef: "ACPREMIUM",
    badge: "Catalogue",
  },
  {
    code: "ACCES",
    name: "Accès en hauteur",
    family: "Sécurité atelier",
    price: "Accès sécurisé",
    description:
      "Escabeaux, marchepieds, nacelles et plateformes pour intervenir en hauteur en sécurité.",
    href: "/catalogue/acces-hauteur",
    cta: "Découvrir",
    imageRef: "ES2M",
    badge: "Catalogue",
  },
];

export const levageGroups = [
  {
    id: "portiques",
    title: "Portiques",
    count: "621 références",
    text: "Portiques d'atelier, portiques aluminium et portiques motorisés. Ces familles restent en catalogue : le client consulte un modèle et demande un devis ou ajoute au panier.",
    icon: Move3D,
    refs: ["PORT", "PORTI", "PORTMOT"],
  },
  {
    id: "palans",
    title: "Palans & palonniers",
    count: "371 références",
    text: "Palans, treuils, palonniers fixes ou réglables. Ils peuvent être vendus seuls ou proposés dans l'assistant potence.",
    icon: Component,
    refs: ["PALFIX", "PALREG", "PALH", "PALHR", "TREUIL"],
  },
  {
    id: "accessoires",
    title: "Accessoires de levage",
    count: "76 références",
    text: "Fixations, butées, capots, lignes d'alimentation et composants complémentaires accessibles depuis les fiches produits.",
    icon: PackagePlus,
    refs: ["Fixations", "Butées", "Capots", "Lignes"],
  },
];

export const guidanceSteps = [
  "Charge et portée",
  "Fixation et hauteur",
  "Options compatibles",
  "Palan si besoin",
  "Prix final",
];

export const cataloguePrinciples = [
  {
    title: "Potences guidées",
    text: "Les potences ne sont plus de simples fiches catalogue : elles passent par l'assistant pour éviter les mauvais choix.",
    icon: SlidersHorizontal,
  },
  {
    title: "Produits standards",
    text: "Portiques, manutention, accès hauteur et stockage restent consultables comme un catalogue industriel classique.",
    icon: Boxes,
  },
  {
    title: "Fiches enrichies",
    text: "Chaque famille pourra ensuite recevoir ses images, délais, documents, accessoires et demandes de devis.",
    icon: Wrench,
  },
];

export const serviceHighlights = [
  {
    title: "Configuration intelligente",
    text: "Le client choisit sa charge, sa portée et ses options. Le site affiche uniquement les choix cohérents.",
    icon: SlidersHorizontal,
  },
  {
    title: "Catalogue structuré",
    text: "Les produits standards restent accessibles par univers, famille et recherche, sans mélanger les familles configurables.",
    icon: Layers3,
  },
  {
    title: "Commande simplifiée",
    text: "La solution complète peut ensuite être ajoutée au panier : produit, palan, accessoires et options sélectionnées.",
    icon: ShoppingCart,
  },
];
