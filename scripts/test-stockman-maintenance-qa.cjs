const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');

const specifications = [["BAL100",["BAL100"],[]],["BL",["BL40","BL80"],[]],["BS",["BS100","BS15","BS25","BS50","BS75"],[]],["BS L",["BS100L","BS50LA","BS50LB"],[]],["BS D",["BS30D","BS50D","BS80D"],[]],["DCE105",["DCE105"],["B-1-00166","A-3-00021","B-1-00015","B-1-00085","B-1-00031","B-1-00003","B-1-00002","B-1-00423","C-2-00445","C101000298","C-1-00969"]],["DGM170",["DGM170"],["B-1-00423","C-2-00445","C101000298","C-1-00969"]],["DMEG",["DMEG170","DMEG200"],["B-1-00166","A-3-00002","A-1-00026","B-1-00068","B601000129","B-1-00013","A-3-00021","B-1-00015","A404000006","B-1-00085","B-1-00031","B-1-00408","B-00163","B-1-00446","B-1-00004","B-00208","B-1-00003","B-1-00002","B-1-00423","C-2-00445","C-2-00286","B-1-00202","C-1-00969","B-1-00033","B-1-00327","B-1-00331","B-1-00188"]],["DMEG170-R",["DMEG170-R"],["B-1-00166","B-1-00068","A-3-00021","B-1-00015","B-1-00031","B-1-00003","B-1-00002","B-1-00423","C-2-00445","C-2-00286","B-1-00202","C-1-00969","B-1-00033","B-1-00327","B-1-00331","B-1-00188"]],["DMEG250",["DMEG250"],["B-1-00166","A-3-00002","A-1-00026","B-1-00068","B601000129","B-1-00013","A-3-00021","B-1-00015","A404000006","B-1-00085","B-1-00031","B-1-00408","B-00163","B-1-00446","B-1-00004","B-00208","B-1-00003","B-1-00002","B-1-00423","C-2-00445","C-2-00286","B-1-00202","C-1-00969","B-1-00033","B-1-00327","B-1-00331","B-1-00188"]],["ES",["ES100","ES100L","ES50","ES50D","ES50LA","ES50LB","ES75","ES80D"],[]],["ESM",["ESM80","ESM80D"],[]],["HULC1000",["HULC1000/220V","HULC1000/380V"],[]],["HUS600",["HUS600"],[]],["HW501",["HW501/220V","HW501/380V"],[]],["HWLC",["HWLC1000/220V","HWLC1000/380V","HWLC2000/380V"],[]],["HWS1800",["HWS1800"],[]],["HYLC1000",["HYLC1000/220V","HYLC1000/380V"],[]],["HZ1000",["HZ1000"],[]],["MD20R",["MD20R"],[]],["MH-V",["MH-V10","MH-V20"],[]],["P MR",["P110MR","P150MR","P50MR","P70MR"],[]],["PHP50PLUS",["PHP50PLUS"],[]],["PM-1",["PM30R/1","PM50/1","PM50/2"],["PM/1KITGUARD","PM/2KITGUARD"]],["PSE12NM",["PSE12NM1600","PSE12NM2000","PSE12NM800"],[]],["SA",["SA1000","SA500"],[]],["SBC",["SBC21","SBC40"],[]],["SBV",["SBV200","SBV500"],[]],["SC",["SC1000","SC2000","SC500"],[]],["SC M",["SC300DM","SC500SM"],[]],["SCH",["SCH05","SCH075"],[]],["SCP05EE",["SCP05EE"],[]],["SME170",["SME170"],["B-1-00324","B-1-00397","B-1-00423","C-2-00445","C101000298","C-1-00969","B-1-00033","B-1-00327","B-1-00331","B-1-00188"]],["STF N",["STF15N","STF30N","STF50N"],[]],["STR80N",["STR80N"],["STR80NSAC","BOX6"]],["TM40D",["TM40D"],[]],["TS",["TS40","TS80"],[]],["XH15A",["XH15A"],[]],["ZC48",["ZC48"],[]]];

