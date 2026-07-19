import type { ComponentType } from "react";
import {
  Building2,
  Cable,
  Factory,
  Hammer,
  PackageCheck,
  PlugZap,
  RotateCcw,
  Ruler,
  ShoppingCart,
  Weight,
  Wrench,
} from "lucide-react";

export type Choice = {
  id: string;
  label: string;
  description: string;
  priceImpact?: number;
  recommended?: boolean;
};

export type Step = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  choices: Choice[];
};

export type ProjectLine = {
  id: string;
  label: string;
  description: string;
  price: number;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

export const steps: Step[] = [
  {
    id: "need",
    eyebrow: "Point de départ",
    title: "Que souhaitez-vous faire ?",
    description:
      "Le site part du besoin réel, puis transforme progressivement votre projet en installation commandable.",
    icon: ShoppingCart,
    choices: [
      {
        id: "lever-charge",
        label: "Lever une charge",
        description: "Choisir une potence, un palan et les accessoires compatibles.",
        recommended: true,
      },
      {
        id: "equiper-poste",
        label: "Équiper un poste de travail",
        description: "Construire une solution complète autour d’un poste industriel.",
      },
      {
        id: "remplacer",
        label: "Remplacer un équipement",
        description: "Retrouver une solution équivalente avec options modernes.",
      },
    ],
  },
  {
    id: "capacity",
    eyebrow: "Charge",
    title: "Quelle charge souhaitez-vous lever ?",
    description:
      "La charge permet de dimensionner la solution et les équipements associés.",
    icon: Weight,
    choices: [
      {
        id: "125",
        label: "Jusqu’à 125 kg",
        description: "Solution légère pour postes de production et maintenance.",
        priceImpact: 1131,
        recommended: true,
      },
      {
        id: "250",
        label: "Jusqu’à 250 kg",
        description: "Usage atelier fréquent avec marge de sécurité confortable.",
        priceImpact: 1390,
      },
      {
        id: "500",
        label: "Jusqu’à 500 kg",
        description: "Charges plus lourdes, structure et palan adaptés.",
        priceImpact: 1690,
      },
      {
        id: "1000",
        label: "Jusqu’à 1 tonne",
        description: "Configuration renforcée avec accessoires compatibles.",
        priceImpact: 2290,
      },
    ],
  },
  {
    id: "reach",
    eyebrow: "Portée",
    title: "Quel rayon de travail souhaitez-vous ?",
    description:
      "La portée correspond au rayon de travail utile autour de la colonne.",
    icon: Ruler,
    choices: [
      {
        id: "2m",
        label: "2 m",
        description: "Poste compact, manutention au plus près de la colonne.",
        priceImpact: 0,
        recommended: true,
      },
      {
        id: "2-5m",
        label: "2,5 m",
        description: "Bon compromis entre compacité et zone de travail.",
        priceImpact: 140,
      },
      {
        id: "3m",
        label: "3 m",
        description: "Zone de travail plus large pour atelier et production.",
        priceImpact: 260,
      },
    ],
  },
  {
    id: "environment",
    eyebrow: "Environnement",
    title: "Où sera installée la solution ?",
    description:
      "L’environnement permet de proposer les protections adaptées à votre installation.",
    icon: Factory,
    choices: [
      {
        id: "atelier",
        label: "Atelier intérieur",
        description: "Configuration standard pour environnement industriel couvert.",
        recommended: true,
      },
      {
        id: "maintenance",
        label: "Zone maintenance",
        description: "Usage polyvalent avec options de commande et alimentation.",
      },
      {
        id: "exterieur",
        label: "Extérieur",
        description: "Des protections adaptées seront proposées pour une installation exposée.",
        priceImpact: 180,
      },
    ],
  },
  {
    id: "fixing",
    eyebrow: "Fixation",
    title: "Quel type de fixation faut-il prévoir ?",
    description:
      "Le configurateur ajoute le kit adapté à votre mode de fixation.",
    icon: Building2,
    choices: [
      {
        id: "dalle",
        label: "Dalle béton",
        description: "Semelle à cheviller pour installation sur dalle adaptée.",
        priceImpact: 0,
        recommended: true,
      },
      {
        id: "massif",
        label: "Massif béton",
        description: "Semelle pour massif béton avec préparation spécifique.",
        priceImpact: 95,
      },
      {
        id: "murale",
        label: "Fixation murale",
        description: "Orientation vers une potence murale si la structure le permet.",
        priceImpact: -120,
      },
    ],
  },
];

export const compatibleLines: ProjectLine[] = [
  {
    id: "palan-kito",
    label: "Palan électrique KITO",
    description: "Palan compatible avec la charge choisie, prêt à intégrer au panier.",
    price: 895,
    icon: Wrench,
  },
  {
    id: "ligne-alim",
    label: "Ligne d’alimentation",
    description: "Alimentation sur rail pour utiliser le palan dans de bonnes conditions.",
    price: 320,
    icon: Cable,
  },
  {
    id: "interrupteur",
    label: "Interrupteur cadenassable",
    description: "Accessoire compatible pour sécuriser l’installation électrique.",
    price: 122.67,
    icon: PlugZap,
  },
  {
    id: "butees",
    label: "Butées de rotation",
    description: "Pour limiter la rotation selon l’implantation du poste.",
    price: 192.4,
    icon: RotateCcw,
  },
  {
    id: "kit-fixation",
    label: "Kit de fixation",
    description: "Chevilles et éléments de fixation selon support sélectionné.",
    price: 89,
    icon: Hammer,
  },
  {
    id: "certificat",
    label: "Dossier produit",
    description: "Fiche technique et documents associés accessibles avec la commande.",
    price: 0,
    icon: PackageCheck,
  },
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}
