import {ResolutionError} from "./global-import/runtime-errors";
type Resource={context:{close():Promise<unknown>};browser:{close():Promise<unknown>}};
/** Owns late opening/reading failures too: no abandoned rejection or live browser on timeout. */
export async function boundedResourceRead<R extends Resource,T>(open:()=>Promise<R>,read:(r:R)=>Promise<T>,timeoutMs:number):Promise<T>{
 let resource:R|undefined,expired=false,timer:ReturnType<typeof setTimeout>|undefined;
 const close=async(r:R)=>{await Promise.allSettled([Promise.resolve().then(()=>r.context.close()),Promise.resolve().then(()=>r.browser.close())]);};
 const work=Promise.resolve().then(open).then(r=>{if(expired){void close(r);throw new ResolutionError("STOCKMAN_READ_TIMEOUT","Lecture arrêtée ; reprendre cette page.",504);}resource=r;return read(r);});
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ResolutionError("STOCKMAN_READ_TIMEOUT","Délai de lecture dépassé ; page conservée dans la file de reprise.",504)),timeoutMs);})]);}
 finally{expired=true;clearTimeout(timer);if(resource){let cleanupTimer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([close(resource),new Promise<void>(resolve=>{cleanupTimer=setTimeout(resolve,500);})]);}finally{clearTimeout(cleanupTimer);}}}
}
