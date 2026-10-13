# Oblique 2.5D Model Sandbox (`model-sandbox`)

A lightweight, standalone HTML5 Canvas oblique/cabinet 2.5D sandbox engine running on an orthogonal square grid (inspired by classic *Ultima VI* and *Tibia*), featuring vertical sprite stacking, continuous procedural terrain, directional silhouette shadows, interactive entity editors, and autonomous NPCs.

---

## 🌟 Overview & Design Philosophy

The sandbox demonstrates **oblique 2.5D rendering** on a strictly orthogonal $(x, y)$ square tile grid—avoiding the mathematical complexity and coordinate rotation of 45-degree diamond isometric projections while achieving convincing depth, occlusion, and vertical layering.

* **Orthogonal Square Grid**: 64×64 pixel tiles across a 64×64 world grid ($4,096 \times 4,096$ px) with high-performance viewport culling.
* **Vertical Sprite Stacking**: Sprites are taller than their ground footprint (e.g. 128×128 or 256×256 px). Anchors register at bottom-center so feet sit flush in the current tile while bodies naturally overlap the tile row above.
* **Continuous Y-Depth Sorting**: Entities and props are dynamically depth-sorted by their foot baseline ($Y + \text{height}$) every frame.
* **Zero External Dependencies**: Self-contained vanilla JavaScript running natively in any modern browser.

---

## 🏗️ Systems & Architecture

### 1. Terrain Engine & Natural Grass Flow
* **Multi-Layer Terrain**: Supports Grass Meadow, Sand Beach, Deep Ocean/River, and optional Dirt Trails.
* **Harmonic Grass Flow**: Eliminates discrete rectangular tile steps using an offscreen bilinear field warped by four out-of-sync harmonic sine waves:
  * Rolling wave, counter-wave, cross-axis ripple, and diagonal wave.
* **Tile Seam Smudging**: Procedurally scatters organic grass blade tufts across tile boundaries using deterministic PRNG hashing to erase rectangular seam lines.
* **Interactive Terrain Painter**: Live in-browser brush tool (Play Mode, Grass, Dirt, Sand, Water) to repaint the terrain interactively.
* **Dynamic Shorelines**: Context-aware shoreline sand buffers, corner rounding, and animated breathing surf foam.

### 2. Oblique Lighting & Directional Shadows
* **Silhouette Shadow Casting**: Rather than generic grey ellipses, shadows extract the actual alpha silhouette of each object (palm tree, house, barrel, humanoid, rat).
* **Shear & Tilt Projection**: Imprints the darkened shape on top of the terrain but under entities, skewed with a horizontal shear ($\tan 20^\circ$) and vertical squash.
* **Baseline Feathering**: A soft vertical gradient fade (40–60%) feathers out the bottom of the shadow where feet connect with the ground to eliminate harsh clipping.

### 3. Entity & NPC Ecosystem
* **Player Character**: 4-directional walking controller with tile-snapping movement (`snapToGrid`), walk cycle animations, and smooth camera following.
* **Wandering Rats**:
  * **Brown River Rat**: Autonomous wandering state machine (idle, look left, look right, step walk).
  * **Black Rat**: 60% scale miniature rat using real-time canvas tint shading over the standard rat turntable sheet.
* **Water Piranha NPCs**: Water-bounded autonomous swimming state machine with dynamic tail wiggle oscillating across a 12-frame turntable sheet.
* **Props & World Objects**: Fisher's cottage with roof overhang depth sorting, multi-section wooden dock piers (walkable over water), tropical palm trees (256×256 px), wooden barrels, rock piles, and drying fisher's nets.

### 4. Developer Tools & In-Sandbox Editor
* **In-Engine Sprite Editor**:
  * Select any entity or prop directly from the canvas or dropdown.
  * Adjust active animation frame, anchor point presets (`bottom-center`, `center`, `custom`), and render dimensions in real time.
* **Debug Visualizers**:
  * Toggle Grid Lines (`64x64`)
  * Toggle 64×64 Footprint Hitboxes (red outlines)
  * Toggle Anchor Registration Points (yellow crosshairs)
  * Toggle Full Frame Bounding Boxes (cyan outlines)
  * Toggle Collision Maps and Water Solidity
  * Toggle Dynamic Directional Shadows & Baseline Feathering
* **Camera Controls**: Smooth drag-panning, player auto-tracking, and zoom levels (0.5×, 1.0×, 1.5×).

---

## 📁 Repository Structure

