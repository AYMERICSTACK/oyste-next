import type {Category,Existing,RecordRow} from "./planner";
export type CategoryResolution={categoryName?:string|null;categoryId:string|null;method:string;evidenceProductIds:string[]};
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function resolveExistingCategoryCore(row:RecordRow,rows:RecordRow[],categories:Category[],existing:Existing[]):CategoryResolution{
 const active=categories.filter(c=>c.isActive&&c.catalogueVisible);
 const choose=(matches:Category[],method:string):CategoryResolution|null=>matches.length===1?{categoryId:matches[0].id,method,evidenceProductIds:[]}:matches.length>1?{categoryId:null,method:"AMBIGUOUS",evidenceProductIds:[]}:null;
 // Correspondance explicite STOCKMAN vers une categorie OYSTE existante.
 if (
  norm(row.category) === "transpalettes" &&
  norm(row.subcategory) === "transpalettesmanuels"
 ) {
  const matches = active.filter(
   c => c.slug === "oyste-manutention-au-sol-transpalette-transpalette-manuel"
  );
  if (matches.length === 1) {
   return {
    categoryId: matches[0].id,
    method: "EXACT_STOCKMAN_MANUAL_PALLET_TRUCK_ALIAS",
    evidenceProductIds: []
   };
  }
  return {
   categoryId: null,
   method: "MANUAL_PALLET_TRUCK_CATEGORY_NOT_UNIQUE",
   evidenceProductIds: []
  };
 }
 const precise=choose(active.filter(c=>norm(c.path||"")===norm(`${row.category} ${row.subcategory}`)||norm(c.name)===norm(row.subcategory)||norm(c.slug)===norm(row.subcategory)),"EXACT_SUBCATEGORY");if(precise?.categoryId)return precise;
 // A historical choice is evidence only if at least two independent parents agree.
 for(const level of ["subcategory","category"] as const){
  const source=rows.filter(r=>norm(r.category)===norm(row.category)&&(level==="category"||norm(r.subcategory)===norm(row.subcategory)));
  const anchors=new Map<string,string>();let conflict=false;
  for(const r of source){const matches=existing.filter(e=>e.publicationStatus==="PUBLISHED"&&e.categoryId&&e.references.some(code=>code.trim().toUpperCase()===r.reference.trim().toUpperCase()));const ids=new Set(matches.map(e=>e.categoryId!));if(ids.size>1){conflict=true;break;}if(ids.size===1)for(const e of matches){const previous=anchors.get(e.productId);if(previous&&previous!==e.categoryId)conflict=true;anchors.set(e.productId,e.categoryId!);}}
  if(conflict)return{categoryId:null,method:"HISTORICAL_CONFLICT",evidenceProductIds:[...anchors.keys()].sort()};
  if(anchors.size>=2){const targets=[...new Set(anchors.values())];if(targets.length===1&&active.some(c=>c.id===targets[0]))return{categoryId:targets[0],method:`HISTORICAL_UNANIMOUS_${level.toUpperCase()}`,evidenceProductIds:[...anchors.keys()].sort()};
   if(level==="category"){
    const chain=(id:string)=>{const result:string[]=[];const seen=new Set<string>();let current:string|null=id;while(current){if(seen.has(current))return [];const node=categories.find(c=>c.id===current);if(!node)return [];seen.add(current);result.push(current);current=node.parentId;}return result;};
    const chains=targets.map(chain);const common=chains[0].filter(id=>chains.every(c=>c.includes(id))&&active.some(c=>c.id===id));
    if(common.length)return{categoryId:common[0],method:"HISTORICAL_COMMON_ANCESTOR",evidenceProductIds:[...anchors.keys()].sort()};
   }
  }
 }
 const commercial=choose(active.filter(c=>norm(c.name)===norm(row.category)||norm(c.slug)===norm(row.category)),"EXACT_COMMERCIAL_CATEGORY");
 return commercial||precise||{categoryId:null,method:"NO_EXISTING_CATEGORY",evidenceProductIds:[]};
}

export function resolveExistingCategory(row:RecordRow,rows:RecordRow[],categories:Category[],existing:Existing[]):CategoryResolution{const result=resolveExistingCategoryCore(row,rows,categories,existing);return {...result,categoryName:categories.find(c=>c.id===result.categoryId)?.name||null};}
