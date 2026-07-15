import { Container, Graphics, Text } from "pixi.js";
import type { PersonView } from "@homestead/sim";
import { worldToScreen } from "./iso.js";

/**
 * Procedural placeholder character (manifest IDs char.base.*, char.shadow):
 * shadow blob + capsule body + head + facing dot, plus an activity bubble
 * over the head while an interaction runs. Replaced by sprite sheets when
 * final art lands (see docs/ASSET_MANIFEST.md §2).
 */

/** Body tint per failure state (S-104): gray-blue passed out, dark gray dead. */
const STATUS_TINT: Record<PersonView["status"], number> = {
  normal: 0xffffff,
  passedOut: 0x9fb3d1,
  dead: 0x565b66,
};

export class PersonSprite {
  readonly view = new Container();
  private body = new Container();
  private facingDot = new Graphics();
  private bubble = new Container();
  private bubbleBg = new Graphics();
  private bubbleText = new Text({
    text: "",
    style: { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: 12, fill: 0xf2ede4 },
  });
  private walkPhase = 0;

  /** Interpolated display position in world tile coords. */
  dispX = 0;
  dispY = 0;
  /** Latest sim target position. */
  targetX = 0;
  targetY = 0;
  facing: PersonView["facing"] = "se";
  anim: PersonView["anim"] = "idle";
  status: PersonView["status"] = "normal";
  private activity: string | null = null;

  constructor() {
    const shadow = new Graphics();
    shadow.ellipse(0, 0, 14, 7).fill({ color: 0x000000, alpha: 0.28 });
    this.view.addChild(shadow);

    const torso = new Graphics();
    torso.roundRect(-9, -34, 18, 30, 8).fill(0x2f8f83); // teal shirt
    torso.roundRect(-8, -14, 16, 12, 5).fill(0x3a4256); // dark trousers
    this.body.addChild(torso);

    const head = new Graphics();
    head.circle(0, -42, 8).fill(0xe8b98f);
    head.circle(0, -47, 6.5).fill(0x6b4a2f); // hair cap
    this.body.addChild(head);

    this.body.addChild(this.facingDot);
    this.view.addChild(this.body);

    this.bubbleText.anchor.set(0.5);
    this.bubble.addChild(this.bubbleBg, this.bubbleText);
    this.bubble.y = -60;
    this.bubble.visible = false;
    this.view.addChild(this.bubble);
  }

  syncFromSim(p: PersonView): void {
    this.targetX = p.x;
    this.targetY = p.y;
    this.facing = p.facing;
    this.anim = p.anim;

    if (p.status !== this.status) {
      this.status = p.status;
      this.body.tint = STATUS_TINT[p.status];
    }

    if (p.activity !== this.activity) {
      this.activity = p.activity;
      this.bubble.visible = p.activity !== null;
      if (p.activity !== null) {
        this.bubbleText.text = p.activity;
        const w = this.bubbleText.width;
        const h = this.bubbleText.height;
        this.bubbleBg.clear();
        this.bubbleBg
          .roundRect(-w / 2 - 6, -h / 2 - 3, w + 12, h + 6, 7)
          .fill({ color: 0x18222f, alpha: 0.85 });
      }
    }
  }

  /** Called every render frame; dt in seconds. */
  update(dt: number): void {
    // Exponential smoothing toward the latest sim position.
    const k = 1 - Math.exp(-dt * 12);
    this.dispX += (this.targetX - this.dispX) * k;
    this.dispY += (this.targetY - this.dispY) * k;

    const { sx, sy } = worldToScreen(this.dispX, this.dispY);
    this.view.position.set(sx, sy);
    this.view.zIndex = this.dispX + this.dispY;

    // Walk bob.
    if (this.anim === "walk") {
      this.walkPhase += dt * 14;
      this.body.y = Math.abs(Math.sin(this.walkPhase)) * -2.5;
    } else {
      this.walkPhase = 0;
      this.body.y = 0;
    }

    // Facing indicator: small dot on the face side (stand-in until real sheets).
    const off: Record<PersonView["facing"], [number, number]> = {
      se: [5, -41], sw: [-5, -41], ne: [3, -44], nw: [-3, -44],
    };
    const [fx, fy] = off[this.facing];
    this.facingDot.clear();
    this.facingDot.circle(fx, fy, 1.8).fill(this.facing === "ne" || this.facing === "nw" ? 0x6b4a2f : 0x374151);
  }
}
