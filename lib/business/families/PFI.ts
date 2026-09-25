import type { BusinessFamilyDefinition } from "../types";
import {
  pfiElectricalOptionChoices,
  pfiFixingChoices,
  pfiMechanicalOptionChoices,
  pfiOutsideOptionChoices,
} from "../options/pfiOptions";

export const PFI_DEFINITION: BusinessFamilyDefinition = {
  id: "PFI",
  label: "Potence sur fût inversée",
  shortLabel: "Potence sur fût",
  description:
    "Parcours de configuration pour guider le client depuis la charge et la portée jusqu’à la solution prête à commander.",
  searchStepIds: ["capacity", "reach"],
  defaultExclusions: [
    {
      type: "exclude",
      ref: "BUTSOUD",
      reason: "Les butées de rotation à souder ne sont plus proposées.",
    },
    {
      type: "exclude",
      ref: "ER2_EQ_HARTING",
      reason: "Composant réservé aux devis physiques internes.",
    },
  ],
  steps: [
    {
      id: "capacity",
      kind: "search",
      title: "Quelle charge souhaitez-vous lever ?",
      required: true,
      help: "Indiquez la charge maximale que votre installation devra lever.",
    },
    {
      id: "reach",
      kind: "search",
      title: "Quelle portée souhaitez-vous couvrir ?",
      required: true,
      help: "La portée correspond au rayon de travail entre la colonne et la charge à lever.",
    },
    {
      id: "fixing",
      kind: "exclusive-choice",
      title: "Comment souhaitez-vous fixer la potence ?",
      required: true,
      choices: pfiFixingChoices,
    },
    {
      id: "underBeamHeight",
      kind: "exclusive-choice",
      title: "Quelle hauteur sous fer souhaitez-vous ?",
      required: true,
      help: "La hauteur sous fer correspond à la distance entre le sol et la poutre de roulement.",
    },
    {
      id: "mechanicalOptions",
      kind: "option-group",
      title: "Souhaitez-vous ajouter des options de confort ou de sécurité ?",
      choices: pfiMechanicalOptionChoices,
    },
    {
      id: "electricalOptions",
      kind: "option-group",
      title: "Souhaitez-vous ajouter une option électrique ?",
      choices: pfiElectricalOptionChoices,
    },
    {
      id: "environment",
      kind: "exclusive-choice",
      title: "Votre solution sera-t-elle installée en extérieur ?",
      required: true,
      choices: [
        {
          id: "interieur",
          label: "Non, en intérieur",
          description:
            "Pour un atelier, une zone de production ou un local couvert.",
        },
        {
          id: "exterieur",
          label: "Oui, en extérieur",
          description:
            "Des protections complémentaires seront proposées pour résister aux intempéries.",
          nextStepId: "outsideOptions",
        },
      ],
    },
    {
      id: "outsideOptions",
      kind: "option-group",
      title: "Quelles protections extérieures souhaitez-vous ajouter ?",
      help: "Choisissez les protections adaptées à l’environnement de votre installation.",
      showWhen: [{ answerId: "environment", equals: "exterieur" }],
      choices: pfiOutsideOptionChoices,
    },
    {
      id: "protectionHoistType",
      kind: "exclusive-choice",
      title: "Quel type de palan souhaitez-vous protéger ?",
      required: true,
      help: "Le capot est adapté au type de palan installé sur la potence.",
      showWhen: [{ answerId: "outsideOptions", includes: "capot-protection" }],
      choices: [
        {
          id: "manual",
          label: "Palan manuel",
          description: "Capot 2 faces + toiture pour palan manuel.",
          actions: [{ type: "add", ref: "CAPOTPM" }],
        },
        {
          id: "electric",
          label: "Palan électrique",
          description: "Capot 2 faces + toiture pour palan électrique à chaîne.",
          actions: [{ type: "add", ref: "CAPOTPE" }],
        },
      ],
    },
    {
      id: "calculationNote",
      kind: "boolean-option",
      title: "Souhaitez-vous ajouter une note de calcul ?",
      choices: [
        {
          id: "yes",
          label: "Oui",
          description: "La note de calcul est ajouté à votre configuration.",
          actions: [{ type: "add", ref: "NOTEPF" }],
        },
        {
          id: "no",
          label: "Non",
          description:
            "Vous pourrez commander la solution sans note de calcul.",
        },
      ],
    },
    {
      id: "hoist",
      kind: "sub-configurator",
      title: "Souhaitez-vous ajouter un palan à votre solution ?",
      help: "Le palan permet de lever la charge sur la potence. Sa capacité sera adaptée automatiquement à votre choix de charge.",
      choices: [
        {
          id: "no",
          label: "Non",
          description: "Vous commandez uniquement la potence configurée.",
        },
        {
          id: "yes",
          label: "Oui",
          description:
            "Ajoutez un palan compatible pour obtenir une solution de levage complète.",
          nextStepId: "hoistType",
        },
      ],
    },
    {
      id: "hoistType",
      kind: "exclusive-choice",
      title: "Quel type de palan souhaitez-vous ?",
      showWhen: [{ answerId: "hoist", equals: "yes" }],
      help: "La capacité du palan suit automatiquement la charge sélectionnée au début du parcours.",
      choices: [
        {
          id: "manual",
          label: "Palan manuel",
          description:
            "Levage à chaîne, adapté aux utilisations ponctuelles ou simples.",
        },
        {
          id: "electric",
          label: "Palan électrique",
          description:
            "Levage motorisé pour gagner en confort et en rapidité d’utilisation.",
        },
      ],
    },
    {
      id: "hoistTrolleyMovement",
      kind: "exclusive-choice",
      title: "Comment souhaitez-vous déplacer le palan ?",
      showWhen: [{ answerId: "hoist", equals: "yes" }],
      help: "Le déplacement correspond au mouvement du palan le long de la poutre.",
      choices: [
        {
          id: "push",
          label: "Par poussée",
          description:
            "Vous déplacez le palan manuellement le long de la poutre.",
        },
        {
          id: "motorized",
          label: "Motorisé",
          description:
            "Le déplacement du palan est assuré électriquement pour plus de confort.",
        },
      ],
    },
    {
      id: "liftingHeight",
      kind: "exclusive-choice",
      title: "Quelle hauteur de levage faut-il prévoir ?",
      showWhen: [{ answerId: "hoist", equals: "yes" }],
      help: "La hauteur de levage correspond à la course verticale nécessaire pour monter et descendre votre charge.",
    },
    {
      id: "hoistCommand",
      kind: "exclusive-choice",
      title: "Comment souhaitez-vous commander le palan ?",
      showWhen: [{ answerId: "hoistType", equals: "electric" }],
      help: "Choisissez le mode de commande le plus pratique pour votre poste de travail.",
      choices: [
        {
          id: "radio",
          label: "Radiocommande",
          description:
            "Commande à distance, pratique lorsque l’opérateur doit se déplacer autour de la charge.",
        },
        {
          id: "button-box",
          label: "Boîte à boutons",
          description:
            "Commande filaire suspendue au palan, simple et directe.",
        },
      ],
    },
    {
      id: "buttonBoxLength",
      kind: "exclusive-choice",
      title: "Quelle longueur de câble souhaitez-vous pour la boîte à boutons ?",
      required: true,
      showWhen: [{ answerId: "hoistCommand", equals: "button-box" }],
      help: "Choisissez une longueur de câble de commande entre 1 et 15 m.",
    },
    {
      id: "hoistOptions",
      kind: "option-group",
      title: "Souhaitez-vous ajouter une option au palan ?",
      showWhen: [{ answerId: "hoistType", equals: "electric" }],
      help: "Les options sélectionnées sont ajoutées automatiquement à la solution.",
    },
  ],
  notes: [
    "La capacité et la portée identifient le modèle de base.",
    "Les options mécaniques et extérieures ajoutent des composants : elles ne remplacent pas l'installation de base.",
    "Les butées à souder BUTSOUD ne doivent plus être proposées.",
    "Le palan doit être traité comme une solution complémentaire, probablement issue d'un autre ouvrage.",
  ],
  questionsToClarify: [
    "Affiner les hauteurs sous fer disponibles par capacité et portée.",
    "Mapping précis hauteur de levage → bac à chaîne.",
    "Mapping boîte à boutons → câble = hauteur de levage - 0,5 m.",
    "Références exactes de radiocommande selon palan choisi.",
  ],
};
