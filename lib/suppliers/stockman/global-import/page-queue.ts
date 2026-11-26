import { canonicalizeStockmanUrl } from "../url";
import type {Evidence} from "./planner";
export type PageCheck={canonicalPage?:string;checkedAt:string;status:"verified"|"unavailable"|"review";observedReferences:string[];proof?:Evidence;reason?:string;attempts?:number};
export type PageChecks=Record<string,PageCheck>;
export function pageUrl(value:string){try{const u=new URL(value);if(!["stockman.fr","www.stockman.fr"].includes(u.hostname)||u.username||u.password)return null;return canonicalizeStockmanUrl(value);}catch{return null;}}
export function freshPage(check:PageCheck|undefined,now=Date.now()){return !!check&&Number.isFinite(Date.parse(check.checkedAt))&&Date.parse(check.checkedAt)<=now&&now-Date.parse(check.checkedAt)<86400000;}
// A read/review is not positive supplier evidence. Retry later rather than
// masking it as a successful 24-hour verification.
export function retryablePage(check:PageCheck|undefined,now=Date.now()){
 if(!check)return true;
 if(check.status==="verified")return !freshPage(check,now);
 const checked=Date.parse(check.checkedAt);
 if(!Number.isFinite(checked)||checked>now)return true;
 if((check.attempts??1)>=3)return false; // manual retry remains available
 return now-checked>=(check.status==="review"?10:30)*60_000;
}
export function pageQueue(statuses:Array<{reference:string;status:string;reasons:string[]}>,sourceUrls:Record<string,string>,checks:PageChecks){
 const groups=new Map<string,{pageKey:string;references:string[]}>(),exceptions:Array<{reference:string;reason:string}>=[];
 for(const row of statuses){if(row.status!=="BLOCKED"||row.reasons.includes("REFERENCE_NOT_ACTIVE")||!row.reasons.some(r=>["GROUPING_REQUIRES_SUPPLIER_EVIDENCE","GROUPING_EVIDENCE_EXPIRED","CONFLICTING_GROUPING"].includes(r)))continue;
 const url=pageUrl(sourceUrls[row.reference]||"");if(!url){exceptions.push({reference:row.reference,reason:"SUPPLIER_URL_MISSING"});continue;}
 if(!retryablePage(checks[url])){
  const check=checks[url];
  exceptions.push({reference:row.reference,reason:check.status==="verified"?(check.observedReferences.includes(row.reference)?"FAMILY_RELATION_REQUIRES_REVIEW":"REFERENCE_NOT_ON_VERIFIED_PAGE"):check.status==="unavailable"?"SUPPLIER_VERIFICATION_FAILED":"FAMILY_RELATION_REQUIRES_REVIEW"});
  continue;
 }
 const group=groups.get(url)||{pageKey:url,references:[]};group.references.push(row.reference);groups.set(url,group);
 }
 return {queue:[...groups.values()],pendingPages:groups.size,pendingReferences:[...groups.values()].reduce((n,p)=>n+p.references.length,0),exceptions,cachedPages:new Set(Object.keys(checks).filter(k=>checks[k].status==="verified"&&freshPage(checks[k])).map(k=>checks[k].canonicalPage||k)).size};
}
