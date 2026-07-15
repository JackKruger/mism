import type { MotiveName, SimSnapshot } from "@homestead/sim";

/**
 * Bottom-left needs panel for the selected person: 8 motive bars + mood
 * readout + queue chip + failure-state banner. Plain DOM (like the M0 Hud);
 * writes are throttled to at most 4/sec.
 */

/** Display order + labels (matches sim/src/people/needs.ts MOTIVES order). */
const MOTIVES: readonly MotiveName[] = [
  "hunger",
  "energy",
  "comfort",
  "fun",
  "social",
  "hygiene",
  "bladder",
  "room",
];

const LABELS: Record<MotiveName, string> = {
  hunger: "Hunger",
  energy: "Energy",
  comfort: "Comfort",
  fun: "Fun",
  social: "Social",
  hygiene: "Hygiene",
  bladder: "Bladder",
  room: "Room",
};

/** Green ≥ +34, amber −33..+33, red ≤ −34. */
const GOOD = "#6fc06f";
const WARN = "#dfa63f";
const BAD = "#e05353";

const bandColor = (v: number): string => (v >= 34 ? GOOD : v <= -34 ? BAD : WARN);

const DOM_WRITE_MIN_MS = 250;

export class NeedsPanel {
  private nameEl = document.getElementById("needs-name")!;
  private moodEl = document.getElementById("needs-mood")!;
  private statusEl = document.getElementById("needs-status")!;
  private queueEl = document.getElementById("needs-queue")!;
  private fills = new Map<MotiveName, HTMLDivElement>();
  private lastWriteAt = 0;

  constructor() {
    const bars = document.getElementById("needs-bars")!;
    for (const motive of MOTIVES) {
      const row = document.createElement("div");
      row.className = "need-row";
      const label = document.createElement("span");
      label.className = "need-label";
      label.textContent = LABELS[motive];
      const track = document.createElement("div");
      track.className = "need-track";
      const fill = document.createElement("div");
      fill.className = "need-fill";
      track.appendChild(fill);
      row.append(label, track);
      bars.appendChild(row);
      this.fills.set(motive, fill);
    }
  }

  syncFromSim(snap: SimSnapshot, personId: number): void {
    const now = performance.now();
    if (now - this.lastWriteAt < DOM_WRITE_MIN_MS) return;
    const p = snap.people.find((v) => v.id === personId);
    if (!p) return;
    this.lastWriteAt = now;

    this.nameEl.textContent = p.name;
    this.moodEl.textContent = `Mood ${p.mood >= 0 ? "+" : ""}${p.mood}`;
    this.moodEl.style.color = bandColor(p.mood);

    this.statusEl.hidden = p.status === "normal";
    if (p.status !== "normal") {
      this.statusEl.textContent = p.status === "passedOut" ? "PASSED OUT" : "DEAD";
    }

    this.queueEl.hidden = p.queueLength === 0;
    this.queueEl.textContent =
      p.queueLength === 1 ? "1 action queued" : `${p.queueLength} actions queued`;

    for (const motive of MOTIVES) {
      const v = p.needs[motive];
      const fill = this.fills.get(motive)!;
      // [-100, 100] → 0–100% width.
      fill.style.width = `${(v + 100) / 2}%`;
      fill.style.background = bandColor(v);
    }
  }
}
