import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { BrowserContext } from "playwright";

import { prisma } from "@/lib/db/prisma";

const SESSION_ID = "stockman-main";
const AAD = Buffer.from("oyste-stockman-session-v1", "utf8");

type StockmanStorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

function encryptionKey() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET est manquante : impossible de chiffrer la session Stockman.");
  }

  return createHash("sha256")
    .update("oyste-stockman-session-v1\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

function encryptState(state: StockmanStorageState) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(state), "utf8"),
    cipher.final(),
  ]);

  const payload: EncryptedPayload = {
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };

  return JSON.stringify(payload);
}

function decryptState(payloadText: string): StockmanStorageState {
  const payload = JSON.parse(payloadText) as EncryptedPayload;
  if (payload.v !== 1 || !payload.iv || !payload.tag || !payload.data) {
    throw new Error("Format de session Stockman persistée invalide.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plain) as StockmanStorageState;
}

export async function saveStockmanSessionState(state: StockmanStorageState) {
  const encryptedState = encryptState(state);
  const validatedAt = new Date();

  await prisma.stockmanAuthSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      encryptedState,
      validatedAt,
    },
    update: {
      encryptedState,
      validatedAt,
    },
  });
}

function shortFingerprint(label: string, value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;

  return createHash("sha256")
    .update(`oyste-stockman-diagnostic:${label}\0`, "utf8")
    .update(normalized, "utf8")
    .digest("hex")
    .slice(0, 8);
}

export type StockmanSessionDiagnostic = {
  dbFound: boolean;
  decryptOk: boolean;
  validatedAt: string | null;
  dbFingerprint: string | null;
  authSecretFingerprint: string | null;
  dbCheckOk: boolean;
};

export async function inspectStockmanSessionPersistence(): Promise<StockmanSessionDiagnostic> {
  const diagnostic: StockmanSessionDiagnostic = {
    dbFound: false,
    decryptOk: false,
    validatedAt: null,
    dbFingerprint: shortFingerprint("database", process.env.DATABASE_URL),
    authSecretFingerprint: shortFingerprint("auth-secret", process.env.AUTH_SECRET),
    dbCheckOk: false,
  };

  try {
    const record = await prisma.stockmanAuthSession.findUnique({
      where: { id: SESSION_ID },
      select: { encryptedState: true, validatedAt: true },
    });

    diagnostic.dbCheckOk = true;
    if (!record) return diagnostic;

    diagnostic.dbFound = true;
    diagnostic.validatedAt = record.validatedAt.toISOString();

    try {
      decryptState(record.encryptedState);
      diagnostic.decryptOk = true;
    } catch {
      diagnostic.decryptOk = false;
    }

    return diagnostic;
  } catch {
    // Ne jamais remonter ici le message Prisma brut : selon l'erreur il peut
    // contenir des informations sur la cible de base ou l'environnement.
    return diagnostic;
  }
}

export async function loadStockmanSessionState(): Promise<StockmanStorageState | null> {
  const record = await prisma.stockmanAuthSession.findUnique({
    where: { id: SESSION_ID },
    select: { encryptedState: true },
  });

  if (!record) return null;
  return decryptState(record.encryptedState);
}
