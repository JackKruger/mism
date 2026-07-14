/// <reference lib="webworker" />
import { createSim, type SimHandle } from "@homestead/sim";
import { PROTOCOL_VERSION, type MainToWorker, type WorkerToMain } from "./protocol.js";

/**
 * The sim worker: owns the SimHandle, runs the fixed-timestep loop, and
 * streams snapshots to the main thread. 1 interval = 50 ms real time;
 * ticks per interval = game speed (speed 1 → 20 ticks/sec → 1 sim-min/sec).
 */

let sim: SimHandle | null = null;

const post = (msg: WorkerToMain): void => {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
};

const INTERVAL_MS = 50;
let acc = 0;
let last = 0;

function loop(): void {
  const now = performance.now();
  acc += now - last;
  last = now;

  if (sim) {
    // Catch up in whole intervals; cap to avoid spiral-of-death after a stall.
    let intervals = Math.floor(acc / INTERVAL_MS);
    acc -= intervals * INTERVAL_MS;
    if (intervals > 10) intervals = 10;

    const speed = sim.snapshot().speed;
    if (speed > 0 && intervals > 0) sim.tick(speed * intervals);
    post({ t: "Snapshot", snap: sim.snapshot() });
  }
}

self.onmessage = (ev: MessageEvent<MainToWorker>) => {
  const msg = ev.data;
  switch (msg.t) {
    case "Init": {
      if (msg.protocolVersion !== PROTOCOL_VERSION) {
        throw new Error(`Worker protocol mismatch: ${msg.protocolVersion} vs ${PROTOCOL_VERSION}`);
      }
      sim = createSim({ seed: msg.seed });
      last = performance.now();
      acc = 0;
      setInterval(loop, INTERVAL_MS);
      post({ t: "Ready", protocolVersion: PROTOCOL_VERSION });
      break;
    }
    case "Cmd": {
      if (!sim) return;
      const result = sim.apply(msg.cmd);
      post({ t: "CmdResult", reqId: msg.reqId, result });
      break;
    }
  }
};
