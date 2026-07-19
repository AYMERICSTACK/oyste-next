import type { BusinessStep } from "../types";
import {
  wallElectricalOptionChoices,
  wallFixingSupportChoices,
  wallMechanicalOptionChoices,
  wallOutsideOptionChoices,
  wallPostFixingChoices,
  wallPostWidthChoices,
} from "../options/wallPotenceOptions";

export function buildWallPotenceSteps(noteRef = "NOTEPM"): BusinessStep[] {
  return [
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
      help: "La portée correspond au rayon de travail utile autour du point de fixation.",
    },
    {
      id: "wallSupport",
      kind: "exclusive-choice",
      title: "Sur quel support la potence sera-t-elle fixée ?",
      required: true,
      help: "Décrivez simplement votre support : le configurateur ajoute ensuite la fixation adaptée.",
      choices: wallFixingSupportChoices,
    },
    {
      id: "postFixing",
      kind: "exclusive-choice",
      title: "Comment souhaitez-vous fixer la potence sur le poteau ?",
      required: true,
      showWhen: [{ answerId: "wallSupport", equals: "metal-post" }],
      help: "Choisissez le principe de fixation le plus adapté à votre poteau métallique.",
      choices: wallPostFixingChoices,
    },
    {
      id: "postWidth",
      kind: "exclusive-choice",
      title: "Quelle est la largeur du poteau ?",
      required: true,
      showWhen: [{ answerId: "wallSupport", equals: "metal-post" }],
      help: "Choisissez la largeur maximale correspondant à votre poteau. Le kit sera sélectionné automatiquement.",
      choices: wallPostWidthChoices,
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
      choices: wallMechanicalOptionChoices,
    },
    {
      id: "electricalOptions",
      kind: "option-group",
      title: "Souhaitez-vous ajouter une option électrique ?",
      choices: wallElectricalOptionChoices,
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
      choices: wallOutsideOptionChoices,
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
          actions: [{ type: "add", ref: noteRef }],
        },
        {
          id: "no",
          label: "Non",
          description: "Vous pouvez commander la solution sans note de calcul.",
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
      showWhen: [{ answerId: "hoistType", equals: "electric" }],
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
  ];
}
