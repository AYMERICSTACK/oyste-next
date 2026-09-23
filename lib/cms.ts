import { prisma } from "@/lib/db/prisma";

export type CmsContent = {
  home: {
    heroEyebrow: string;
    heroTitle: string;
    heroAccent: string;
    heroText: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    heroImage: string;
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
  home: {
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

function mergeCms(value: unknown): CmsContent {
  const incoming = (
    value && typeof value === "object" ? value : {}
  ) as Partial<CmsContent>;
  return {
    home: { ...defaultCmsContent.home, ...(incoming.home ?? {}) },
    topbar: { ...defaultCmsContent.topbar, ...(incoming.topbar ?? {}) },
    navigation: (() => {
      const source =
        Array.isArray(incoming.navigation) && incoming.navigation.length
          ? incoming.navigation
          : defaultCmsContent.navigation;
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
        incoming.footer?.area === "France & Europe"
          ? "France"
          : (incoming.footer?.area ?? defaultCmsContent.footer.area),
    },
    editorial: {
      ...defaultCmsContent.editorial,
      ...(incoming.editorial ?? {}),
    },
  };
}

export async function getCmsContent(): Promise<CmsContent> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "cms.public" },
    });
    return mergeCms(setting?.value);
  } catch {
    return defaultCmsContent;
  }
}

export async function saveCmsContent(value: CmsContent, userId?: string) {
  const clean = mergeCms(value);
  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: "cms.public" },
      update: {
        value: clean as any,
        isPublic: true,
        description: "Contenus publics administrables depuis le CMS OYSTE",
      },
      create: {
        key: "cms.public",
        value: clean as any,
        isPublic: true,
        description: "Contenus publics administrables depuis le CMS OYSTE",
      },
    }),
    prisma.auditLog.create({
      data: {
        action: "CMS_UPDATE",
        entityType: "SiteContent",
        entityId: "cms.public",
        userId,
        metadata: { sections: Object.keys(clean) } as any,
      },
    }),
  ]);
  return clean;
}
