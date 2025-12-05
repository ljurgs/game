# Clara's Game - Gemini Assisted Development

This project is a Phaser 3 pixel-art prototype featuring Clara's art, 8-directional movement, autonomous NPCs, and click-to-move pathfinding.

## Recent Changes (Assisted by Gemini)

-   **Rebranding:** Renamed project to "Clara's Game" with updated credits and titles.
-   **Documentation:** Added `README.md` for project overview and setup, and `AGENTS.md` for automation guidelines.
-   **Phaser Migration:** Ported the entire game loop and rendering to Phaser 3 (v3.90.0).
-   **Movement System:** Implemented `MobileObject` base class handling 8-way facing, world clamping, and 2-leg pathfinding (diagonal + axis-aligned).
-   **Sprite Logic:** Standardized on 128x128 8-row sprite sheets for both Character and Cat.
-   **Build Optimization:** Configured Vite to split `phaser` into a separate manual chunk.
-   **Collision & Recovery:** Character now recalculates their path target after being pushed by collision.
