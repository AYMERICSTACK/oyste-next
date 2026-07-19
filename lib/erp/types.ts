export type ErpFamilyCategory = "potence" | "portique" | "palan" | "accessoire" | "produit";

export type ErpFamily = {
  code: string;
  category: ErpFamilyCategory;
  label: string;
  ouvragesCount: number;
  productsCount: number;
  samples: string[];
};

export type ErpComponent = {
  code: string;
  label: string;
  description?: string;
  quantity: number;
  order: number;
  costPrice: number;
};

export type ErpOuvrage = {
  code: string;
  family: string;
  category: ErpFamilyCategory;
  label: string;
  description?: string;
  mainComponentCode: string | null;
  basePrice: number;
  defaultTotal: number;
  installation?: string;
  conception?: string;
  chargeKg?: number;
  reachMm?: number;
  spanMm?: number;
  heightMm?: number;
  widthMm?: number;
  components: ErpComponent[];
};

export type ErpProduct = {
  ref: string;
  label: string;
  description?: string;
  costPrice: number;
  family: string;
  category: ErpFamilyCategory;
  installation?: string;
  conception?: string;
  chargeKg?: number;
  reachMm?: number;
  spanMm?: number;
  heightMm?: number;
  widthMm?: number;
};

export type ErpSnapshot = {
  generatedAt: string;
  source: string;
  sheets: {
    ouvrages: string;
    details: string;
    products: string;
    joined: string;
  };
  stats: {
    ouvrages: number;
    products: number;
    families: number;
    componentsLines: number;
  };
  families: ErpFamily[];
  ouvrages: ErpOuvrage[];
  products: ErpProduct[];
};

export type OuvrageSearchCriteria = {
  family?: string;
  installation?: string;
  conception?: string;
  chargeKg?: number;
  reachMm?: number;
  spanMm?: number;
  heightMm?: number;
  widthMm?: number;
};

export type OuvrageMatch = {
  ouvrage: ErpOuvrage;
  exact: boolean;
  score: number;
  confidence: number;
  reasons: string[];
};

export type OuvrageInstallationStatus = "waiting" | "family-found" | "solution-found" | "not-found";

export type OuvrageInstallation = {
  match?: OuvrageMatch;
  familyCode?: string;
  expectedChargeKg?: number;
  expectedReachMm?: number;
  mainComponent?: ErpComponent;
  includedComponents: ErpComponent[];
  optionalComponents: ErpComponent[];
  missingFields: string[];
  basePrice: number;
  includedTotal: number;
  optionalTotal: number;
  total: number;
  status: OuvrageInstallationStatus;
};
