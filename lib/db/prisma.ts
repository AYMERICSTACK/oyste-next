import { verifiedDatabaseUrl } from "./verified-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = verifiedDatabaseUrl();

  const adapter = new PrismaPg({ connectionString, max:5, connectionTimeoutMillis:5000, idleTimeoutMillis:10000, query_timeout:10000, allowExitOnIdle:true }, { onPoolError:()=>console.warn("[OYSTE_NEON_POOL_ERROR]"), onConnectionError:()=>console.warn("[OYSTE_NEON_CONNECTION_ERROR]") });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
