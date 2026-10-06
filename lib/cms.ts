import { prisma } from "@/lib/db/prisma";
import { defaultCmsContent, mergeCms, type CmsContent } from "./cms-content";
export { defaultCmsContent, mergeCms, type CmsContent } from "./cms-content";

export async function getCmsContent(): Promise<CmsContent> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "cms.public" },
    });
    return mergeCms(setting?.value);
  } catch {
    return defaultCmsContent;
  }
}

export async function saveCmsContent(value: CmsContent, userId?: string) {
  const clean = mergeCms(value);
  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: "cms.public" },
      update: {
        value: clean as any,
        isPublic: true,
        description: "Contenus publics administrables depuis le CMS OYSTE",
      },
      create: {
        key: "cms.public",
        value: clean as any,
        isPublic: true,
        description: "Contenus publics administrables depuis le CMS OYSTE",
      },
    }),
    prisma.auditLog.create({
      data: {
        action: "CMS_UPDATE",
        entityType: "SiteContent",
        entityId: "cms.public",
        userId,
        metadata: { sections: Object.keys(clean) } as any,
      },
    }),
  ]);
  return clean;
}
