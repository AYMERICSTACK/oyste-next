import { erpStore, type ERPStore } from "../store";
import type { ErpOuvrage, OuvrageMatch, OuvrageSearchCriteria } from "../types";
import { scoreOuvrage } from "./scoring";

export class OuvrageRepository {
  constructor(private readonly store: ERPStore = erpStore) {}

  all(): ErpOuvrage[] {
    return this.store.getOuvrages();
  }

  findByCode(code: string): ErpOuvrage | undefined {
    return this.store.getOuvrage(code);
  }

  findByFamily(family: string): ErpOuvrage[] {
    return this.store.getOuvragesByFamily(family);
  }

  findBest(criteria: OuvrageSearchCriteria): OuvrageMatch | undefined {
    const candidates = criteria.family ? this.findByFamily(criteria.family) : this.all();

    return candidates
      .map((ouvrage) => scoreOuvrage(ouvrage, criteria))
      .filter((match): match is OuvrageMatch => match !== null)
      .sort((a, b) => b.confidence - a.confidence || a.score - b.score || a.ouvrage.code.localeCompare(b.ouvrage.code))[0];
  }
}
