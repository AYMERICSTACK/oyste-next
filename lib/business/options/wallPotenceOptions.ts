import type { BusinessChoice } from "../types";

export const wallFixingSupportChoices: BusinessChoice[] = [
  {
    id: "concrete-wall",
    label: "Mur béton",
    description: "La potence est fixée directement sur un mur béton adapté.",
  },
  {
    id: "metal-post",
    label: "Poteau métallique / poteau béton",
    description: "La potence est fixée sur un poteau existant avec le principe de fixation adapté.",
  },
];

export const wallPostFixingChoices: BusinessChoice[] = [
  {
    id: "clamp",
    label: "À clamer",
    description: "Le kit vient serrer le poteau sans l’encercler complètement.",
  },
  {
    id: "belt",
    label: "À ceinturer",
    description: "Le kit entoure le poteau pour une fixation répartie autour du support.",
  },
  {
    id: "standard-bolted",
    label: "Standard à boulonner",
    description: "Fixation standard par boulons traversants, à la charge du client.",
  },
];

export const wallPostWidthChoices: BusinessChoice[] = [
  {
    id: "220",
    label: "Jusqu’à 220 mm",
    description: "Pour les poteaux dont la largeur reste inférieure ou égale à 220 mm.",
  },
  {
    id: "300",
    label: "Jusqu’à 300 mm",
    description: "Pour les poteaux plus larges, jusqu’à 300 mm maximum.",
  },
];

export const wallMechanicalOptionChoices: BusinessChoice[] = [
  {
    id: "axe-inox",
    label: "Axe inox",
    description: "Renforce la résistance de l’axe dans les environnements exposés.",
    actions: [{ type: "add", ref: "AXEINOX1" }],
  },
  {
    id: "butees-reglables",
    label: "Butées réglables",
    description: "Permettent de limiter la rotation selon la zone de travail souhaitée.",
    actions: [{ type: "add", ref: "BUTREG1801" }],
  },
  {
    id: "verrouillage",
    label: "Verrouillage une position",
    description: "Permet de maintenir la flèche dans une position de parking définie.",
    actions: [{ type: "add", ref: "VERROU1" }],
  },
  {
    id: "verrouillage-multiposition",
    label: "Verrouillage multiposition",
    description: "Permet de bloquer la flèche sur plusieurs positions de parking.",
    actions: [{ type: "add", ref: "VERROUM" }],
  },
  {
    id: "ralentisseur",
    label: "Ralentisseur",
    description: "Améliore le confort d’utilisation en limitant les mouvements brusques.",
    actions: [{ type: "add", ref: "RALENT" }],
  },
  {
    id: "butoir",
    label: "Butoirs de palan",
    description: "Limitent la course du palan aux extrémités de la poutre.",
    actions: [{ type: "add", ref: "BUTOIR" }],
  },
];

export const wallElectricalOptionChoices: BusinessChoice[] = [
  {
    id: "interrupteur-cadenassable",
    label: "Interrupteur cadenassable",
    description: "Permet une coupure électrique verrouillable pour sécuriser l’installation.",
    actions: [{ type: "add", ref: "INTERSB20A" }],
  },
];

export const wallOutsideOptionChoices: BusinessChoice[] = [
  {
    id: "etancheite",
    label: "Étanchéité de l’axe",
    description: "Protège l’axe de rotation en environnement extérieur.",
    actions: [{ type: "add", ref: "ETANCHAF" }],
  },
  {
    id: "peinture-epoxy",
    label: "Peinture époxy extérieure",
    description: "Finition renforcée pour améliorer la tenue en environnement exposé.",
    actions: [{ type: "add", ref: "EPOXYPM" }],
  },
  {
    id: "capot-palan-electrique",
    label: "Protection palan électrique",
    description: "Capot de protection adapté à un palan électrique exposé.",
    actions: [{ type: "add", ref: "CAPOTPE" }],
  },
  {
    id: "toiture-simple",
    label: "Toiture de protection",
    description: "Protection simple pour limiter l’exposition directe aux intempéries.",
    actions: [{ type: "add", ref: "CAPOT1F" }],
  },
  {
    id: "capot-palan-manuel",
    label: "Protection palan manuel",
    description: "Capot de protection adapté à un palan manuel exposé.",
    actions: [{ type: "add", ref: "CAPOTPM" }],
  },
];
