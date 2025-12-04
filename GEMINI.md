# Pixel Sprite Playground - Gemini Assisted Development

This project is a simple pixel sprite playground built with vanilla JavaScript, HTML, and CSS. It features a main character that can be controlled with WASD or mouse clicks, and a recently added autonomous cat NPC.

## Recent Changes (Assisted by Gemini)

-   **Autonomous Cat NPC:** Implemented a `Cat` class that loads `cat_black.png`. The cat moves randomly around the screen, displaying directional sprites, and has idle periods.
-   **Y-Sorting:** Added Y-sorting to the game loop to ensure characters and other objects are drawn in the correct order, creating a pseudo-3D depth effect.
-   **Sprite Direction Correction:** Fixed the directional sprite mapping for the cat to ensure up and down sprites are displayed correctly.
-   **Character and Arrow Scaling:** Adjusted the scaling factors for the main `Character` sprite to `1.5` and its movement arrows to `0.75` for improved visual balance.
-   **Collision Detection:** Implemented basic circular collision detection and resolution between the main character and the cat NPC, preventing them from overlapping.