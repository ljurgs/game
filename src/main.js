import "./style.css";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const viewport = document.querySelector(".viewport");

const resizeCanvas = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetRatio = 16 / 9;
  let w = vw;
  let h = Math.floor(vw / targetRatio);
  if (h > vh) {
    h = vh;
    w = Math.floor(vh * targetRatio);
  }
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.imageSmoothingEnabled = false;
  }
};

const input = {
  keys: {},
  target: null,
};

const DIRECTIONS = [
  { name: "right", x: 1, y: 0 },
  { name: "upRight", x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { name: "up", x: 0, y: -1 },
  { name: "upLeft", x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { name: "left", x: -1, y: 0 },
  { name: "downLeft", x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { name: "down", x: 0, y: 1 },
  { name: "downRight", x: Math.SQRT1_2, y: Math.SQRT1_2 },
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

const HYSTERESIS_DOT = 0.97; // require larger change before switching snapped direction

const facingFromVector = (dx, dy) => {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return "up";
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
};

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (["w", "a", "s", "d"].includes(key)) {
    input.keys[key] = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (["w", "a", "s", "d"].includes(key)) {
    input.keys[key] = false;
    e.preventDefault();
  }
});

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  input.target = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
});

class Character {
  constructor(image, arrowImage) {
    this.image = image;
    this.arrowImage = arrowImage;
    this.columns = 1;
    this.rows = 4;
    this.frameWidth = image.width / this.columns;
    this.frameHeight = image.height / this.rows;
    this.totalFrames = this.columns * this.rows;

    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.speed = 120; // pixels per second
    this.scale = 2.5;

    // Column layout rows: 0=down,1=left,2=right,3=up
    this.frameIndex = 0;
    this.moving = false;
    this.displayDir = { name: "down", x: 0, y: 1 };
    this.pendingDir = null;
    this.pendingTimerMs = 0;
    this.pendingWaitMs = 120;
    this.indicatorTimerMs = 0;
    this.indicatorDurationMs = 250;

    this.arrowColumns = 1;
    this.arrowRows = 4;
    this.arrowFrameWidth = arrowImage.width / this.arrowColumns;
    this.arrowFrameHeight = arrowImage.height / this.arrowRows;
    this.arrowScale = 1.6;
  }

  update(dtMs, inputState) {
    const dt = dtMs / 1000;
    const dir = { x: 0, y: 0 };
    let moveDir = null;

    if (inputState.keys.w) dir.y -= 1;
    if (inputState.keys.s) dir.y += 1;
    if (inputState.keys.a) dir.x -= 1;
    if (inputState.keys.d) dir.x += 1;

    const usingKeys = dir.x !== 0 || dir.y !== 0;

    if (usingKeys) {
      inputState.target = null; // keyboard takes control from click
      const snapped = snapDirection(dir.x, dir.y);
      if (snapped) {
        this.x += snapped.x * this.speed * dt;
        this.y += snapped.y * this.speed * dt;
        dir.x = snapped.x;
        dir.y = snapped.y;
        dir.name = snapped.name;
        moveDir = snapped;
      }
    } else if (inputState.target) {
      const dx = inputState.target.x - this.x;
      const dy = inputState.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        inputState.target = null;
      } else {
        const snapped = snapDirection(dx, dy);
        if (snapped) {
          const step = this.speed * dt;
          if (dist <= step) {
            this.x = inputState.target.x;
            this.y = inputState.target.y;
            inputState.target = null;
          } else {
            this.x += snapped.x * step;
            this.y += snapped.y * step;
          }
          dir.x = snapped.x;
          dir.y = snapped.y;
          dir.name = snapped.name;
          moveDir = snapped;
        }
      }
    }

    this.moving = usingKeys || Boolean(inputState.target);

    if (moveDir) {
      const current = this.displayDir;
      const dot = current ? moveDir.x * current.x + moveDir.y * current.y : -1;
      if (!current || dot < HYSTERESIS_DOT) {
        const pendDot = this.pendingDir ? (moveDir.x * this.pendingDir.x + moveDir.y * this.pendingDir.y) : -1;
        if (!this.pendingDir || pendDot < HYSTERESIS_DOT) {
          this.pendingDir = { name: moveDir.name, x: moveDir.x, y: moveDir.y };
          this.pendingTimerMs = this.pendingWaitMs;
        } else {
          // same pending direction; keep timer
        }
      } else {
        // movement close to current display dir; clear pending
        this.pendingDir = null;
        this.pendingTimerMs = 0;
      }
    } else {
      this.pendingDir = null;
      this.pendingTimerMs = 0;
    }

    if (this.pendingDir) {
      this.pendingTimerMs -= dtMs;
      if (this.pendingTimerMs <= 0) {
        this.displayDir = { ...this.pendingDir };
        this.pendingDir = null;
        this.indicatorTimerMs = this.indicatorDurationMs;
      }
    }

    const facing = facingFromVector(this.displayDir.x, this.displayDir.y);
    const charIndex = { down: 0, left: 1, right: 2, up: 3 }[facing];
    this.frameIndex = charIndex ?? this.frameIndex;

    // Clamp to canvas bounds
    this.x = Math.max(this.frameWidth * this.scale / 2, Math.min(canvas.width - this.frameWidth * this.scale / 2, this.x));
    this.y = Math.max(this.frameHeight * this.scale / 2, Math.min(canvas.height - this.frameHeight * this.scale / 2, this.y));

    if (this.indicatorTimerMs > 0) {
      this.indicatorTimerMs = Math.max(0, this.indicatorTimerMs - dtMs);
    }
  }

  draw(context) {
    const col = this.frameIndex % this.columns;
    const row = Math.floor(this.frameIndex / this.columns);
    const sx = col * this.frameWidth;
    const sy = row * this.frameHeight;
    const drawWidth = this.frameWidth * this.scale;
    const drawHeight = this.frameHeight * this.scale;

    context.drawImage(
      this.image,
      sx,
      sy,
      this.frameWidth,
      this.frameHeight,
      this.x - drawWidth / 2,
      this.y - drawHeight / 2,
      drawWidth,
      drawHeight
    );

    if (this.indicatorTimerMs > 0) {
      const drawArrow = (dirName, vec) => {
        const row = { down: 0, left: 1, right: 2, up: 3 }[dirName];
        if (row === undefined) return;
        const sx = 0;
        const sy = row * this.arrowFrameHeight;
        const drawW = this.arrowFrameWidth * this.arrowScale;
        const drawH = this.arrowFrameHeight * this.arrowScale;
        const mag = Math.hypot(vec.x, vec.y) || 1;
        const offset = (this.frameHeight * this.scale) / 2 + (drawH / 2) + 6;
        const ox = (vec.x / mag) * offset;
        const oy = (vec.y / mag) * offset;

        context.drawImage(
          this.arrowImage,
          sx,
          sy,
          this.arrowFrameWidth,
          this.arrowFrameHeight,
          this.x - drawW / 2 + ox,
          this.y - drawH / 2 + oy,
          drawW,
          drawH
        );
      };

      const vec = this.displayDir || { x: 1, y: 0 };
      if (Math.abs(vec.x) > 0.001 && Math.abs(vec.y) > 0.001) {
        // diagonal: draw both axis arrows
        const dirs = [];
        dirs.push(vec.y > 0 ? "down" : "up");
        dirs.push(vec.x > 0 ? "right" : "left");
        dirs.forEach((name) => {
          const v = name === "up" ? { x: 0, y: -1 }
            : name === "down" ? { x: 0, y: 1 }
            : name === "left" ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
          drawArrow(name, v);
        });
      } else {
        const name = Math.abs(vec.y) > Math.abs(vec.x)
          ? (vec.y > 0 ? "down" : "up")
          : (vec.x > 0 ? "right" : "left");
        drawArrow(name, vec);
      }
    }
  }
}

function start() {
  resizeCanvas();
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  Promise.all([
    loadImage("/assets/sprites/sheet_f_hair_1.png"),
    loadImage("/assets/sprites/arrow_dir_green.png"),
  ]).then(([sprite, arrow]) => {
    const hero = new Character(sprite, arrow);
    let lastTime = performance.now();

    function loop(now) {
      const delta = now - lastTime;
      lastTime = now;

      ctx.fillStyle = "#241725";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      hero.update(delta, input);
      hero.draw(ctx);

      requestAnimationFrame(loop);
    }

    loop(lastTime);
  }).catch((err) => console.error("Failed to load sprites", err));
}

start();
window.addEventListener("resize", resizeCanvas);
