import "server-only";

import { randomUUID } from "node:crypto";

// OYSTE_STOCKMAN_REDIS_STRING_SLOTS_V2
// Deux emplacements Redis avec expiration automatique.
// Protection partagee entre toutes les instances OYSTE.

const MINUTE_KEY = "oyste:stockman:public:v2:minute";
const SLOT_1 = "oyste:stockman:public:v2:slot:1";
const SLOT_2 = "oyste:stockman:public:v2:slot:2";

const acquireScript = `
local count = tonumber(redis.call("GET", KEYS[1]) or "0")

if count >= 24 then
  return 0
end

local slot = 0

if not redis.call("GET", KEYS[2]) then
  slot = 2
elseif not redis.call("GET", KEYS[3]) then
  slot = 3
else
  return 0
end

local updated = redis.call("INCR", KEYS[1])

if updated == 1 then
  redis.call("PEXPIRE", KEYS[1], 60000)
end

-- OYSTE_STOCKMAN_EXPLICIT_SLOTS_V3
if slot == 2 then
  redis.call("SET", KEYS[2], ARGV[1], "PX", 90000)
else
  redis.call("SET", KEYS[3], ARGV[1], "PX", 90000)
end

return slot
`;

const releaseScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end

return 0
`;

async function command(args: Array<string | number>): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || !url.startsWith("https://")) {
    throw new Error("Distributed rate limit unavailable");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    throw new Error("Distributed rate limit request failed");
  }

  const payload = (await response.json()) as {
    result?: unknown;
    error?: string;
  };

  if (payload.error || !("result" in payload)) {
    throw new Error("Distributed rate limit response invalid");
  }

  return payload.result;
}

export async function acquireStockmanDistributedSlot():
  Promise<(() => Promise<void>) | null> {
  const token = randomUUID();

  const result = await command([
    "EVAL",
    acquireScript,
    3,
    MINUTE_KEY,
    SLOT_1,
    SLOT_2,
    token,
  ]);

  if (result === 0) return null;

  if (result !== 2 && result !== 3) {
    throw new Error("Distributed rate limit result invalid");
  }

  const slotKey = result === 2 ? SLOT_1 : SLOT_2;

  return async () => {
    await command([
      "EVAL",
      releaseScript,
      1,
      slotKey,
      token,
    ]);
  };
}