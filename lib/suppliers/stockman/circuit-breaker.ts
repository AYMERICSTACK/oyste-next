export const STOCKMAN_HTTP_500_THRESHOLD = 3;
export const STOCKMAN_HTTP_500_COOLDOWN_MS = 5 * 60_000;

export type StockmanHttp500Failure = {
  nodeId: string;
  url: string;
};

export type StockmanCircuitBreakerState = {
  state: "CLOSED" | "OPEN";
  consecutiveHttp500: number;
  failures: StockmanHttp500Failure[];
  openedAt?: string;
  retryAfter?: string;
  trips: number;
};

export type StockmanCircuitDecision = {
  circuit: StockmanCircuitBreakerState;
  opened: boolean;
  stopBatch: boolean;
  refundNodeIds: string[];
};

export const closedStockmanCircuit = (trips = 0): StockmanCircuitBreakerState => ({
  state: "CLOSED",
  consecutiveHttp500: 0,
  failures: [],
  trips,
});

export function isStockmanHttp500(error?: string) {
  return typeof error === "string" && /Réponse catalogue invalide\s*:\s*HTTP 500\./i.test(error);
}

export function isStockmanCircuitCoolingDown(circuit: StockmanCircuitBreakerState | undefined, now = Date.now()) {
  return circuit?.state === "OPEN" && Date.parse(circuit.retryAfter ?? "") > now;
}

export function evaluateStockmanCircuitResult(
  current: StockmanCircuitBreakerState | undefined,
  input: { nodeId: string; url: string; ok: boolean; error?: string; probe: boolean },
  now = Date.now(),
): StockmanCircuitDecision {
  const previous = current ?? closedStockmanCircuit();
  const http500 = !input.ok && isStockmanHttp500(input.error);

  if (!http500) {
    return {
      circuit: closedStockmanCircuit(previous.trips),
      opened: false,
      stopBatch: false,
      refundNodeIds: [],
    };
  }

  if (input.probe || previous.state === "OPEN") {
    return {
      circuit: {
        state: "OPEN",
        consecutiveHttp500: Math.max(1, previous.consecutiveHttp500 + 1),
        failures: [{ nodeId: input.nodeId, url: input.url }],
        openedAt: new Date(now).toISOString(),
        retryAfter: new Date(now + STOCKMAN_HTTP_500_COOLDOWN_MS).toISOString(),
        trips: previous.trips + 1,
      },
      opened: true,
      stopBatch: true,
      refundNodeIds: [input.nodeId],
    };
  }

  const failures = previous.failures.some((failure) => failure.url === input.url)
    ? previous.failures
    : [...previous.failures, { nodeId: input.nodeId, url: input.url }];
  const consecutiveHttp500 = previous.consecutiveHttp500 + 1;
  const opened = failures.length >= STOCKMAN_HTTP_500_THRESHOLD;
  return {
    circuit: opened ? {
      state: "OPEN",
      consecutiveHttp500,
      failures,
      openedAt: new Date(now).toISOString(),
      retryAfter: new Date(now + STOCKMAN_HTTP_500_COOLDOWN_MS).toISOString(),
      trips: previous.trips + 1,
    } : {
      state: "CLOSED",
      consecutiveHttp500,
      failures,
      trips: previous.trips,
    },
    opened,
    stopBatch: opened,
    refundNodeIds: opened ? failures.map((failure) => failure.nodeId) : [],
  };
}
