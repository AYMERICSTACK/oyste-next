import { registerStockmanReplacements, stockmanReplacementsSchema } from "@/lib/suppliers/stockman/reference-replacements";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { simulate,verifyExceptions,progress,resetVerificationFailures,startRun,stepRun,rollbackRun } from "@/lib/suppliers/stockman/global-import/service";
import {resolutionFailure,ResolutionError} from "@/lib/suppliers/stockman/global-import/runtime-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("registerReplacements"), confirmation:z.literal("REGISTER_STOCKMAN_REPLACEMENTS"), records:stockmanReplacementsSchema.refine(items=>items.length>0&&items.length<=100)}).strict(),
 z.object({action:z.literal("retryVerification")}).strict(),
 z.object({action:z.literal("verify"),references:z.array(z.string().min(1).max(50)).length(1)}).strict(),
 z.object({action:z.literal("start"),confirmation:z.literal("APPLY_DRAFTS_V297")}).strict(),
 z.object({action:z.literal("step"),runId:z.string().uuid(),confirmation:z.literal("APPLY_DRAFTS_V297")}).strict(),
 z.object({action:z.literal("rollback"),runId:z.string().uuid(),confirmation:z.literal("ROLLBACK_DRAFTS_V297")}).strict()
]);
function failed(error:unknown){const {status,...body}=resolutionFailure(error);return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export async function GET(request:Request){try{const admin=await getCurrentAdmin();if(!admin||admin.status!=="ACTIVE")return NextResponse.json({message:"Non autorisé"},{status:401});const runId=new URL(request.url).searchParams.get("runId");return NextResponse.json(runId?{events:await progress(runId)}:{plan:await simulate(),events:await progress()},{headers:{"Cache-Control":"no-store"}});}catch(error){return failed(error);}}
export async function POST(request:Request){try{const admin=await getCurrentAdmin();if(!admin||admin.status!=="ACTIVE")return NextResponse.json({message:"Non autorisé"},{status:401});if(admin.role==="READ_ONLY")return NextResponse.json({message:"Rôle insuffisant"},{status:403});if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({message:"Origine refusée"},{status:403});const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({message:"Une référence d’ancrage par lot de résolution.",code:"INVALID_BATCH"},{status:400});const p=parsed.data;if (p.action === "verify") return NextResponse.json(await verifyExceptions(p.references));
if (p.action === "retryVerification") return NextResponse.json(await resetVerificationFailures());
if (admin.role !== "SUPER_ADMIN") throw new ResolutionError("COMMERCIAL_WRITES_DISABLED", "Import réservé au super administrateur.", 423);
if (p.action === "registerReplacements") return NextResponse.json(await registerStockmanReplacements(p.records, admin.id));
if (p.action === "start") return NextResponse.json(await startRun(admin.id));
if (p.action === "step") return NextResponse.json(await stepRun(p.runId, admin.id));
return NextResponse.json(await rollbackRun(p.runId, admin.id));}catch(error){return failed(error);}}
