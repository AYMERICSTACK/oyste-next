import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PageChecks } from "./page-queue";
import type { Evidence } from "./planner";
import { ResolutionError } from "./runtime-errors";

export const importStateKey = "stockman.global-import.v299";
type State = { pages: PageChecks; failures: Record<string, string>; evidence: Evidence[] };
type StoredState = State & { lease?: { token: string; expiresAt: number } | null };

export async function readImportState(db: Prisma.TransactionClient = prisma): Promise<StoredState> {
  const row = await db.siteSetting.findUnique({ where: { key: importStateKey }, select: { value: true } });
  return (row?.value as unknown as StoredState | undefined) ?? { pages: {}, failures: {}, evidence: [] };
}

async function writeState(tx: Prisma.TransactionClient, state: StoredState) {
  const value = state as unknown as Prisma.InputJsonValue;
  await tx.siteSetting.upsert({ where: { key: importStateKey },
    create: { key: importStateKey, value, isPublic: false }, update: { value, isPublic: false } });
}

async function withState<T>(fn: (tx: Prisma.TransactionClient, state: StoredState) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(193701, 5)`;
    return fn(tx, await readImportState(tx));
  });
}

const busy = () => new ResolutionError("RESOLUTION_BUSY", "Résolution en cours ou bail expiré. Rechargez avant de reprendre.", 409);

export async function acquireImportLease() {
  const token = randomUUID();
  await withState(async (tx, state) => {
    if (state.lease && state.lease.expiresAt > Date.now()) throw busy();
    await writeState(tx, { ...state, lease: { token, expiresAt: Date.now() + 120_000 } });
  });
  return {
    commit: (value: State) => withState(async (tx, state) => {
      if (state.lease?.token !== token || state.lease.expiresAt <= Date.now()) throw busy();
      await writeState(tx, { ...value, lease: null });
    }),
    release: () => withState(async (tx, state) => {
      if (state.lease?.token === token) await writeState(tx, { ...state, lease: null });
    }),
  };
}
