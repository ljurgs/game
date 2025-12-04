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
  constructor(scene, spriteKey, frame, scale) {
    this.scene = scene;
    this.sprite = scene.add.sprite(0, 0, spriteKey, frame);
    this.sprite.setScale(scale);
    this.sprite.setOrigin(0.5, 0.5);

    this.displayDir = null;
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

  clampToWorld() {
    const halfW = (this.sprite.width * this.sprite.scaleX) / 2;
    const halfH = (this.sprite.height * this.sprite.scaleY) / 2;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, halfW, WORLD_WIDTH - halfW);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, halfH, WORLD_HEIGHT - halfH);
  }
}

class Character extends MobileObject {
  constructor(scene, x, y) {
    super(scene, "hero", 0, 1.5);
    this.setPosition(x, y);

    this.speed = 120;
    this.displayDir = { name: "down", x: 0, y: 1 };
  }

  update(dtMs, inputState) {
    const dt = dtMs / 1000;
    const dir = { x: 0, y: 0 };
    let moveDir = null;

    if (inputState.keys.w.isDown) dir.y -= 1;
    if (inputState.keys.s.isDown) dir.y += 1;
    if (inputState.keys.a.isDown) dir.x -= 1;
    if (inputState.keys.d.isDown) dir.x += 1;

    const usingKeys = dir.x !== 0 || dir.y !== 0;

    if (usingKeys) {
      inputState.clearPointer();
      const snapped = snapDirection(dir.x, dir.y);
      if (snapped) {
        this.sprite.x += snapped.x * this.speed * dt;
        this.sprite.y += snapped.y * this.speed * dt;
        moveDir = snapped;
      }
    } else if (inputState.pointer) {
      const currentSegment = inputState.pointer.segments[0];
      if (!currentSegment) {
        inputState.clearPointer();
        return;
      }
      const dx = currentSegment.x - this.sprite.x;
      const dy = currentSegment.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        inputState.pointer.segments.shift();
        if (inputState.pointer.segments.length === 0) {
          inputState.clearPointer();
        }
      } else {
        const snapped = currentSegment.dir;
        const step = this.speed * dt;
        if (dist <= step) {
          this.sprite.x = currentSegment.x;
          this.sprite.y = currentSegment.y;
          inputState.pointer.segments.shift();
          if (inputState.pointer.segments.length === 0) {
            inputState.clearPointer();
          }
        } else {
          this.sprite.x += snapped.x * step;
          this.sprite.y += snapped.y * step;
        }
        moveDir = snapped;
      }
    }

    const changed = moveDir ? this.setDirection(moveDir) : false;

    this.clampToWorld();

    // Set frame by facing
    const facing = this.displayDir || { name: "down", x: 0, y: 1 };
    const rowIndex =
      facing.name === "down"
        ? 0
        : facing.name === "left"
        ? 1
        : facing.name === "right"
        ? 2
        : 3;
    this.sprite.setFrame(rowIndex);

  }
}

class Cat extends MobileObject {
  constructor(scene, x, y) {
    super(scene, "cat", 4, 0.5);
    this.setPosition(x, y);
    this.speed = 50;
    this.target = null;
    this.idleTime = 0;
    this.margin = 50;
    this.minLegDist = 80;
  }

  update(dtMs) {
    const dt = dtMs / 1000;

    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 5) {
        this.target = null;
        this.idleTime = 1000 + Math.random() * 2000;
        this.resetDirection();
      } else {
        const snapped = snapDirection(dx, dy);
        if (snapped) {
          this.setDirection(snapped);

          const moveVec = this.displayDir || snapped;
          const moveDist = this.speed * dt;
          if (dist <= moveDist) {
            this.sprite.x = this.target.x;
            this.sprite.y = this.target.y;
            this.target = null;
            this.idleTime = 1000 + Math.random() * 2000;
            this.resetDirection();
          } else {
            this.sprite.x += moveVec.x * moveDist;
            this.sprite.y += moveVec.y * moveDist;
          }
        }
      }
    } else {
      this.idleTime -= dtMs;
      if (this.idleTime <= 0) {
        const pickTarget = () => {
          for (let i = 0; i < 8; i++) {
            const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
            const maxX =
              dir.x > 0
                ? (WORLD_WIDTH - this.margin - this.sprite.x) / dir.x
                : dir.x < 0
                ? (this.margin - this.sprite.x) / dir.x
                : Infinity;
            const maxY =
              dir.y > 0
                ? (WORLD_HEIGHT - this.margin - this.sprite.y) / dir.y
                : dir.y < 0
                ? (this.margin - this.sprite.y) / dir.y
                : Infinity;
            const maxDist = Math.min(Number.isFinite(maxX) ? maxX : Infinity, Number.isFinite(maxY) ? maxY : Infinity);
            if (maxDist > this.minLegDist) {
              const dist = this.minLegDist + Math.random() * (maxDist - this.minLegDist);
              return { x: this.sprite.x + dir.x * dist, y: this.sprite.y + dir.y * dist };
            }
          }
          return null;
        };

        this.target = pickTarget();
        this.idleTime = this.target ? 0 : 500;
      }
    }

    this.clampToWorld();

    // Face using sheet rows
    const rowMap = {
      up: 0,
      upRight: 1,
      right: 2,
      downRight: 3,
      down: 4,
      downLeft: 5,
      left: 6,
      upLeft: 7,
    };
    const face = this.displayDir ? this.displayDir.name : "down";
    this.sprite.setFrame(rowMap[face] ?? rowMap.down);
  }
}

class PlayScene extends Phaser.Scene {
  constructor() {
    super("play");
  }

  preload() {
    this.load.spritesheet("hero", "/assets/sprites/sheet_f_hair_1.png", { frameWidth: 32, frameHeight: 32 });
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

    this.pointerTarget = null;
    this.input.on("pointerdown", (pointer) => {
      const worldPoint = pointer.positionToCamera(this.cameras.main);
      const startX = this.character.sprite.x;
      const startY = this.character.sprite.y;
      const dx = worldPoint.x - startX;
      const dy = worldPoint.y - startY;

      const sign = (v) => (v >= 0 ? 1 : -1);
      const segments = [];
      let cx = startX;
      let cy = startY;

      const diagAxis = Math.min(Math.abs(dx), Math.abs(dy));
      if (diagAxis > 0) {
        const dir = snapDirection(sign(dx), sign(dy));
        cx += sign(dx) * diagAxis;
        cy += sign(dy) * diagAxis;
        segments.push({ x: cx, y: cy, dir });
      }

      const remX = Math.abs(dx) - diagAxis;
      const remY = Math.abs(dy) - diagAxis;
      if (remX > 0) {
        const dir = snapDirection(sign(dx), 0);
        cx += sign(dx) * remX;
        segments.push({ x: cx, y: cy, dir });
      } else if (remY > 0) {
        const dir = snapDirection(0, sign(dy));
        cy += sign(dy) * remY;
        segments.push({ x: cx, y: cy, dir });
      }

      if (segments.length === 0) return;
      this.pointerTarget = { segments };
    });
  }

  update(_time, delta) {
    const clearPointer = () => {
      this.pointerTarget = null;
    };

    this.character.update(delta, { keys: this.keys, pointer: this.pointerTarget, clearPointer });
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
