import type { GameSpeed, SimSnapshot } from "@homestead/sim";

/** Minimal DOM HUD for M0 (clock, speed, FPS). Replaced by the Preact UI in M1 (U-101). */
export class Hud {
  private clockEl = document.getElementById("clock")!;
  private fpsEl = document.getElementById("fps")!;
  private buttons: HTMLButtonElement[];
  private frames = 0;
  private lastFpsAt = performance.now();

  constructor(onSpeed: (speed: GameSpeed) => void) {
    this.buttons = [...document.querySelectorAll<HTMLButtonElement>(".speed-btn")];
    for (const btn of this.buttons) {
      btn.addEventListener("click", () => onSpeed(Number(btn.dataset["speed"]) as GameSpeed));
    }
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        onSpeed(this.activeSpeed() === 0 ? this.lastRunSpeed : 0);
      } else if (e.key === "1") onSpeed(1);
      else if (e.key === "2") onSpeed(3);
      else if (e.key === "3") onSpeed(10);
    });
  }

  private lastRunSpeed: GameSpeed = 1;

  private activeSpeed(): GameSpeed {
    const active = this.buttons.find((b) => b.classList.contains("active"));
    return (active ? Number(active.dataset["speed"]) : 1) as GameSpeed;
  }

  syncFromSim(snap: SimSnapshot): void {
    this.clockEl.textContent = `Day ${snap.day} — ${snap.timeString}`;
    if (snap.speed !== 0) this.lastRunSpeed = snap.speed;
    for (const btn of this.buttons) {
      btn.classList.toggle("active", Number(btn.dataset["speed"]) === snap.speed);
    }
  }

  tickFps(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsAt >= 1000) {
      this.fpsEl.textContent = `${this.frames} fps`;
      this.frames = 0;
      this.lastFpsAt = now;
    }
  }
}
