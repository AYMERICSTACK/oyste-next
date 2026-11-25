import { BC_REFERENCES } from "../bc-family-plan";
import type { RecordRow } from "./planner";
export const SCOPE_VERSION="STOCKMAN_COMMERCIAL_SELECTION_20261109";
export const SELECTED_CATEGORIES=["Diables et chariots motorisés ergonomiques","Diables et chariots de manutention","Coins roulants et rouleurs","Transpalettes","Transpalettes électriques","Gerbeurs et élévateurs lève-charge","Accessoires pour chariot élévateur","Crics et équipement poids lourd","Équipement d'atelier","Tables élévatrices"];
export const EXCLUDED_SUBCATEGORIES=["Grues repliables et transformables MILOAD","Accessoires de grues d'atelier"];
/** Exact normalized labels, never substrings or fuzzy matches. */
export const normalizeScopeLabel=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function inCommercialScope(row:RecordRow){return !BC_REFERENCES.includes(row.reference.trim().toUpperCase())&&SELECTED_CATEGORIES.some(c=>normalizeScopeLabel(c)===normalizeScopeLabel(row.category))&&!(normalizeScopeLabel(row.category)===normalizeScopeLabel("Équipement d'atelier")&&EXCLUDED_SUBCATEGORIES.some(c=>normalizeScopeLabel(c)===normalizeScopeLabel(row.subcategory)));}
export function scopeReport(rows:RecordRow[]){const retained=rows.filter(inCommercialScope);return {version:SCOPE_VERSION,total:rows.length,retained:retained.length,excluded:rows.length-retained.length,categories:SELECTED_CATEGORIES.map(category=>({category,count:retained.filter(r=>normalizeScopeLabel(r.category)===normalizeScopeLabel(category)).length})),references:retained.map(r=>r.reference),excludedReferences:rows.filter(r=>!inCommercialScope(r)).map(r=>r.reference)};}
