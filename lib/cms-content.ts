import { quickLinksSchema, slidesSchema } from "./cms-validation";
import { getProductImageUrl } from "@/lib/product-images";

export type CmsContent = {
  version: 2;
  home: {
    heroEnabled: boolean;
    heroEyebrow: string;
    heroTitle: string;
    heroAccent: string;
    heroText: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    heroImage: string;
    quickLinks: Array<{ label: string; href: string; enabled: boolean; order: number }>;
    slides: Array<{ label: string; title: string; text: string; href: string; image: string; ctaLabel: string; enabled: boolean; order: number }>;
    categoryEyebrow: string;
    categoryTitle: string;
    catalogueLabel: string;
    catalogueHref: string;
    supplierEyebrow: string;
    supplierTitle: string;
  };
  topbar: { message: string; email: string; hours: string; enabled: boolean };
  navigation: Array<{ label: string; href: string }>;
  footer: {
    description: string;
    email: string;
    hours: string;
    area: string;
    ctaEyebrow: string;
    ctaTitle: string;
    ctaText: string;
    ctaLabel: string;
    ctaHref: string;
  };
  editorial: {
    deliveryTitle: string;
    deliveryIntro: string;
    contactTitle: string;
    contactIntro: string;
  };
};

export const defaultCmsContent: CmsContent = {
  version: 2,
  home: {
    heroEnabled: true,
    heroEyebrow: "L’expertise industrielle en ligne",
    heroTitle: "Votre partenaire",
    heroAccent: "en levage industriel.",
    heroText:
      "Plus de 2 000 références et des solutions complètes pour équiper, sécuriser et optimiser vos ateliers.",
    primaryLabel: "Découvrir le catalogue",
    primaryHref: "/catalogue/levage",
    secondaryLabel: "Configurer ma potence",
    secondaryHref: "/configurateur",
    heroImage: "/images/hero-potence.png",
    quickLinks: [
      { label: "Potences", href: "/configurateur", enabled: true, order: 0 },
      { label: "Palans", href: "/catalogue/levage?famille=palan", enabled: true, order: 1 },
      { label: "Portiques", href: "/catalogue/levage?famille=portique", enabled: true, order: 2 },
      { label: "Motorisation SEW", href: "/catalogue/motorisation-sew", enabled: true, order: 3 },
      { label: "Manutention", href: "/catalogue/manutention-au-sol", enabled: true, order: 4 },
    ],
    slides: [
    { label: "Levage", title: "Potences configurées pour votre atelier", text: "Définissez la charge, la portée, la fixation et les options adaptées à votre besoin.", href: "/configurateur", enabled: true, order: 0, ctaLabel: "Découvrir", image: getProductImageUrl("PFI2502000") },
    { label: "Palans", title: "Levage manuel ou électrique", text: "Choisissez votre technologie, votre capacité et les paramètres utiles à l’installation.", href: "/catalogue/levage?famille=palan", enabled: true, order: 1, ctaLabel: "Découvrir", image: getProductImageUrl("CB010") },
    { label: "Manutention", title: "Équipez vos flux et vos postes", text: "Transpalettes, gerbeurs, tables élévatrices et équipements d’atelier.", href: "/catalogue/manutention-au-sol", enabled: true, order: 2, ctaLabel: "Découvrir", image: getProductImageUrl("AC251000") },
    ],
    categoryEyebrow: "Nos catégories",
    categoryTitle: "L’essentiel de l’équipement industriel",
    catalogueLabel: "Voir tout le catalogue →",
    catalogueHref: "/catalogue",
    supplierEyebrow: "Nos fournisseurs",
    supplierTitle: "Des marques de référence pour vos équipements",
  },
  topbar: {
    message: "Solutions de levage, manutention et équipements industriels",
    email: "contact@oyste.fr",
    hours: "Lun - Ven : 8h00 - 12h00 / 13h30 - 17h30",
    enabled: true,
  },
  navigation: [
    { label: "Levage", href: "/catalogue/levage" },
    { label: "Manutention", href: "/catalogue/manutention-au-sol" },
    { label: "Motorisation SEW", href: "/catalogue/motorisation-sew" },
    { label: "Stockage", href: "/catalogue/stockage-emballage" },
    { label: "Accès hauteur", href: "/catalogue/acces-hauteur" },
    { label: "Services", href: "/services" },
    { label: "Qui sommes-nous ?", href: "/a-propos" },
    { label: "Contact", href: "/contact" },
  ],
  footer: {
    description:
      "La plateforme professionnelle dédiée au levage, à la manutention, à la motorisation et aux équipements industriels.",
    email: "contact@oyste.fr",
    hours: "Lun – Ven : 8h00 – 12h00\n13h30 – 17h30",
    area: "France",
    ctaEyebrow: "Étude & accompagnement sur mesure",
    ctaTitle: "Donnez une nouvelle dimension à votre projet industriel.",
    ctaText:
      "De la sélection du matériel à la définition d’une solution complète, notre équipe vous accompagne avec une approche technique, claire et adaptée à votre environnement.",
    ctaLabel: "Contactez-nous",
    ctaHref: "/contact#formulaire",
  },
  editorial: {
    deliveryTitle: "Une livraison adaptée à chaque équipement",
    deliveryIntro:
      "Plusieurs solutions de transport peuvent être proposées selon les caractéristiques de votre commande et votre destination.",
    contactTitle: "Parlons de votre projet",
    contactIntro:
      "Notre équipe vous accompagne dans le choix et la définition de vos équipements industriels.",
  },
};

export function mergeCms(value: unknown): CmsContent {
  const incoming = (
    value && typeof value === "object" ? value : {}
  ) as Partial<CmsContent>;
  return {
    version: 2,
    home: {
      ...defaultCmsContent.home, ...(incoming.home ?? {}),
      quickLinks: quickLinksSchema.safeParse(incoming.home?.quickLinks).data ?? defaultCmsContent.home.quickLinks,
      slides: slidesSchema.safeParse(incoming.home?.slides).data ?? defaultCmsContent.home.slides,
    },
    topbar: { ...defaultCmsContent.topbar, ...(incoming.topbar ?? {}) },
    navigation: (() => {
      const source =
        Array.isArray(incoming.navigation)
          ? incoming.navigation
          : defaultCmsContent.navigation;
      if(incoming.version === 2) return source;
      return source.map((item) =>
        item.href === "/realisations" ||
        item.label.toLowerCase().includes("réalisation")
          ? { label: "Qui sommes-nous ?", href: "/a-propos" }
          : item,
      );
    })(),
    footer: {
      ...defaultCmsContent.footer,
      ...(incoming.footer ?? {}),
      area:
        incoming.version !== 2 && incoming.footer?.area === "France & Europe"
          ? "France"
          : (incoming.footer?.area ?? defaultCmsContent.footer.area),
    },
    editorial: {
      ...defaultCmsContent.editorial,
      ...(incoming.editorial ?? {}),
    },
  };
}


export function orderedVisible<T extends { enabled: boolean; order: number }>(items: T[]): T[] {
  return items.filter(item => item.enabled).sort((a, b) => a.order - b.order);
}
