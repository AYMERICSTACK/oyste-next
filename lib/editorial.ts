import { prisma } from "@/lib/db/prisma";
import { getCmsContent } from "./cms";
import { mergeEditorial, type EditorialPageId } from "./editorial-validation";
import { Compass, Boxes, ShieldCheck, Search, SlidersHorizontal, ShoppingCart, UserRound, FileText, Headphones, CheckCircle2, PackageCheck, Truck, Factory, Mail, Clock3 } from "lucide-react";
export function editorialIcon(name:string){return ({Compass,Boxes,ShieldCheck,Search,SlidersHorizontal,ShoppingCart,UserRound,FileText,Headphones,CheckCircle2,PackageCheck,Truck,Factory,Mail,Clock3} as Record<string,typeof Compass>)[name] || Compass;}
export async function getEditorialPage<K extends EditorialPageId>(id:K) {
 try {const setting=await prisma.siteSetting.findUnique({where:{key:`cms.page.${id}`}});return mergeEditorial(id,setting?.value);}catch{return mergeEditorial(id,null);}
}
