Create a minimal, standalone HTML5 Canvas sandbox (single `index.html` file using vanilla JavaScript) to test oblique/cabinet 2.5D sprite stacking on a standard orthogonal square grid (similar to Ultima VI and Tibia). 

Do NOT implement a 45-degree diamond isometric grid. The grid must remain strictly horizontal/vertical (x, y).

### 1. Grid & Coordinates Specifications
- World Grid: Standard orthogonal square grid, tile size `64x64` pixels.
- Dimensions: 15 columns x 12 rows.
- Draw alternating subtle grid tiles (e.g., light gray / darker gray floor pattern) with thin grid line toggles so alignment is obvious.

### 2. Entity & Stacking Rules
- Footprint / Hitbox: Entities occupy integer tile positions `(tileX, tileY)` representing a `64x64` foot area on the ground.
- Overlap & Height: 
  - Sprites can be taller than the 64px ground tile (e.g., `64x96`, `128x128`, or custom dimensions).
  - The sprite anchor (registration point) MUST be bottom-center: `anchorX = spriteWidth / 2`, `anchorY = spriteHeight`.
  - World placement formula:
    `screenX = tileX * 64 + 32 - anchorX`
    `screenY = tileY * 64 + 64 - anchorY`
  - This guarantees the sprite's feet sit flush in its ground tile while the body naturally extends upward into the tile row above it.
- Render Depth Sorting (Y-Sorting):
  - Every frame, sort all renderable entities by their bottom foot position (`tileY * 64 + 64`).
  - Render strictly from lowest Y to highest Y so characters in front naturally occlude characters or props behind them.

### 3. Test Entities to Provide
Include three mock renderables out of the box (with placeholders if an image fails to load, plus an image loader to test custom assets):
1. Background Wall/Tree Prop: Footprint 1x1 tile (`64x64`), sprite height `64x128` (2 tiles tall).
2. Player Character: 
   - Supports 4-directional walking (`down`, `right`, `up`, `left`) using WASD or Arrow keys.
   - Smooth pixel movement across tile boundaries with collision against occupied prop tiles.
   - Accepts a sprite sheet or animated frame series based on bottom-center anchoring.
3. Second Static NPC / Dummy: Placed directly 1 tile south of the player or prop to visually demonstrate the vertical overlap/stacking effect.

### 4. Sprite & Metadata Injection Interface
Provide a clean UI sidebar/drawer with:
- Image Uploader / URL Input: Load any sprite sheet image (PNG or WebP).
- Frame & JSON Config:
  - Input fields for `frameWidth`, `frameHeight`, `fps`, and animation row order.
  - Quick-preset loader for the standard 1024x640 (8 columns, 5 rows, 128x128 frames) layout.
- Debug Overlays (checkboxes):
  - [x] Show Grid Lines
  - [x] Show 64x64 Footprint Hitboxes (red outline at feet)
  - [x] Show Sprite Registration Anchor Point (yellow dot at bottom-center)
  - [x] Show Sprite Bounding Box (cyan outline around entire 128x128 frame)
- Zoom controls (1x, 2x pixel crisp scale using `image-rendering: pixelated`).

Keep all code cleanly organized in a single file with zero external dependencies.
