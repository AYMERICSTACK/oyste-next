import type { ErpComponent, OuvrageSearchCriteria } from "../types";
import { erpStore } from "../store";
import { ComponentRepository } from "./ComponentRepository";
import { OuvrageRepository } from "./OuvrageRepository";
import { ProductRepository } from "./ProductRepository";

const ouvrageRepository = new OuvrageRepository();
const productRepository = new ProductRepository();
const componentRepository = new ComponentRepository();

export { ComponentRepository } from "./ComponentRepository";
export { OuvrageRepository } from "./OuvrageRepository";
export { ProductRepository } from "./ProductRepository";
export { scoreOuvrage } from "./scoring";

export function getErpFamilies() {
  return erpStore.getFamilies();
}

export function getErpOuvrages() {
  return ouvrageRepository.all();
}

export function getErpProducts() {
  return productRepository.all();
}

export function findErpProduct(ref: string) {
  return productRepository.findByRef(ref);
}

export function getOuvrageComponents(ouvrageCode: string): ErpComponent[] {
  return componentRepository.findByOuvrage(ouvrageCode);
}

export function findBestOuvrage(criteria: OuvrageSearchCriteria) {
  return ouvrageRepository.findBest(criteria);
}
