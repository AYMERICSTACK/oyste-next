export type ConfigurationStatus =
  | "new"
  | "qualifying"
  | "quote-preparation"
  | "quote-sent"
  | "won"
  | "lost";

export type ConfigurationRecord = {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    name: string;
    company: string;
    email: string;
    phone: string;
    city: string;
  };
  family: "PFI" | "PFT" | "PMI" | "PMT" | "PMA" | "PMAM";
  familyLabel: string;
  status: ConfigurationStatus;
  owner: string;
  totalHt: number;
  capacity: string;
  reach: string;
  height: string;
  environment: string;
  fixing: string;
  hoist: string;
  trolley: string;
  powerSupply: string;
  options: string[];
  note: string;
  notes: Array<{ date: string; author: string; text: string }>;
  timeline: Array<{ date: string; title: string; description: string }>;
};

export const statusLabels: Record<ConfigurationStatus, string> = {
  new: "Nouvelle demande",
  qualifying: "À qualifier",
  "quote-preparation": "Devis à préparer",
  "quote-sent": "Devis envoyé",
  won: "Validée",
  lost: "Perdue",
};

export const configurations: ConfigurationRecord[] = [
  {
    id: "cfg-240719-001",
    reference: "OYS-2026-0719",
    createdAt: "2026-07-17T08:42:00",
    updatedAt: "2026-07-17T09:18:00",
    customer: { name: "Julien Morel", company: "Mécalys Industrie", email: "j.morel@mecalys.fr", phone: "04 74 25 16 80", city: "Oyonnax (01)" },
    family: "PFI",
    familyLabel: "Potence sur fût inversée",
    status: "new",
    owner: "Non assigné",
    totalHt: 12840,
    capacity: "1 000 kg",
    reach: "4 000 mm",
    height: "3 500 mm",
    environment: "Intérieur — atelier sec",
    fixing: "Fixation par chevillage chimique",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot électrique",
    powerSupply: "400 V triphasé",
    options: ["Ligne d’alimentation", "Interrupteur cadenassable", "Butées de rotation"],
    note: "Projet prioritaire. Remplacement d’un ancien poste de levage au troisième trimestre.",
    notes: [
      { date: "17 juil. · 09:24", author: "Aymeric D.", text: "Client disponible pour une validation technique lundi matin." },
      { date: "17 juil. · 09:18", author: "Système", text: "Projet prioritaire. Remplacement d’un ancien poste de levage au troisième trimestre." },
    ],
    timeline: [
      { date: "17 juil. · 09:18", title: "Demande reçue", description: "Configuration finalisée depuis le configurateur OYSTE." },
      { date: "17 juil. · 08:42", title: "Configuration démarrée", description: "Famille PFI sélectionnée." },
    ],
  },
  {
    id: "cfg-240718-004",
    reference: "OYS-2026-0718",
    createdAt: "2026-07-16T15:26:00",
    updatedAt: "2026-07-17T08:05:00",
    customer: { name: "Claire Bernard", company: "Ateliers Bernard", email: "claire.bernard@ateliers-bernard.fr", phone: "03 85 42 10 60", city: "Mâcon (71)" },
    family: "PMI",
    familyLabel: "Potence murale inversée",
    status: "qualifying",
    owner: "Thomas R.",
    totalHt: 7690,
    capacity: "500 kg",
    reach: "3 000 mm",
    height: "Sous-fer 3 200 mm",
    environment: "Intérieur — zone de production",
    fixing: "Console murale sur poteau béton",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot manuel",
    powerSupply: "400 V triphasé",
    options: ["Ligne d’alimentation", "Finition RAL spécifique"],
    note: "Vérifier la qualité du support mural avant chiffrage définitif.",
    notes: [{ date: "17 juil. · 08:10", author: "Thomas R.", text: "Vérifier la qualité du support mural avant chiffrage définitif." }],
    timeline: [
      { date: "17 juil. · 08:05", title: "Assignée à Thomas R.", description: "Qualification technique en cours." },
      { date: "16 juil. · 15:26", title: "Demande reçue", description: "Configuration PMI enregistrée." },
    ],
  },
  {
    id: "cfg-240717-011",
    reference: "OYS-2026-0717",
    createdAt: "2026-07-15T11:04:00",
    updatedAt: "2026-07-16T16:38:00",
    customer: { name: "Marc Villard", company: "Villard Métal", email: "m.villard@villard-metal.com", phone: "04 72 88 31 20", city: "Corbas (69)" },
    family: "PFT",
    familyLabel: "Potence sur fût triangulée",
    status: "quote-preparation",
    owner: "Élodie M.",
    totalHt: 18450,
    capacity: "2 000 kg",
    reach: "5 000 mm",
    height: "4 000 mm",
    environment: "Extérieur sous auvent",
    fixing: "Massif béton avec tiges d’ancrage",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot électrique",
    powerSupply: "400 V triphasé",
    options: ["Galvanisation", "Capotage palan", "Commande radio"],
    note: "Prévoir une validation du traitement extérieur avec le bureau d’études.",
    notes: [{ date: "16 juil. · 16:42", author: "Élodie M.", text: "Prévoir une validation du traitement extérieur avec le bureau d’études." }],
    timeline: [
      { date: "16 juil. · 16:38", title: "Passage en devis", description: "Les éléments techniques sont suffisants pour lancer le chiffrage." },
      { date: "15 juil. · 11:04", title: "Demande reçue", description: "Configuration PFT enregistrée." },
    ],
  },
  {
    id: "cfg-240715-006",
    reference: "OYS-2026-0715",
    createdAt: "2026-07-14T09:12:00",
    updatedAt: "2026-07-16T14:20:00",
    customer: { name: "Sophie Laurent", company: "Lactalis Maintenance", email: "s.laurent@example.fr", phone: "02 43 52 12 90", city: "Laval (53)" },
    family: "PFI",
    familyLabel: "Potence sur fût inversée",
    status: "quote-sent",
    owner: "Thomas R.",
    totalHt: 15320,
    capacity: "1 000 kg",
    reach: "5 000 mm",
    height: "3 800 mm",
    environment: "Intérieur — environnement alimentaire",
    fixing: "Massif béton avec tiges d’ancrage",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot manuel",
    powerSupply: "400 V triphasé",
    options: ["Peinture adaptée", "Ligne d’alimentation", "Interrupteur cadenassable"],
    note: "Devis transmis. Relance prévue vendredi prochain.",
    notes: [{ date: "16 juil. · 14:25", author: "Thomas R.", text: "Devis transmis. Relance prévue vendredi prochain." }],
    timeline: [
      { date: "16 juil. · 14:20", title: "Devis envoyé", description: "Offre DEV-2026-184 transmise par e-mail." },
      { date: "15 juil. · 10:30", title: "Validation technique", description: "Configuration validée par le bureau d’études." },
      { date: "14 juil. · 09:12", title: "Demande reçue", description: "Configuration PFI enregistrée." },
    ],
  },
  {
    id: "cfg-240713-003",
    reference: "OYS-2026-0713",
    createdAt: "2026-07-12T13:44:00",
    updatedAt: "2026-07-15T17:02:00",
    customer: { name: "Antoine Girard", company: "Ain Plastiques", email: "a.girard@ain-plastiques.fr", phone: "04 74 22 09 41", city: "Bourg-en-Bresse (01)" },
    family: "PMT",
    familyLabel: "Potence murale triangulée",
    status: "won",
    owner: "Élodie M.",
    totalHt: 9940,
    capacity: "500 kg",
    reach: "4 000 mm",
    height: "Sous-fer 3 400 mm",
    environment: "Intérieur — atelier sec",
    fixing: "Console murale sur charpente métallique",
    hoist: "Palan manuel à chaîne",
    trolley: "Chariot manuel",
    powerSupply: "Sans alimentation électrique",
    options: ["Finition RAL spécifique"],
    note: "Commande confirmée. Transmission vers l’ERP à préparer.",
    notes: [{ date: "15 juil. · 17:08", author: "Élodie M.", text: "Commande confirmée. Transmission vers l’ERP à préparer." }],
    timeline: [
      { date: "15 juil. · 17:02", title: "Affaire gagnée", description: "Accord client reçu par e-mail." },
      { date: "14 juil. · 09:50", title: "Devis envoyé", description: "Offre DEV-2026-179 transmise." },
      { date: "12 juil. · 13:44", title: "Demande reçue", description: "Configuration PMT enregistrée." },
    ],
  },
  {
    id: "cfg-240710-009",
    reference: "OYS-2026-0710",
    createdAt: "2026-07-10T10:17:00",
    updatedAt: "2026-07-14T11:30:00",
    customer: { name: "Nicolas Perret", company: "Perret Usinage", email: "n.perret@perret-usinage.fr", phone: "04 50 61 08 30", city: "Annecy (74)" },
    family: "PMA",
    familyLabel: "Potence murale articulée",
    status: "lost",
    owner: "Thomas R.",
    totalHt: 6280,
    capacity: "250 kg",
    reach: "2 500 mm",
    height: "Sous-fer 3 000 mm",
    environment: "Intérieur — atelier sec",
    fixing: "Console murale",
    hoist: "Palan manuel à chaîne",
    trolley: "Sans chariot",
    powerSupply: "Sans alimentation électrique",
    options: [],
    note: "Projet reporté par le client à 2027.",
    notes: [{ date: "14 juil. · 11:35", author: "Thomas R.", text: "Projet reporté par le client à 2027." }],
    timeline: [
      { date: "14 juil. · 11:30", title: "Dossier clôturé", description: "Projet reporté à l’année prochaine." },
      { date: "10 juil. · 10:17", title: "Demande reçue", description: "Configuration PMA enregistrée." },
    ],
  },
];

export function getConfigurationById(id: string) {
  return configurations.find((configuration) => configuration.id === id);
}

export function formatAdminPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
