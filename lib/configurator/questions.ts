import {
  Building2,
  Factory,
  GitBranch,
  Ruler,
  ShoppingCart,
  TowerControl,
  Weight,
} from "lucide-react";
import type { ConfiguratorQuestion } from "./types";

export const configuratorQuestions: ConfiguratorQuestion[] = [
  {
    id: "need",
    eyebrow: "Point de départ",
    title: "Que souhaitez-vous faire ?",
    description:
      "Décrivez votre besoin : le configurateur construit progressivement une solution prête à commander.",
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
    id: "installation",
    eyebrow: "Implantation",
    title: "Quel type d’installation souhaitez-vous ?",
    description:
      "Choisissez le type d’installation le plus proche de votre environnement de travail.",
    icon: TowerControl,
    choices: [
      {
        id: "fut",
        label: "Potence sur fût",
        description: "Solution autonome fixée au sol, adaptée aux postes indépendants.",
      },
      {
        id: "murale",
        label: "Potence murale",
        description: "Solution fixée sur une structure existante lorsque le bâtiment le permet.",
      },
    ],
  },
  {
    id: "conception",
    eyebrow: "Conception",
    title: "Quelle conception de potence ?",
    description:
      "Choisissez la conception la plus adaptée à votre usage et à votre environnement.",
    icon: GitBranch,
    choices: [
      {
        id: "inversee",
        label: "Inversée",
        description: "Conception compacte avec tirant supérieur selon la gamme choisie.",
      },
      {
        id: "triangulee",
        label: "Triangulée",
        description: "Structure triangulée robuste pour les configurations adaptées.",
      },
    ],
  },
  {
    id: "capacity",
    eyebrow: "Charge",
    title: "Quelle charge souhaitez-vous lever ?",
    description:
      "La charge permet de dimensionner correctement la solution de levage.",
    icon: Weight,
    choices: [
      {
        id: "125",
        label: "Jusqu’à 125 kg",
        description: "Solution légère pour postes de production et maintenance.",
      },
      {
        id: "250",
        label: "Jusqu’à 250 kg",
        description: "Usage atelier fréquent avec marge de sécurité confortable.",
      },
      {
        id: "500",
        label: "Jusqu’à 500 kg",
        description: "Charges plus lourdes, structure et palan adaptés.",
      },
      {
        id: "1000",
        label: "Jusqu’à 1 tonne",
        description: "Configuration renforcée avec accessoires compatibles.",
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
      },
      {
        id: "2-5m",
        label: "2,5 m",
        description: "Bon compromis entre compacité et zone de travail.",
      },
      {
        id: "3m",
        label: "3 m",
        description: "Zone de travail plus large pour atelier et production.",
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
      },
    ],
  },
  {
    id: "fixing",
    eyebrow: "Fixation",
    title: "Quel type de fixation faut-il prévoir ?",
    description:
      "Le type de fixation permet d’ajouter le kit adapté à votre installation.",
    icon: Building2,
    choices: [
      {
        id: "dalle",
        label: "Dalle béton",
        description: "Semelle à cheviller pour installation sur dalle adaptée.",
      },
      {
        id: "massif",
        label: "Massif béton",
        description: "Semelle pour massif béton avec préparation spécifique.",
      },
      {
        id: "murale",
        label: "Fixation murale",
        description: "Orientation vers une potence murale si la structure le permet.",
      },
    ],
  },
];
