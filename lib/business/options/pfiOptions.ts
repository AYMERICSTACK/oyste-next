import type { BusinessChoice } from "../types";

export const pfiFixingChoices: BusinessChoice[] = [
  {
    id: "gabarit-ancrage",
    label: "Gabarit et tiges d'ancrage",
    description: "Kit adapté aux dimensions de la potence configurée.",
  },
  {
    id: "semelle-cheviller",
    label: "Semelle à cheviller sur dalle béton",
    description: "Kit adapté aux dimensions de la potence configurée.",
  },
];

export const pfiMechanicalOptionChoices: BusinessChoice[] = [
  {
    id: "butees-reglables",
    label: "Butées réglables",
    description: "Permettent de limiter la rotation de la potence selon votre zone de travail.",
    actions: [{ type: "add", ref: "BUTREGPF2" }],
  },
  {
    id: "ralentisseur",
    label: "Ralentisseur de rotation",
    description: "Limite les mouvements brusques de la flèche pour améliorer le confort d’utilisation.",
    actions: [{ type: "add", ref: "RALENT" }],
  },
];

export const pfiOutsideOptionChoices: BusinessChoice[] = [
  {
    id: "axe-inox",
    label: "Axe inox",
    description: "Axe de rotation inox pour une installation exposée.",
    actions: [{ type: "add", ref: "AXEINOX1" }],
  },
  {
    id: "verrouillage-1-position",
    label: "Verrouillage 1 position",
    description: "Verrouillage inox de la flèche sur une position de parking.",
    actions: [{ type: "add", ref: "VERROU1" }],
  },
  {
    id: "verrouillage-multi-position",
    label: "Verrouillage multi-position",
    description: "Verrouillage inox multipositions de la flèche en parking.",
    actions: [{ type: "add", ref: "VERROUM" }],
  },
  {
    id: "anneau",
    label: "Anneau",
    description: "Point de protection complémentaire pour une installation extérieure.",
    actions: [{ type: "add", ref: "ANNEAUF" }],
  },
  {
    id: "etancheite",
    label: "Étanchéité",
    description: "Protection adaptée aux projections d’eau et aux environnements exposés.",
    actions: [{ type: "add", ref: "ETANCHAF" }],
  },
  {
    id: "abri-interrupteur",
    label: "Abri interrupteur",
    description: "Protège l’interrupteur lorsqu’il est installé en extérieur.",
    actions: [{ type: "add", ref: "ABRIINTER" }],
  },
  {
    id: "peinture-epoxy",
    label: "Peinture époxy",
    description: "Finition renforcée pour améliorer la tenue en environnement extérieur.",
    actions: [{ type: "add", ref: "EPOXYPF" }],
  },
  {
    id: "capot-protection",
    label: "Capot de protection",
    description: "Ajoutez un capot puis choisissez le type de palan à protéger.",
  },
];

export const pfiElectricalOptionChoices: BusinessChoice[] = [
  {
    id: "interrupteur-cadenassable",
    label: "Interrupteur cadenassable",
    description: "Sécurise l’alimentation électrique avec une coupure verrouillable.",
    actions: [{ type: "add", ref: "INTERSB20A" }],
  },
  {
    id: "ligne-alimentation",
    label: "Ligne d’alimentation",
    description: "Longueur adaptée automatiquement à la portée sélectionnée.",
  },
];
