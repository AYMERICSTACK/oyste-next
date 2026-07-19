import { Cable, Hammer, PackageCheck, PlugZap, RotateCcw, Wrench } from "lucide-react";
import type { Accessory, Answers } from "./types";

export const accessories: Accessory[] = [
  {
    id: "palan-kito-125-250",
    label: "Palan électrique KITO EQ",
    description: "Palan compatible avec les configurations jusqu’à 250 kg.",
    price: 895,
    icon: Wrench,
    recommended: true,
    compatibleCapacity: ["125", "250"],
  },
  {
    id: "palan-kito-500-1000",
    label: "Palan électrique KITO renforcé",
    description: "Palan adapté aux charges de 500 kg à 1 tonne.",
    price: 1290,
    icon: Wrench,
    recommended: true,
    compatibleCapacity: ["500", "1000"],
  },
  {
    id: "ligne-alim-2m",
    label: "Ligne d’alimentation 2 m",
    description: "Alimentation sur rail adaptée à une portée de 2 m.",
    price: 290,
    icon: Cable,
    compatibleReach: ["2m"],
  },
  {
    id: "ligne-alim-25-3m",
    label: "Ligne d’alimentation longue",
    description: "Alimentation sur rail adaptée aux portées de 2,5 m et 3 m.",
    price: 360,
    icon: Cable,
    compatibleReach: ["2-5m", "3m"],
  },
  {
    id: "interrupteur",
    label: "Interrupteur cadenassable",
    description: "Accessoire compatible pour sécuriser l’installation électrique.",
    price: 122.67,
    icon: PlugZap,
    recommended: true,
  },
  {
    id: "butees",
    label: "Butées de rotation",
    description: "Pour limiter la rotation selon l’implantation du poste.",
    price: 192.4,
    icon: RotateCcw,
  },
  {
    id: "kit-fixation-dalle",
    label: "Kit de fixation dalle béton",
    description: "Chevilles et éléments de fixation pour dalle adaptée.",
    price: 89,
    icon: Hammer,
    compatibleFixing: ["dalle"],
    recommended: true,
  },
  {
    id: "semelle-massif",
    label: "Semelle pour massif béton",
    description: "Élément ajouté automatiquement avec une fixation sur massif.",
    price: 95,
    icon: Hammer,
    required: true,
    compatibleFixing: ["massif"],
  },
  {
    id: "protection-exterieure",
    label: "Protection environnement extérieur",
    description: "Finition et composants adaptés à une installation extérieure.",
    price: 180,
    icon: PackageCheck,
    required: true,
    compatibleEnvironment: ["exterieur"],
  },
  {
    id: "dossier-produit",
    label: "Dossier produit",
    description: "Fiche technique et documents associés accessibles avec la commande.",
    price: 0,
    icon: PackageCheck,
    required: true,
  },
];

function getSingleAnswer(value: Answers[string]) {
  return typeof value === "string" ? value : undefined;
}

function matches(values: string[] | undefined, selected: Answers[string]) {
  if (!values?.length) return true;

  const normalizedSelected = getSingleAnswer(selected);
  if (!normalizedSelected) return false;

  return values.includes(normalizedSelected);
}

export function getCompatibleAccessories(answers: Answers) {
  return accessories.filter((accessory) => {
    return (
      matches(accessory.compatibleCapacity, answers.capacity) &&
      matches(accessory.compatibleReach, answers.reach) &&
      matches(accessory.compatibleFixing, answers.fixing) &&
      matches(accessory.compatibleEnvironment, answers.environment)
    );
  });
}
