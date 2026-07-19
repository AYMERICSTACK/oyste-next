import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackUrl = "postgresql://prisma:prisma@localhost:5432/oyste";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackUrl,
  },
});
