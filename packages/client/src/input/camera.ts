import type { Container } from "pixi.js";

const ZOOM_LEVELS = [0.5, 1, 2, 3] as const;

/**
 * Camera = transform on the world container.
 * Drag to pan (click-vs-drag disambiguated by a 6 px threshold), wheel to
 * step through fixed zoom levels, arrow keys / WASD to pan.
 */
export class CameraController {
  private zoomIndex = 1;
  private dragging = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private keys = new Set<string>();

  constructor(
    private world: Container,
    private canvas: HTMLCanvasElement,
    private onClick: (screenX: number, screenY: number) => void,
  ) {
    canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.moved = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (Math.abs(e.clientX - this.lastX) + Math.abs(e.clientY - this.lastY) > 0) {
        if (!this.moved && Math.hypot(dx, dy) < 6) return; // not yet a drag
        this.moved = true;
        this.world.x += dx;
        this.world.y += dy;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (this.dragging && !this.moved) this.onClick(e.clientX, e.clientY);
      this.dragging = false;
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setZoomIndex(this.zoomIndex + (e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener("keydown", (e) => this.keys.add(e.key));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key));
  }

  private setZoomIndex(i: number, pivotX: number, pivotY: number): void {
    const clamped = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, i));
    if (clamped === this.zoomIndex) return;
    const before = ZOOM_LEVELS[this.zoomIndex]!;
    const after = ZOOM_LEVELS[clamped]!;
    // Keep the point under the cursor fixed while zooming.
    const worldPx = (pivotX - this.world.x) / before;
    const worldPy = (pivotY - this.world.y) / before;
    this.world.scale.set(after);
    this.world.x = pivotX - worldPx * after;
    this.world.y = pivotY - worldPy * after;
    this.zoomIndex = clamped;
  }

  get scale(): number {
    return ZOOM_LEVELS[this.zoomIndex]!;
  }

  /** Screen px → world-container-local px. */
  toWorldPx(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.world.x) / this.scale,
      y: (screenY - this.world.y) / this.scale,
    };
  }

  update(dt: number): void {
    const px = 600 * dt;
    if (this.keys.has("ArrowLeft") || this.keys.has("a")) this.world.x += px;
    if (this.keys.has("ArrowRight") || this.keys.has("d")) this.world.x -= px;
    if (this.keys.has("ArrowUp") || this.keys.has("w")) this.world.y += px;
    if (this.keys.has("ArrowDown") || this.keys.has("s")) this.world.y -= px;
  }
}
