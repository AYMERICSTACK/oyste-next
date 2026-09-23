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
    description:
      "Permettent de limiter la rotation de la potence selon votre zone de travail.",
    actions: [{ type: "add", ref: "BUTREGPF2" }],
  },
  {
    id: "axe-inox",
    label: "Axe inox",
    description:
      "Renforce la résistance dans les environnements exposés.",
    actions: [{ type: "add", ref: "AXEINOX1" }],
  },
  {
    id: "verrouillage",
    label: "Verrouillage",
    description: "Permet de maintenir la potence dans une position définie.",
    actions: [{ type: "add", ref: "VERROU1" }],
  },
  {
    id: "verrouillage-mural",
    label: "Verrouillage renforcé",
    description:
      "Maintien renforcé pour les usages nécessitant plus de stabilité.",
    actions: [{ type: "add", ref: "VERROUM" }],
  },
  {
    id: "ralentisseur",
    label: "Ralentisseur",
    description:
      "Améliore le confort d’utilisation en limitant les mouvements brusques.",
    actions: [{ type: "add", ref: "RALENT" }],
  },
];

export const pfiOutsideOptionChoices: BusinessChoice[] = [
  {
    id: "anneau",
    label: "Anneau",
    description:
      "Point de protection complémentaire pour une installation extérieure.",
    actions: [{ type: "add", ref: "ANNEAUF" }],
  },
  {
    id: "etancheite",
    label: "Étanchéité",
    description:
      "Protection adaptée aux projections d’eau et aux environnements exposés.",
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
    description:
      "Finition renforcée pour améliorer la tenue en environnement extérieur.",
    actions: [{ type: "add", ref: "EPOXYPF" }],
  },
  {
    id: "capot-exterieur",
    label: "Capot de protection",
    description: "Protège les éléments exposés aux intempéries.",
    actions: [{ type: "add", ref: "CAPOTPE" }],
  },
  {
    id: "capot-1",
    label: "Protection complémentaire",
    description:
      "Protection additionnelle selon votre environnement d’installation.",
    actions: [{ type: "add", ref: "CAPOT1F" }],
  },
  {
    id: "capot-pm",
    label: "Protection spécifique",
    description: "Protection adaptée à certaines configurations particulières.",
    actions: [{ type: "add", ref: "CAPOTPM" }],
  },
];

export const pfiElectricalOptionChoices: BusinessChoice[] = [
  {
    id: "interrupteur-cadenassable",
    label: "Interrupteur cadenassable",
    description:
      "Sécurise l’alimentation électrique avec une coupure verrouillable.",
    actions: [{ type: "add", ref: "INTERSB20A" }],
  },
];
