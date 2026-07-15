/**
 * Radial "pie" menu for object interactions (U-104): DOM bubbles arranged in
 * a circle around the click point, one per interaction. Plain DOM like the
 * M0 Hud/toasts; styles live in index.html (.pie-option). Dismissed by
 * picking an option, clicking anywhere else, Escape, or opening another menu.
 */

/** One pickable bubble: interaction id + display label. */
export interface PieOption {
  id: string;
  label: string;
}

/** Ring radius in px for n bubbles (single bubble sits on the click point). */
const ringRadius = (n: number): number => (n <= 1 ? 0 : 72 + Math.max(0, n - 4) * 16);

/** Keep bubbles at least this far from the viewport edge. */
const EDGE_MARGIN = 8;

/**
 * Display name for an interaction. Content names may be raw strings or
 * "@str:..." refs; refs (or anything still id-shaped) fall back to
 * title-casing the last id segment, e.g. "fridge.have_meal" → "Have Meal".
 */
export function prettifyInteractionName(name: string): string {
  const raw = name.startsWith("@str:") ? name.slice("@str:".length) : name;
  if (!raw.includes(".") && !raw.includes("_")) return raw;
  const last = raw.split(".").at(-1)!;
  return last
    .split("_")
    .filter((w) => w.length > 0)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export class PieMenu {
  private host = document.getElementById("pie-menu")!;
  private swallowClick = false;

  constructor() {
    // Capture-phase so a click anywhere outside the bubbles dismisses the
    // menu before anything else (camera, HUD) reacts to it.
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.isOpen) return;
        if (e.target instanceof Node && this.host.contains(e.target)) return;
        this.dismiss();
        // The gesture that dismissed the menu must not also walk/interact.
        // Cleared again on pointerup in case it turns into a camera drag
        // (then no click callback ever consumes it).
        this.swallowClick = true;
        window.addEventListener("pointerup", () => (this.swallowClick = false), { once: true });
      },
      true,
    );
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.dismiss();
    });
  }

  get isOpen(): boolean {
    return this.host.childElementCount > 0;
  }

  /**
   * True exactly once for the canvas click that dismissed the menu; callers
   * (tile-click handler) use this to swallow that click instead of walking.
   */
  consumeSwallowedClick(): boolean {
    const swallow = this.swallowClick;
    this.swallowClick = false;
    return swallow;
  }

  /** Open at screen (x, y). Replaces any menu already open. */
  open(x: number, y: number, options: PieOption[], onPick: (interactionId: string) => void): void {
    this.dismiss();
    const bubbles = options.map((opt) => {
      const btn = document.createElement("button");
      btn.className = "pie-option";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        this.dismiss();
        onPick(opt.id);
      });
      return btn;
    });
    this.layout(x, y, bubbles);
  }

  /** Single disabled bubble for objects with no interactions. */
  openEmpty(x: number, y: number): void {
    this.dismiss();
    const bubble = document.createElement("button");
    bubble.className = "pie-option pie-disabled";
    bubble.textContent = "Nothing to do here";
    bubble.addEventListener("click", () => this.dismiss());
    this.layout(x, y, [bubble]);
  }

  dismiss(): void {
    this.host.replaceChildren();
  }

  /** Place bubbles on a ring around (x, y), then clamp the ring on-screen. */
  private layout(x: number, y: number, bubbles: HTMLElement[]): void {
    const r = ringRadius(bubbles.length);
    bubbles.forEach((el, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / bubbles.length; // first at 12 o'clock
      el.style.left = `${x + r * Math.cos(angle)}px`;
      el.style.top = `${y + r * Math.sin(angle)}px`;
      this.host.appendChild(el);
    });

    // Bubbles are centered via translate(-50%,-50%); offsetWidth/Height give
    // the untransformed layout size, so the scale-in animation can't skew this.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const el of bubbles) {
      const cx = parseFloat(el.style.left);
      const cy = parseFloat(el.style.top);
      minX = Math.min(minX, cx - el.offsetWidth / 2);
      maxX = Math.max(maxX, cx + el.offsetWidth / 2);
      minY = Math.min(minY, cy - el.offsetHeight / 2);
      maxY = Math.max(maxY, cy + el.offsetHeight / 2);
    }
    let dx = 0;
    let dy = 0;
    if (minX < EDGE_MARGIN) dx = EDGE_MARGIN - minX;
    else if (maxX > window.innerWidth - EDGE_MARGIN) dx = window.innerWidth - EDGE_MARGIN - maxX;
    if (minY < EDGE_MARGIN) dy = EDGE_MARGIN - minY;
    else if (maxY > window.innerHeight - EDGE_MARGIN) dy = window.innerHeight - EDGE_MARGIN - maxY;
    if (dx !== 0 || dy !== 0) {
      for (const el of bubbles) {
        el.style.left = `${parseFloat(el.style.left) + dx}px`;
        el.style.top = `${parseFloat(el.style.top) + dy}px`;
      }
    }
  }
}
