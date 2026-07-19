import type { ErpComponent } from "../types";

export function getIncludedQuantity(quantity: number, order: number) {
  if (quantity > 0) return quantity;
  if (order === 1) return 1;
  return 0;
}

export function getComponentLineTotal(component: ErpComponent) {
  return component.costPrice * getIncludedQuantity(component.quantity, component.order);
}

export function getComponentsTotal(components: ErpComponent[]) {
  return components.reduce((total, component) => total + getComponentLineTotal(component), 0);
}

export function splitIncludedAndOptionalComponents(components: ErpComponent[]) {
  return {
    includedComponents: components.filter((component) => getIncludedQuantity(component.quantity, component.order) > 0),
    optionalComponents: components.filter((component) => getIncludedQuantity(component.quantity, component.order) === 0),
  };
}

export function roundPrice(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