async function run() {
  assert.equal(process.env.VERCEL_ENV,'preview');
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF,'recette-stockman-isolee');
  assert.equal(process.env.OYSTE_STOCKMAN_TEST,'true');
  const next = Module._resolveFilename;
  Module._resolveFilename = function(name,...args) {
    return next.call(this,name.startsWith('@/') ? path.resolve(name.slice(2)) : name,...args);
  };
  const { prisma } = require('../lib/db/prisma.ts');
  const { maintenanceDigest } = require('../lib/suppliers/stockman/global-import/maintenance.ts');
  const { SCOPE_VERSION } = require('../lib/suppliers/stockman/global-import/scope.ts');
  const { simulate, startRun, stepRun, rollbackRun } = require('../lib/suppliers/stockman/global-import/service.ts');
  const { stockmanReplacementSetting } = require('../lib/suppliers/stockman/reference-replacements.ts');
  const { importStateKey } = require('../lib/suppliers/stockman/global-import/state.ts');
  const refs = specifications.flatMap(([, codes])=>codes);
  const marker = await prisma.$queryRawUnsafe('SELECT environment FROM "OysteQaMarker"');
  assert.deepEqual(marker,[{environment:'recette-stockman-isolee'}]);
  const fixture = await prisma.product.findFirstOrThrow({where:{code:'QASTOCK1'}});
  const oldProducts = await prisma.product.findMany({orderBy:{id:'asc'}});
  const oldVariants = await prisma.productVariant.findMany({orderBy:{id:'asc'}});
  const admin = await prisma.adminUser.findUniqueOrThrow({where:{email:'stockman-recette@example.invalid'}});
  assert.equal(admin.role,'SUPER_ADMIN');
  assert.equal(admin.status,'ACTIVE');
  const category = await prisma.category.findUniqueOrThrow({where:{slug:'qa-recette-oyste'}});
  const keys = [stockmanReplacementSetting,importStateKey];
  const settings = () => prisma.siteSetting.findMany({where:{key:{in:keys}},orderBy:{key:'asc'}});
  const before = await settings();
  assert(before.every(row=>!row.isPublic));
  const beforeState = maintenanceDigest(before.map(({key,value,isPublic})=>({key,value,isPublic})));
  assert.equal(await prisma.product.count({where:{OR:[{code:{in:specifications.map(([p])=>p)}},{code:{in:refs}}]}}),0,'QA catalogue footprint already exists');
  assert.equal(await prisma.productVariant.count({where:{code:{in:refs}}}),0,'QA variant footprint already exists');
  const oldRefs = new Set((await prisma.stockmanCatalogReference.findMany({where:{reference:{in:refs}},select:{reference:true}})).map(row=>row.reference));
  const indexedSale = await prisma.$queryRawUnsafe('SELECT reference, "priceHt" FROM "StockmanSalePrice" WHERE reference = ANY($1::text[])', refs);
  const prices = new Map(indexedSale.map(row=>[row.reference,Number(row.priceHt)]));
  const date = new Date();
  const makeFamily = ([familyCode,references,options]) => {
    const sourceUrl = 'https://www.stockman.fr/fr/recette--'+encodeURIComponent(familyCode)+'.aspx';
    return {familyCode,name:'Famille de recette '+familyCode,approvedCategoryId:category.id,sourceUrl,verifiedAt:date.toISOString(),
      products:references.map(reference=>({reference,name:'Variante de recette '+reference,sourceUrl,weightKg:23,
        features:[{label:'Capacité',value:'100 kg'}],images:[],documents:[],expectedSaleHT:prices.get(reference)??125,
        purchaseObservation:{amountHT:Math.min(100,(prices.get(reference)??125)*0.75),readAt:date.toISOString()}})),
      excluded:options.map(reference=>({reference,role:'OPTION',evidence:'Ligne option dans la fixture isolée'}))};
  };
  const registry = Array.from({length:38},(_,i)=>({
    formerReference:'QA-OLD-B-'+i,successorReference:i<25?'QA-NEW-B-'+i:null,
    family:'QA',category:'Recette',sourceUrl:i<25?'https://www.stockman.fr/fr/ancienne--QA.aspx':null,
    observedAt:i<25?date.toISOString():null,evidence:'Preuve fictive de recette',oysteReference:null
  }));
  const manifest={scopeVersion:SCOPE_VERSION,families:specifications.map(makeFamily),registry};
  let session=null;
  const originalLoad=Module._load;
  Module._load=function(name,...args) {
    if(name==='@/lib/auth/admin-session') return {getCurrentAdmin:async()=>session};
    return originalLoad.call(this,name,...args);
  };
  let handler;
  try { handler=require('../app/api/admin/suppliers/stockman/global-import/maintenance/route.ts').POST; }
  finally {Module._load=originalLoad;}
  const origin='https://stockman-qa.invalid';
  const request=async(body,from=origin)=>{
    const res=await handler(new Request(origin+'/api/admin/suppliers/stockman/global-import/maintenance',{
      method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)
    }));
    return {status:res.status,body:await res.json()};
  };
  const approve=(operation,data)=>{process.env.STOCKMAN_MAINTENANCE_APPROVAL=JSON.stringify({
    operation,manifestSha256:maintenanceDigest(data),expiresAt:new Date(Date.now()+3600000).toISOString()
  });};
  const testId='qa-b-'+randomUUID();
  const verifyId=testId+'-verify';
  const madeRefs=refs.filter(ref=>!oldRefs.has(ref));
  const madeSale=refs.filter(ref=>!prices.has(ref));
  let runId;
  let restored=false;
  const check=async(input,status,code)=>{
    const response=await request(input);
    assert.equal(response.status,status,JSON.stringify(response));
    if(code) assert.equal(response.body.code,code,JSON.stringify(response));
    return response.body;
  };
  const preview=(operation, payload=manifest)=>({action:'preview',operation,manifest:payload});
  const apply=(operation,token)=>({action:'apply',operation,manifest,preview:token,confirmation:'APPLY_STOCKMAN_MAINTENANCE'});
  try {
    await prisma.$transaction(async tx=>{
      const safe=await tx.$queryRawUnsafe('SELECT environment FROM "OysteQaMarker"');
      assert.deepEqual(safe,[{environment:'recette-stockman-isolee'}]);
      for(const f of manifest.families) {
        for(const p of f.products) {
          if(!oldRefs.has(p.reference)) await tx.stockmanCatalogReference.create({data:{
            reference:p.reference,designation:p.name,sourceUrl:p.sourceUrl,firstSeenAt:date,lastSeenAt:date,lastChangedAt:date
          }});
          if(!prices.has(p.reference)) await tx.$executeRawUnsafe(
            'INSERT INTO "StockmanSalePrice" (reference,"priceHt","sourceVersion","sourceSha256") VALUES ($1,$2,$3,$4)',
            p.reference,125,'RECETTE',testId
          );
        }
      }
    },{timeout:30000});
    delete process.env.STOCKMAN_MAINTENANCE_APPROVAL;
    delete process.env.STOCKMAN_COLLECTIVE_IMPORT_AUTHORIZED;
    await check(preview(verifyId),401,'UNAUTHENTICATED');
    session={...admin,role:'READ_ONLY'};
    await check(preview(verifyId),403,'FORBIDDEN');
    session=admin;
    assert.equal((await request(preview(verifyId),'https://other.invalid')).status,403);
    await check(preview(verifyId),423,'MAINTENANCE_DISABLED');
    await assert.rejects(startRun(admin.id),{code:'COMMERCIAL_WRITES_DISABLED'});
    approve(verifyId,manifest);
    const tampered=structuredClone(manifest);
    tampered.families[0].products[0].reference='OUTSIDE';
    await check(preview(verifyId,tampered),409,'MANIFEST_NOT_APPROVED');
    approve(verifyId,tampered);
    await check(preview(verifyId,tampered),409,'MANIFEST_REFERENCE_BLOCKED');
    const stale=structuredClone(manifest);
    stale.families[0].products[0].purchaseObservation.readAt=new Date(Date.now()-86400001).toISOString();
    approve(verifyId,stale);
    await check(preview(verifyId,stale),409,'STALE_PURCHASE_OBSERVATION');
    const old=structuredClone(manifest);
    old.registry[0].formerReference=old.families[0].products[0].reference;
    approve(verifyId,old);
    await check(preview(verifyId,old),409,'MANIFEST_REFERENCE_BLOCKED');
    const option=structuredClone(manifest);
    option.families[0].excluded.push({reference:option.families[0].products[0].reference,role:'OPTION',evidence:'Test'});
    approve(verifyId,option);
    await check(preview(verifyId,option),409,'MANIFEST_REFERENCE_BLOCKED');
    const low=structuredClone(manifest);
    low.families[0].products[0].purchaseObservation.amountHT=low.families[0].products[0].expectedSaleHT;
    approve(verifyId,low);
    await check(preview(verifyId,low),409,'MARGIN_BELOW_REFERENCE');
    approve(verifyId,manifest);
    await check(apply(verifyId,'0'.repeat(64)),409,'MAINTENANCE_PREVIEW_CHANGED');
    const projected=await check(preview(verifyId),200);
    assert.deepEqual([projected.parents,projected.references,projected.excluded],[39,80,34]);
    assert.equal(maintenanceDigest((await settings()).map(({key,value,isPublic})=>({key,value,isPublic}))),beforeState);
    const results=await Promise.all([request(apply(verifyId,projected.preview)),request(apply(verifyId,projected.preview))]);
    assert.deepEqual(results.map(result=>result.body.status).sort(),['already-applied','applied'],JSON.stringify(results));
    let registryContents=(await prisma.siteSetting.findUniqueOrThrow({where:{key:stockmanReplacementSetting}})).value;
    assert.equal(registryContents.filter(r=>r.formerReference.startsWith('QA-OLD-B-')).length,38);
    const rollback={action:'rollback',operation:verifyId,confirmation:'ROLLBACK_STOCKMAN_MAINTENANCE'};
    assert.equal((await check(rollback,200)).status,'rolled-back');
    assert.equal((await check(rollback,200)).status,'already-rolled-back');
    assert.equal(maintenanceDigest((await settings()).map(({key,value,isPublic})=>({key,value,isPublic}))),beforeState);
    approve(testId,manifest);
    assert.equal((await check(apply(testId,(await check(preview(testId),200)).preview),200)).status,'applied');
    await assert.rejects(startRun(admin.id),{code:'COMMERCIAL_WRITES_DISABLED'});
    const durable=await simulate();
    const matching=durable.groups.filter(g=>specifications.some(([parent])=>parent===g.key));
    assert.deepEqual([matching.length,matching.flatMap(group=>group.products).length],[39,80]);
    process.env.STOCKMAN_COLLECTIVE_IMPORT_AUTHORIZED='true';
    process.env.STOCKMAN_V297_SCOPE_APPROVED=SCOPE_VERSION;
    process.env.STOCKMAN_COLLECTIVE_APPROVED_SELECTION=JSON.stringify(manifest.families.map(f=>({
      parent:f.familyCode,categoryId:f.approvedCategoryId,references:f.products.map(p=>p.reference)
    })));
    ({runId}=await startRun(admin.id));
    for(let i=0;i<39;i++) assert((await stepRun(runId,admin.id)).created);
    assert.deepEqual(await stepRun(runId,admin.id),{done:true});
    assert.deepEqual(await stepRun(runId,admin.id),{done:true});
    await assert.rejects(startRun(admin.id),{code:'APPROVED_FAMILIES_UNAVAILABLE'});
    const drafts=await prisma.product.findMany({where:{code:{in:specifications.map(([name])=>name)}},include:{variants:true}});
    assert.deepEqual([drafts.length,drafts.flatMap(p=>p.variants).length],[39,80]);
    for(const draft of drafts) {
      assert.equal(draft.publicationStatus,'DRAFT');
      assert.equal(draft.shippingMode,'QUOTE');
      assert.equal(draft.categoryId,category.id);
      for(const variant of draft.variants) {
        assert.equal(Number(variant.priceHt),prices.get(variant.code)??125);
        assert.equal(variant.shippingMode,'QUOTE');
        assert.equal(variant.weightKg.toString(),'23');
        assert.equal(variant.sourceData.stockman.stockOnRequest,true);
      }
    }
    assert.deepEqual(await prisma.product.findUniqueOrThrow({where:{id:fixture.id}}),fixture);
    assert.deepEqual(await prisma.product.findMany({where:{id:{in:oldProducts.map(p=>p.id)}},orderBy:{id:'asc'}}),oldProducts);
    assert.deepEqual(await prisma.productVariant.findMany({where:{id:{in:oldVariants.map(p=>p.id)}},orderBy:{id:'asc'}}),oldVariants);
    process.env.STOCKMAN_V297_ROLLBACK_ENABLED='true';
    for(let i=0;i<39;i++) assert.equal((await rollbackRun(runId,admin.id)).restored,1);
    assert.equal((await rollbackRun(runId,admin.id)).done,true);
    restored=true;
    console.log('STOCKMAN MAINTENANCE QA: roles, off-by-default, exact manifest, options, old codes, expiry, margin, concurrent replay, registry 38, rollback, durable 39/80, draft 39/80, replay and existing catalogue verified');
  } finally {
    if (restored || !runId) {
      await prisma.$transaction(async tx=>{
        for(const key of keys) {
          const item=before.find(x=>x.key===key);
          if(item) await tx.siteSetting.update({where:{key},data:{value:item.value,isPublic:item.isPublic}});
          else await tx.siteSetting.deleteMany({where:{key}});
        }
        await tx.stockmanCatalogReference.deleteMany({where:{reference:{in:madeRefs},firstSeenAt:date}});
        await tx.$executeRawUnsafe('DELETE FROM "StockmanSalePrice" WHERE reference = ANY($1::text[]) AND "sourceSha256" = $2',madeSale,testId);
      });
    }
    await prisma.$disconnect();
  }
}
run().catch(error=>{
  const message=error.message?.split('\n').map(line=>line.trim()).filter(Boolean)
    .filter(line=>!/postgres(?:ql)?:\/\/|password|token/i.test(line)).slice(0,8).join(' ');
  console.error('STOCKMAN MAINTENANCE QA: '+(error.code??error.name)+' '+message);
  process.exitCode=1;
});
