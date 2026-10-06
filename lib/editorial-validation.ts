import { publicUrlSchema } from "./cms-validation";
import { z } from "zod";
import { editorialDefaults, editorialDescriptors } from "./editorial-defaults";
export type EditorialPageId = keyof typeof editorialDefaults;
export type EditorialValue = { fields: Record<string, string>; collections: Record<string, Array<Record<string, string | number | boolean>>> };
export function isEditorialPageId(id: string): id is EditorialPageId { return Object.hasOwn(editorialDefaults,id); }
export function safeEditorialLink(value: string) {
 if(!value)return true;
 if(/[\\\u0000-\u001f\u007f]/.test(value))return false;
 return publicUrlSchema.safeParse(value).success || /^#[\w-]+$/.test(value) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^tel:\+?[\d ()-]+$/.test(value);
}
export function validateEditorial(id: EditorialPageId,value: unknown): EditorialValue | null {
 const parsed=z.object({fields:z.record(z.string(),z.string().max(100000)),collections:z.record(z.string(),z.array(z.record(z.string(),z.union([z.string().max(100000),z.number().int().min(0).max(10000),z.boolean()]))).max(100))}).strict().safeParse(value);
 if(!parsed.success)return null;
 const defaults=editorialDefaults[id] as EditorialValue;
 for(const field of editorialDescriptors[id].fields){if((field.kind==="link" || field.kind==="image") && parsed.data.fields[field.key]!==undefined && !safeEditorialLink(parsed.data.fields[field.key]))return null;}
 if(Object.keys(parsed.data.fields).some(key=>!(key in defaults.fields)) || Object.keys(parsed.data.collections).some(key=>!(key in defaults.collections)))return null;
 if(parsed.data.collections.pageSections){const allowed=defaults.collections.pageSections || [];const ids=parsed.data.collections.pageSections.map(item=>item.id);if(ids.length!==allowed.length || new Set(ids).size!==ids.length || ids.some(id=>!allowed.some(item=>item.id===id)))return null;}
 for(const [key,rows] of Object.entries(parsed.data.collections)) { const initial=defaults.collections[key][0];for(const row of rows){ if(!initial || Object.keys(row).some(k=>!(k in initial)) || Object.entries(initial).some(([k,v])=>typeof row[k]!==typeof v))return null; if(Object.entries(row).some(([k,v])=>['href','src','url','parent'].includes(k)&&!safeEditorialLink(String(v))))return null; } }
 return parsed.data;
}
export function mergeEditorial<K extends EditorialPageId>(id:K,value:unknown): (typeof editorialDefaults)[K] {
 const defaults=editorialDefaults[id];const parsed=validateEditorial(id,value);
 return {fields:{...defaults.fields,...parsed?.fields},collections:{...defaults.collections,...parsed?.collections}} as (typeof editorialDefaults)[K];
}
