import assert from "node:assert/strict";
import test from "node:test";
import {
  closedStockmanCircuit,
  evaluateStockmanCircuitResult,
  isStockmanCircuitCoolingDown,
  STOCKMAN_HTTP_500_COOLDOWN_MS,
} from "../circuit-breaker";

const failure = (index: number, probe = false) => ({
  nodeId: `node-${index}`,
  url: `https://www.stockman.fr/page-${index}.aspx`,
  ok: false,
  error: "Réponse catalogue invalide : HTTP 500.",
  probe,
});

test("un HTTP 500 isolé conserve la politique normale de retry", () => {
  const decision = evaluateStockmanCircuitResult(undefined, failure(1), 1_000);
  assert.equal(decision.opened, false);
  assert.equal(decision.stopBatch, false);
  assert.deepEqual(decision.refundNodeIds, []);
  assert.equal(decision.circuit.consecutiveHttp500, 1);
});

test("trois HTTP 500 consécutifs sur des URL distinctes ouvrent le circuit", () => {
  let circuit = closedStockmanCircuit();
  circuit = evaluateStockmanCircuitResult(circuit, failure(1), 1_000).circuit;
  circuit = evaluateStockmanCircuitResult(circuit, failure(2), 2_000).circuit;
  const decision = evaluateStockmanCircuitResult(circuit, failure(3), 3_000);
  assert.equal(decision.opened, true);
  assert.equal(decision.stopBatch, true);
  assert.equal(decision.circuit.state, "OPEN");
  assert.deepEqual(decision.refundNodeIds, ["node-1", "node-2", "node-3"]);
});

test("les HTTP 500 répétés sur une même URL restent une erreur locale", () => {
  let circuit = closedStockmanCircuit();
  for (let index = 0; index < 3; index++) circuit = evaluateStockmanCircuitResult(circuit, failure(1), index).circuit;
  assert.equal(circuit.state, "CLOSED");
  assert.equal(circuit.failures.length, 1);
});

test("un circuit ouvert impose un cooldown puis autorise une sonde", () => {
  let circuit = closedStockmanCircuit();
  for (let index = 1; index <= 3; index++) circuit = evaluateStockmanCircuitResult(circuit, failure(index), index * 1_000).circuit;
  assert.equal(isStockmanCircuitCoolingDown(circuit, 3_000 + STOCKMAN_HTTP_500_COOLDOWN_MS - 1), true);
  assert.equal(isStockmanCircuitCoolingDown(circuit, 3_000 + STOCKMAN_HTTP_500_COOLDOWN_MS), false);
});

test("une sonde encore en HTTP 500 rouvre le circuit sans consommer son retry", () => {
  const open = {
    ...closedStockmanCircuit(1),
    state: "OPEN" as const,
    retryAfter: new Date(0).toISOString(),
  };
  const decision = evaluateStockmanCircuitResult(open, failure(4, true), 10_000);
  assert.equal(decision.stopBatch, true);
  assert.deepEqual(decision.refundNodeIds, ["node-4"]);
  assert.equal(decision.circuit.trips, 2);
});

test("une sonde réussie ferme le circuit et permet la reprise normale", () => {
  const open = {
    ...closedStockmanCircuit(1),
    state: "OPEN" as const,
    retryAfter: new Date(0).toISOString(),
  };
  const decision = evaluateStockmanCircuitResult(open, {
    nodeId: "node-ok", url: "https://www.stockman.fr/ok.aspx", ok: true, probe: true,
  }, 10_000);
  assert.equal(decision.circuit.state, "CLOSED");
  assert.equal(decision.stopBatch, false);
  assert.equal(decision.circuit.trips, 1);
});
