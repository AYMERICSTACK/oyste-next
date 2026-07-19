export type OrderStatus =
  | "pending-payment"
  | "paid"
  | "engineering"
  | "production"
  | "quality-control"
  | "ready-to-ship"
  | "shipped"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "refunded";

export type OrderRecord = {
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
  delivery: {
    mode: string;
    address: string;
    requestedDate: string;
  };
  family: "PFI" | "PFT" | "PMI" | "PMT" | "PMA" | "PMAM";
  familyLabel: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalHt: number;
  totalTtc: number;
  capacity: string;
  reach: string;
  height: string;
  environment: string;
  fixing: string;
  hoist: string;
  trolley: string;
  powerSupply: string;
  options: string[];
  productionOwner: string;
  commercialOwner: string;
  progress: number;
  note: string;
  notes: Array<{ date: string; author: string; text: string }>;
  timeline: Array<{ date: string; title: string; description: string }>;
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  "pending-payment": "En attente de paiement",
  paid: "Payée",
  engineering: "En étude",
  production: "En fabrication",
  "quality-control": "Contrôle qualité",
  "ready-to-ship": "Prête à expédier",
  shipped: "Expédiée",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Paiement en attente",
  paid: "Payée",
  refunded: "Remboursée",
};

export const orders: OrderRecord[] = [
  {
    id: "ord-2026-0719",
    reference: "CMD-2026-0719",
    createdAt: "2026-07-17T08:42:00",
    updatedAt: "2026-07-17T10:18:00",
    customer: { name: "Julien Morel", company: "Mécalys Industrie", email: "j.morel@mecalys.fr", phone: "04 74 25 16 80", city: "Oyonnax (01)" },
    delivery: { mode: "Transport ADEI", address: "12 rue de l’Industrie, 01100 Oyonnax", requestedDate: "Semaine 38" },
    family: "PFI",
    familyLabel: "Potence sur fût inversée",
    status: "paid",
    paymentStatus: "paid",
    totalHt: 12840,
    totalTtc: 15408,
    capacity: "1 000 kg",
    reach: "4 000 mm",
    height: "3 500 mm",
    environment: "Intérieur — atelier sec",
    fixing: "Fixation par chevillage chimique",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot électrique",
    powerSupply: "400 V triphasé",
    options: ["Ligne d’alimentation", "Interrupteur cadenassable", "Butées de rotation"],
    productionOwner: "À planifier",
    commercialOwner: "Aymeric D.",
    progress: 18,
    note: "Commande payée, dossier prêt pour validation technique.",
    notes: [{ date: "17 juil. · 10:18", author: "Aymeric D.", text: "Commande payée, dossier prêt pour validation technique." }],
    timeline: [
      { date: "17 juil. · 10:18", title: "Paiement confirmé", description: "Paiement CB de 15 408 € TTC validé." },
      { date: "17 juil. · 08:42", title: "Commande créée", description: "Configuration PFI transformée en commande." },
    ],
  },
  {
    id: "ord-2026-0718",
    reference: "CMD-2026-0718",
    createdAt: "2026-07-16T15:26:00",
    updatedAt: "2026-07-17T09:05:00",
    customer: { name: "Claire Bernard", company: "Ateliers Bernard", email: "claire.bernard@ateliers-bernard.fr", phone: "03 85 42 10 60", city: "Mâcon (71)" },
    delivery: { mode: "Retrait agence", address: "ADEI — Bourg-en-Bresse", requestedDate: "Semaine 37" },
    family: "PMI",
    familyLabel: "Potence murale inversée",
    status: "engineering",
    paymentStatus: "paid",
    totalHt: 7690,
    totalTtc: 9228,
    capacity: "500 kg",
    reach: "3 000 mm",
    height: "Sous-fer 3 200 mm",
    environment: "Intérieur — zone de production",
    fixing: "Console murale sur poteau béton",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot manuel",
    powerSupply: "400 V triphasé",
    options: ["Ligne d’alimentation", "Finition RAL spécifique"],
    productionOwner: "Bureau d’études",
    commercialOwner: "Thomas R.",
    progress: 34,
    note: "Vérification du support mural en cours.",
    notes: [{ date: "17 juil. · 09:05", author: "Thomas R.", text: "Vérification du support mural en cours." }],
    timeline: [
      { date: "17 juil. · 09:05", title: "Passage en étude", description: "Le bureau d’études contrôle le support mural." },
      { date: "16 juil. · 15:26", title: "Commande créée", description: "Commande PMI reçue et payée." },
    ],
  },
  {
    id: "ord-2026-0717",
    reference: "CMD-2026-0717",
    createdAt: "2026-07-15T11:04:00",
    updatedAt: "2026-07-17T08:38:00",
    customer: { name: "Marc Villard", company: "Villard Métal", email: "m.villard@villard-metal.com", phone: "04 72 88 31 20", city: "Corbas (69)" },
    delivery: { mode: "Affrètement", address: "8 avenue des Ateliers, 69960 Corbas", requestedDate: "Semaine 39" },
    family: "PFT",
    familyLabel: "Potence sur fût triangulée",
    status: "production",
    paymentStatus: "paid",
    totalHt: 18450,
    totalTtc: 22140,
    capacity: "2 000 kg",
    reach: "5 000 mm",
    height: "4 000 mm",
    environment: "Extérieur sous auvent",
    fixing: "Massif béton avec tiges d’ancrage",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot électrique",
    powerSupply: "400 V triphasé",
    options: ["Galvanisation", "Capotage palan", "Commande radio"],
    productionOwner: "Atelier 2",
    commercialOwner: "Élodie M.",
    progress: 58,
    note: "Structure débitée, assemblage prévu cet après-midi.",
    notes: [{ date: "17 juil. · 08:38", author: "Atelier 2", text: "Structure débitée, assemblage prévu cet après-midi." }],
    timeline: [
      { date: "17 juil. · 08:38", title: "Fabrication démarrée", description: "Débit et préparation des éléments terminés." },
      { date: "16 juil. · 16:38", title: "Étude validée", description: "Dossier libéré pour l’atelier." },
    ],
  },
  {
    id: "ord-2026-0715",
    reference: "CMD-2026-0715",
    createdAt: "2026-07-14T09:12:00",
    updatedAt: "2026-07-17T07:52:00",
    customer: { name: "Sophie Laurent", company: "Lactalis Maintenance", email: "s.laurent@example.fr", phone: "02 43 52 12 90", city: "Laval (53)" },
    delivery: { mode: "Transport dédié", address: "Zone industrielle Nord, 53000 Laval", requestedDate: "22 juillet 2026" },
    family: "PFI",
    familyLabel: "Potence sur fût inversée",
    status: "quality-control",
    paymentStatus: "paid",
    totalHt: 15320,
    totalTtc: 18384,
    capacity: "1 000 kg",
    reach: "5 000 mm",
    height: "3 800 mm",
    environment: "Intérieur — environnement alimentaire",
    fixing: "Massif béton avec tiges d’ancrage",
    hoist: "Palan électrique à chaîne",
    trolley: "Chariot manuel",
    powerSupply: "400 V triphasé",
    options: ["Peinture adaptée", "Ligne d’alimentation", "Interrupteur cadenassable"],
    productionOwner: "Contrôle qualité",
    commercialOwner: "Thomas R.",
    progress: 84,
    note: "Contrôle électrique et vérification peinture en cours.",
    notes: [{ date: "17 juil. · 07:52", author: "Qualité", text: "Contrôle électrique et vérification peinture en cours." }],
    timeline: [
      { date: "17 juil. · 07:52", title: "Contrôle qualité", description: "Contrôles finaux lancés avant emballage." },
      { date: "16 juil. · 14:20", title: "Fabrication terminée", description: "Assemblage et câblage achevés." },
    ],
  },
  {
    id: "ord-2026-0713",
    reference: "CMD-2026-0713",
    createdAt: "2026-07-12T13:44:00",
    updatedAt: "2026-07-17T06:58:00",
    customer: { name: "Antoine Girard", company: "Ain Plastiques", email: "a.girard@ain-plastiques.fr", phone: "04 74 22 09 41", city: "Bourg-en-Bresse (01)" },
    delivery: { mode: "Transport ADEI", address: "4 rue des Plastiques, 01000 Bourg-en-Bresse", requestedDate: "18 juillet 2026" },
    family: "PMT",
    familyLabel: "Potence murale triangulée",
    status: "ready-to-ship",
    paymentStatus: "paid",
    totalHt: 9940,
    totalTtc: 11928,
    capacity: "500 kg",
    reach: "4 000 mm",
    height: "Sous-fer 3 400 mm",
    environment: "Intérieur — atelier sec",
    fixing: "Console murale sur charpente métallique",
    hoist: "Palan manuel à chaîne",
    trolley: "Chariot manuel",
    powerSupply: "Sans alimentation électrique",
    options: ["Finition RAL spécifique"],
    productionOwner: "Logistique",
    commercialOwner: "Élodie M.",
    progress: 94,
    note: "Commande emballée, enlèvement transporteur prévu à 14 h.",
    notes: [{ date: "17 juil. · 06:58", author: "Logistique", text: "Commande emballée, enlèvement transporteur prévu à 14 h." }],
    timeline: [
      { date: "17 juil. · 06:58", title: "Prête à expédier", description: "Emballage terminé et documents de transport édités." },
      { date: "16 juil. · 11:20", title: "Contrôle validé", description: "Aucune non-conformité détectée." },
    ],
  },
  {
    id: "ord-2026-0710",
    reference: "CMD-2026-0710",
    createdAt: "2026-07-10T10:17:00",
    updatedAt: "2026-07-16T17:30:00",
    customer: { name: "Nicolas Perret", company: "Perret Usinage", email: "n.perret@perret-usinage.fr", phone: "04 50 61 08 30", city: "Annecy (74)" },
    delivery: { mode: "Messagerie industrielle", address: "28 route des Alpes, 74000 Annecy", requestedDate: "Livrée" },
    family: "PMA",
    familyLabel: "Potence murale articulée",
    status: "shipped",
    paymentStatus: "paid",
    totalHt: 6280,
    totalTtc: 7536,
    capacity: "250 kg",
    reach: "2 500 mm",
    height: "Sous-fer 3 000 mm",
    environment: "Intérieur — atelier sec",
    fixing: "Console murale",
    hoist: "Palan manuel à chaîne",
    trolley: "Sans chariot",
    powerSupply: "Sans alimentation électrique",
    options: [],
    productionOwner: "Expédiée",
    commercialOwner: "Thomas R.",
    progress: 100,
    note: "Expédition effectuée, suivi transport envoyé au client.",
    notes: [{ date: "16 juil. · 17:30", author: "Logistique", text: "Expédition effectuée, suivi transport envoyé au client." }],
    timeline: [
      { date: "16 juil. · 17:30", title: "Commande expédiée", description: "Numéro de suivi transmis au client." },
      { date: "16 juil. · 09:00", title: "Prête à expédier", description: "Commande emballée et contrôlée." },
    ],
  },
];

export function getOrderById(id: string) {
  return orders.find((order) => order.id === id);
}

export function formatAdminPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
