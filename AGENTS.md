# Agents Guide

This project is now wired for a Phaser-based sprite playground. If you use an automation agent to modify or extend it, keep these expectations in mind:

- **Stay Phaser-first:** Use Phaser 3 APIs for scenes, loading, input, and rendering. Avoid mixing in raw canvas loops.
- **Preserve 8-way sheets:** Sprites use 128x128 sheets with 8 rows (up → upRight → right → downRight → down → downLeft → left → upLeft). Use that map for all `MobileObject` subclasses.
- **Movement is centralized:** `MobileObject` owns speed, facing, world clamping, and two-leg (diag then axis) path generation. Reuse `setPathTo`/`advancePath` instead of reimplementing movement.
- **Collision pushback:** Character path should be rebuilt after displacement (see the collision handler). Don’t remove this unless replacing with a better solution.
- **Bundle split:** `vite.config.js` manually chunks Phaser. Keep that split unless you intentionally change the build strategy.
- **Testing:** Run `npm run build` after changes. Note that Phaser’s vendor chunk triggers Vite’s size warning; that’s expected.

Quick start:
```bash
npm install
npm run dev
# or
npm run build
```
