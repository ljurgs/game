import Phaser from "phaser";
import "./style.css";

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;

const DIRECTIONS = [
  { name: "up", x: 0, y: -1 },
  { name: "upRight", x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { name: "right", x: 1, y: 0 },
  { name: "downRight", x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { name: "down", x: 0, y: 1 },
  { name: "downLeft", x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { name: "left", x: -1, y: 0 },
  { name: "upLeft", x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
];

const ROW_MAP_8 = {
  up: 0,
  upRight: 1,
  right: 2,
  downRight: 3,
  down: 4,
  downLeft: 5,
  left: 6,
  upLeft: 7,
};

const snapDirection = (dx, dy) => {
  const mag = Math.hypot(dx, dy);
  if (mag < 0.001) return null;
  const nx = dx / mag;
  const ny = dy / mag;
  let best = null;
  let bestDot = -Infinity;
  for (const dir of DIRECTIONS) {
    const dot = dir.x * nx + dir.y * ny;
    if (dot > bestDot) {
      bestDot = dot;
      best = dir;
    }
  }
  return best;
};

class MobileObject {
  constructor(scene, spriteKey, frame, scale, rowMap = ROW_MAP_8) {
    this.scene = scene;
    this.sprite = scene.add.sprite(0, 0, spriteKey, frame);
    this.sprite.setScale(scale);
    this.sprite.setOrigin(0.5, 0.5);

    this.displayDir = null;
    this.rowMap = rowMap;
    this.pathSegments = [];
    this.speed = 0;
    this.pathTarget = null;
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  setDirection(snapped) {
    if (!snapped) return false;
    const changed = !this.displayDir || this.displayDir.name !== snapped.name;
    this.displayDir = snapped;
    return changed;
  }

  resetDirection() {
    this.displayDir = null;
  }

  clearPath() {
    this.pathSegments = [];
    this.pathTarget = null;
  }

  // Builds a 2-leg 45-degree path from the current position to the target:
  // first a diagonal leg (if needed), then an axis-aligned leg for the remainder.
  buildPathTo(targetX, targetY) {
    const segments = [];
    const startX = this.sprite.x;
    const startY = this.sprite.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const sign = (v) => (v >= 0 ? 1 : -1);

    let cx = startX;
    let cy = startY;
    const diag = Math.min(Math.abs(dx), Math.abs(dy));
    if (diag > 0) {
      const dir = snapDirection(sign(dx), sign(dy));
      cx += sign(dx) * diag;
      cy += sign(dy) * diag;
      segments.push({ x: cx, y: cy, dir });
    }

    const remX = Math.abs(dx) - diag;
    const remY = Math.abs(dy) - diag;
    if (remX > 0) {
      const dir = snapDirection(sign(dx), 0);
      cx += sign(dx) * remX;
      segments.push({ x: cx, y: cy, dir });
    } else if (remY > 0) {
      const dir = snapDirection(0, sign(dy));
      cy += sign(dy) * remY;
      segments.push({ x: cx, y: cy, dir });
    }

    return segments;
  }

  setPathTo(targetX, targetY) {
    this.pathTarget = { x: targetX, y: targetY };
    this.pathSegments = this.buildPathTo(targetX, targetY);
  }

  // Advance along the current path segments using the object's speed.
  advancePath(dtMs) {
    if (!this.pathSegments.length) return false;
    const seg = this.pathSegments[0];
    const dx = seg.x - this.sprite.x;
    const dy = seg.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const snapped = seg.dir || snapDirection(dx, dy);
    if (!snapped) {
      this.pathSegments.shift();
      return false;
    }

    this.setDirection(snapped);
    const step = (this.speed * dtMs) / 1000;
    if (dist <= step) {
      this.sprite.x = seg.x;
      this.sprite.y = seg.y;
      this.pathSegments.shift();
    } else {
      this.sprite.x += snapped.x * step;
      this.sprite.y += snapped.y * step;
    }
    if (!this.pathSegments.length) {
      this.pathTarget = null;
    }
    return true;
  }

  clampToWorld() {
    const halfW = (this.sprite.width * this.sprite.scaleX) / 2;
    const halfH = (this.sprite.height * this.sprite.scaleY) / 2;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, halfW, WORLD_WIDTH - halfW);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, halfH, WORLD_HEIGHT - halfH);
  }

  setFacingFrame(name) {
    const map = this.rowMap || ROW_MAP_8;
    this.sprite.setFrame(map[name] ?? map.down ?? 0);
  }
}

class Character extends MobileObject {
  constructor(scene, x, y) {
    super(scene, "hero", 4, 0.5);
    this.setPosition(x, y);

    this.speed = 120;
    this.displayDir = { name: "down", x: 0, y: 1 };
  }

  update(dtMs, inputState) {
    const dt = dtMs / 1000;
    const dir = { x: 0, y: 0 };

    if (inputState.keys.w.isDown) dir.y -= 1;
    if (inputState.keys.s.isDown) dir.y += 1;
    if (inputState.keys.a.isDown) dir.x -= 1;
    if (inputState.keys.d.isDown) dir.x += 1;

    const usingKeys = dir.x !== 0 || dir.y !== 0;

    if (usingKeys) {
      // Manual keyboard movement overrides any queued path
      this.clearPath();
      const snapped = snapDirection(dir.x, dir.y);
      if (snapped) {
        this.sprite.x += snapped.x * this.speed * dt;
        this.sprite.y += snapped.y * this.speed * dt;
        this.setDirection(snapped);
      }
    } else {
      // Follow queued path segments (from mouse clicks)
      this.advancePath(dtMs);
    }

    this.clampToWorld();

    // Set frame by facing (8-way sheet)
    const facing = this.displayDir || { name: "down", x: 0, y: 1 };
    this.setFacingFrame(facing.name);

  }
}

class Cat extends MobileObject {
  constructor(scene, x, y) {
    super(scene, "cat", 4, 0.5);
    this.setPosition(x, y);
    this.speed = 50;
    this.idleTime = 0;
    this.margin = 50;
    this.minLegDist = 80;
  }

  update(dtMs) {
    // If we have a path, follow it. When done, start a new idle cycle.
    if (this.pathSegments.length) {
      this.advancePath(dtMs);
      if (!this.pathSegments.length) {
        this.idleTime = 1000 + Math.random() * 2000;
      }
    } else {
      // Idle countdown before picking a new random target
      this.idleTime -= dtMs;
      if (this.idleTime <= 0) {
        const target = this.pickRandomTarget();
        if (target) {
          this.setPathTo(target.x, target.y);
        } else {
          this.idleTime = 500; // retry soon if we failed to find space
        }
      }
    }

    this.clampToWorld();

    // Face using sheet rows
    const face = this.displayDir ? this.displayDir.name : "down";
    this.setFacingFrame(face);
  }

  // Choose a random point within margins and a minimum travel distance
  pickRandomTarget() {
    for (let i = 0; i < 8; i++) {
      const tx = this.margin + Math.random() * (WORLD_WIDTH - 2 * this.margin);
      const ty = this.margin + Math.random() * (WORLD_HEIGHT - 2 * this.margin);
      const dist = Math.hypot(tx - this.sprite.x, ty - this.sprite.y);
      if (dist >= this.minLegDist) {
        return { x: tx, y: ty };
      }
    }
    return null;
  }
}

class PlayScene extends Phaser.Scene {
  constructor() {
    super("play");
  }

  preload() {
    this.load.spritesheet("hero", "/assets/sprites/sheet_f_hair_1.png", { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet("cat", "/assets/sprites/sheet_cat_black.png", { frameWidth: 128, frameHeight: 128 });
  }

  create() {
    this.cameras.main.setBackgroundColor("#241725");
    this.cameras.main.setRoundPixels(true);

    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.character = new Character(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.cat = new Cat(
      this,
      Phaser.Math.Between(100, WORLD_WIDTH - 100),
      Phaser.Math.Between(100, WORLD_HEIGHT - 100)
    );

    // Mouse clicks: build a 2-leg 45° path to the click for the character
    this.input.on("pointerdown", (pointer) => {
      const worldPoint = pointer.positionToCamera(this.cameras.main);
      this.character.setPathTo(worldPoint.x, worldPoint.y);
    });
  }

  update(_time, delta) {
    this.character.update(delta, { keys: this.keys });
    this.cat.update(delta);

    // Simple circle collision pushback
    const dx = this.character.sprite.x - this.cat.sprite.x;
    const dy = this.character.sprite.y - this.cat.sprite.y;
    const dist = Math.hypot(dx, dy);
    const r1 = (this.character.sprite.width * this.character.sprite.scaleX) * 0.25;
    const r2 = (this.cat.sprite.width * this.cat.sprite.scaleX) * 0.25;
    const minDist = r1 + r2;
    if (dist > 0 && dist < minDist) {
      const push = minDist - dist;
      const angle = Math.atan2(dy, dx);
      this.character.sprite.x += Math.cos(angle) * push;
      this.character.sprite.y += Math.sin(angle) * push;
      // Rebuild the character's path from its new position so clicks stay accurate
      if (this.character.pathTarget) {
        this.character.setPathTo(this.character.pathTarget.x, this.character.pathTarget.y);
      }
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  parent: "game-container",
  backgroundColor: "#241725",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },
  scene: [PlayScene],
};

new Phaser.Game(config);
