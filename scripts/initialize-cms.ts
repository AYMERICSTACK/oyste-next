import "dotenv/config";
import { prisma } from "../lib/db/prisma";
import { mergeCms } from "../lib/cms-content";
import { cmsContentSchema } from "../lib/cms-validation";

async function main() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "cms.public" } });
  const content = mergeCms(setting?.value);
  const validation = cmsContentSchema.safeParse(content);
  if (!validation.success) throw new Error("Le contenu existant nécessite une correction avant initialisation ; aucune écriture effectuée.");
  if (!process.argv.includes("--apply")) {
    console.log("Simulation : initialisation des collections home et titres de sections. Utiliser --apply pour enregistrer.");
    return;
  }
  // Check the version inside the transaction: never overwrite a concurrent BO edit.
  await prisma.$transaction(async tx => {
    const current = await tx.siteSetting.findUnique({ where: { key: "cms.public" } });
    if (JSON.stringify(current?.value) !== JSON.stringify(setting?.value)) throw new Error("Contenu modifié entre-temps ; relancer l’initialisation.");
    const previous = current?.value && typeof current.value === "object" && !Array.isArray(current.value) ? current.value : {};
    const home = previous.home && typeof previous.home === "object" && !Array.isArray(previous.home) ? previous.home : {};
    const value = { ...previous, ...content, home: { ...home, ...content.home } };
    await tx.siteSetting.upsert({ where: { key: "cms.public" }, update: { value, isPublic: true }, create: { key: "cms.public", value, isPublic: true, description: "Contenus publics administrables depuis le CMS OYSTE" } });
    await tx.auditLog.create({ data: { action: "CMS_INITIALIZE", entityType: "SiteContent", entityId: "cms.public" } });
  }, { isolationLevel: "Serializable" });
  console.log("Contenus initialisés. Valeurs éditoriales existantes conservées.");
}
main().catch(() => { console.error("Initialisation refusée ou indisponible ; vérifiez PostgreSQL et les contenus existants."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
