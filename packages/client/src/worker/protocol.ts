import type { Command, CommandResult, SimContent, SimSnapshot } from "@homestead/sim";

export const PROTOCOL_VERSION = 1;

export type MainToWorker =
  | { t: "Init"; protocolVersion: number; seed: number; content: SimContent }
  | { t: "Cmd"; cmd: Command; reqId: number };

export type WorkerToMain =
  | { t: "Ready"; protocolVersion: number }
  | { t: "Snapshot"; snap: SimSnapshot }
  | { t: "CmdResult"; reqId: number; result: CommandResult };
