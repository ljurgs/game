import Phaser from "phaser";
import "./style.css";

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const HYSTERESIS_DOT = 0.97;

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
    this.pendingDir = null;
    this.pendingTimerMs = 0;
    this.pendingWaitMs = 120;
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  updateDirection(snapped, dtMs) {
    let changed = false;
    if (!snapped) {
      this.pendingDir = null;
      this.pendingTimerMs = 0;
      return false;
    }

    if (!this.displayDir) {
      this.displayDir = snapped;
      return true;
    }

    const dot = this.displayDir.x * snapped.x + this.displayDir.y * snapped.y;
    if (dot < HYSTERESIS_DOT) {
      if (!this.pendingDir || this.pendingDir.name !== snapped.name) {
        this.pendingDir = snapped;
        this.pendingTimerMs = this.pendingWaitMs;
      } else {
        this.pendingTimerMs -= dtMs;
        if (this.pendingTimerMs <= 0) {
          this.displayDir = this.pendingDir;
          this.pendingDir = null;
          this.pendingTimerMs = 0;
          changed = true;
        }
      }
    } else {
      this.pendingDir = null;
      this.pendingTimerMs = 0;
    }

    return changed;
  }

  resetDirection() {
    this.displayDir = null;
    this.pendingDir = null;
    this.pendingTimerMs = 0;
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

    this.arrow = scene.add.sprite(x, y, "arrow", 0);
    this.arrow.setOrigin(0.5, 0.5);
    this.arrow.setScale(0.8);
    this.arrow.setVisible(false);
    this.arrowTimerMs = 0;
    this.arrowDurationMs = 250;
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
      const dx = inputState.pointer.x - this.sprite.x;
      const dy = inputState.pointer.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        inputState.clearPointer();
      } else {
        const snapped = snapDirection(dx, dy);
        if (snapped) {
          const step = this.speed * dt;
          if (dist <= step) {
            this.sprite.x = inputState.pointer.x;
            this.sprite.y = inputState.pointer.y;
            inputState.clearPointer();
          } else {
            this.sprite.x += snapped.x * step;
            this.sprite.y += snapped.y * step;
          }
          moveDir = snapped;
        }
      }
    }

    const changed = moveDir ? this.updateDirection(moveDir, dtMs) : false;
    if (changed) {
      this.arrowTimerMs = this.arrowDurationMs;
    }

    if (this.arrowTimerMs > 0) {
      this.arrowTimerMs = Math.max(0, this.arrowTimerMs - dtMs);
    }

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

    // Arrow indicator for direction changes
    if (this.arrowTimerMs > 0) {
      const vec = this.displayDir || { x: 1, y: 0 };
      const arrowRow =
        Math.abs(vec.x) > Math.abs(vec.y)
          ? vec.x > 0
            ? 2
            : 1
          : vec.y > 0
          ? 0
          : 3;
      const offset = (this.sprite.height * this.sprite.scaleY) / 2 + (this.arrow.height * this.arrow.scaleY) / 2 + 6;
      const mag = Math.hypot(vec.x, vec.y) || 1;
      const ox = (vec.x / mag) * offset;
      const oy = (vec.y / mag) * offset;
      this.arrow.setFrame(arrowRow);
      this.arrow.setPosition(Math.round(this.sprite.x + ox), Math.round(this.sprite.y + oy));
      this.arrow.setVisible(true);
    } else {
      this.arrow.setVisible(false);
    }
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
          this.updateDirection(snapped, dtMs);

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
    this.load.spritesheet("arrow", "/assets/sprites/arrow_dir_green.png", { frameWidth: 32, frameHeight: 32 });
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

    this.pointerTarget = null;
    this.input.on("pointerdown", (pointer) => {
      const worldPoint = pointer.positionToCamera(this.cameras.main);
      this.pointerTarget = { x: worldPoint.x, y: worldPoint.y };
    });

    this.character = new Character(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.cat = new Cat(
      this,
      Phaser.Math.Between(100, WORLD_WIDTH - 100),
      Phaser.Math.Between(100, WORLD_HEIGHT - 100)
    );
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
