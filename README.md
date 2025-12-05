# Clara's Game

All art created by Clara, bringing a world from her imagination to life on a screen!

# Credits

Art: Clara
Gameplay: Clara
Coding: Luke w/AI agent assistance


## Features

*   **8-Directional Movement:** Smooth movement with directional snapping for both the player and NPCs.
*   **Pathfinding:** Click-to-move functionality with smart path generation (2-leg 45-degree paths) for natural movement.
*   **Autonomous NPCs:** An autonomous cat that wanders the map, idles, and interacts with the player via collision.
*   **Depth Sorting:** Real-time Y-sorting to ensure correct sprite layering (pseudo-3D effect).
*   **Responsive Viewport:** 16:9 scaled pixel-art viewport that fits the browser window.

## Controls

*   **WASD:** Move the main character (overrides mouse movement).
*   **Mouse Click:** Move the main character to the clicked location.

## Getting Started

### Prerequisites

*   Node.js (v14+ recommended)
*   npm

### Installation

1.  Clone the repository (if applicable).
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Game

Start the development server:
```bash
npm run dev
```
Open your browser to the URL shown (usually `http://localhost:5173`).

### Building for Production

Build the assets for deployment:
```bash
npm run build
```

## Assets

*   **Character:** `sheet_f_hair_1.png` (128x128 frames)
*   **NPC:** `sheet_cat_black.png` (128x128 frames)

## License

This project is for educational and personal use.
