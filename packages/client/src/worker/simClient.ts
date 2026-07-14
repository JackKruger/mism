import type { Command, CommandResult, SimSnapshot } from "@homestead/sim";
import { PROTOCOL_VERSION, type WorkerToMain } from "./protocol.js";

/** Main-thread wrapper around the sim worker. */
export class SimClient {
  private worker: Worker;
  private nextReqId = 1;
  private pending = new Map<number, (r: CommandResult) => void>();
  private snapshotListeners: Array<(s: SimSnapshot) => void> = [];
  private readyResolve: (() => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL("./simWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev: MessageEvent<WorkerToMain>) => {
      const msg = ev.data;
      switch (msg.t) {
        case "Ready":
          this.readyResolve?.();
          this.readyResolve = null;
          break;
        case "Snapshot":
          for (const l of this.snapshotListeners) l(msg.snap);
          break;
        case "CmdResult": {
          const resolve = this.pending.get(msg.reqId);
          if (resolve) {
            this.pending.delete(msg.reqId);
            resolve(msg.result);
          }
          break;
        }
      }
    };
  }

  init(seed: number): Promise<void> {
    return new Promise((resolve) => {
      this.readyResolve = resolve;
      this.worker.postMessage({ t: "Init", protocolVersion: PROTOCOL_VERSION, seed });
    });
  }

  send(cmd: Command): Promise<CommandResult> {
    return new Promise((resolve) => {
      const reqId = this.nextReqId++;
      this.pending.set(reqId, resolve);
      this.worker.postMessage({ t: "Cmd", cmd, reqId });
    });
  }

  onSnapshot(listener: (s: SimSnapshot) => void): void {
    this.snapshotListeners.push(listener);
  }
}