```text
model-sandbox/
├── README.md                                             # Project overview and architecture reference
├── concept.md                                            # Original 2.5D oblique grid design specification
├── index.html                                            # Lightweight semantic HTML5 application shell
├── index.monolith.html                                   # Preserved monolithic baseline (~3,650 lines) for regression testing
├── css/
│   └── style.css                                         # Theme styling, layout, HUD, and sidebar controls
├── src/
│   ├── main.js                                           # Application bootstrap & lifecycle orchestrator
│   ├── core/
│   │   ├── constants.js                                  # Tile dims (64), grid bounds (30x24), directions, terrain enums
│   │   ├── state.js                                      # Central reactive state (debug flags, terrainMap, editorState)
│   │   ├── assets.js                                     # Image preloader, asset cache, isAssetReady, black rat tint cache
│   │   ├── input.js                                      # Keyboard listener (keys object)
│   │   └── loop.js                                       # Main RAF loop, delta time calculation, FPS metrics
│   ├── terrain/
│   │   ├── terrain-maps.js                               # Pure grass & dirt trail preset 2D map arrays
│   │   ├── tile-textures.js                              # Offscreen procedural tile variants (grass, dirt, sand)
│   │   ├── grass-flow.js                                 # Harmonic sine wave flow field manager (worker + sync fallback)
│   │   ├── grass-flow.worker.js                          # Web Worker for off-thread pure mathematical flow calculation
│   │   └── terrain-renderer.js                           # 4-pass ground grid renderer (tiles, smudge, flow, coastal surf)
│   ├── entities/
│   │   ├── player.js                                     # Player entity definition, grid stepping & movement update
│   │   ├── rat-npc.js                                    # Brown & Black rat wandering state machine & look-direction frames
│   │   ├── piranha-npc.js                                # Swimming piranha state machine & tail wiggle turntable math
│   │   ├── manifest.js                                   # Declarative prop/NPC definitions (cottage, dock, barrels, trees, rocks)
│   │   └── collision.js                                  # isTileWalkable, isTileDock, and continuous AABB checkCollision
│   ├── render/
│   │   ├── shadows.js                                    # Directional silhouette shadow rasterizer & contact feathering
│   │   ├── entity-renderer.js                            # Y-depth sorting pipeline, sprite rendering, piranha water effects
│   │   ├── debug-renderer.js                             # Hitboxes, bounding boxes, registration anchors, selection brackets
│   │   └── camera.js                                     # Viewport zoom levels & smooth auto-centering
│   └── ui/
│       ├── editor.js                                     # Sprite Editor state machine, canvas click picking, 2-way input sync
│       ├── terrain-painter.js                            # Interactive brush tool & mouse painting handlers
│       └── controls.js                                   # Debug checkbox listeners, sliders, preset buttons, sprite injector
│
├── rukiya-walking-walking-animation-palette.webp         # Player humanoid walk cycle sprite sheet
├── rukiya-walking-walking-animation.json                 # Humanoid sprite sheet animation metadata
├── river-rat-walking-armature-unreal-take-...webp        # River rat walk cycle sprite sheet
├── river-rat-walking-armature-unreal-take-...json        # River rat animation metadata
│
├── fishers-house-turntable-palette.webp                  # Fisher's cottage turntable sprite sheet
├── fishers-house-turntable.json                          # Cottage sprite metadata
├── wooden-dock-turntable-palette.webp                    # Modular wooden dock pier sprite sheet
├── wooden-dock-turntable.json                            # Wooden dock metadata
├── tropical-palm-tree-turntable-palette.webp             # Palm tree sprite sheet
├── tropical-palm-tree-turntable.json                     # Palm tree metadata
├── wooden-barrel-turntable-palette.webp                  # Wooden barrel turntable sprite sheet
├── wooden-barrel-turntable.json                          # Wooden barrel metadata
├── rock-pile-turntable-palette.webp                      # Rock piles / boulders turntable sheet
├── rock-pile-turntable.json                              # Rock pile metadata
├── fishers-net-turntable-palette.webp                    # Fisher's nets turntable sheet
├── fishers-net-turntable.json                            # Fisher's net metadata
├── piranha-turntable-palette.webp                        # Swimming piranha turntable sheet
└── piranha-turntable.json                                # Piranha metadata
```

---

## 🚀 Running the Sandbox Locally

Because the sandbox loads local WebP sprite sheets and JSON descriptors via `fetch` / `Image()`, and uses native browser ES modules (`<script type="module">`), it must be served over HTTP:

```bash
# Launch a local server on port 8000
python3 -m http.server 8000
```

Open your browser to:
**[http://127.0.0.1:8000](http://127.0.0.1:8000)**

*(To run the original monolith baseline for 1:1 regression comparison, visit [http://127.0.0.1:8000/index.monolith.html](http://127.0.0.1:8000/index.monolith.html))*

