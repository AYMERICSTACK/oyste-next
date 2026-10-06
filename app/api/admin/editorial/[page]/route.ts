import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canWriteContent } from "@/lib/admin/catalogue-permissions";
import { getEditorialPage } from "@/lib/editorial";
import { isEditorialPageId, validateEditorial } from "@/lib/editorial-validation";
import { editorialDescriptors } from "@/lib/editorial-defaults";
export async function GET(_:Request,{params}:{params:Promise<{page:string}>}){const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Non autorisé"},{status:401});const {page}=await params;if(!isEditorialPageId(page))return NextResponse.json({error:"Page introuvable"},{status:404});return NextResponse.json({value:await getEditorialPage(page),descriptor:editorialDescriptors[page],writable:canWriteContent(admin)});}
export async function PUT(request:Request,{params}:{params:Promise<{page:string}>}){const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Non autorisé"},{status:401});if(!canWriteContent(admin))return NextResponse.json({error:"Modification non autorisée"},{status:403});const {page}=await params;if(!isEditorialPageId(page))return NextResponse.json({error:"Page introuvable"},{status:404});const value=validateEditorial(page,await request.json().catch(()=>null));if(!value)return NextResponse.json({error:"Vérifiez les textes, les liens et les blocs."},{status:400});const key=`cms.page.${page}`;await prisma.$transaction([prisma.siteSetting.upsert({where:{key},create:{key,value,isPublic:true,description:editorialDescriptors[page].title},update:{value}}),prisma.auditLog.create({data:{action:"EDITORIAL_UPDATE",entityType:"SiteSetting",entityId:key,userId:admin.id}})]);return NextResponse.json({value});}
