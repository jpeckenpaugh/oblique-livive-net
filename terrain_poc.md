# Specification: Substrate Terrain Stack (POC)

## 1. Overview & Objective

This proof-of-concept replaces per-tile discrete background rendering with a continuous multi-layered substrate stack inspired by classic PC RPGs (*Ultima VI*, *Tibia*).

The goal is to eliminate checkerboard tile seams by treating foundational terrain (rock, grass, soil, water) as continuous, procedural layers with alpha/masking cutouts, rendered beneath the existing oblique $Y$-sorted entity layer.

---

## 2. Layer Hierarchy (Render Order: Bottom to Top)

```text
▲ [Layer 5] Entities & Props   (Dynamic Y-sorted: Houses, Trees, Barrels, Characters)
│ [Layer 4] Flowing Water       (Semi-transparent, animated procedural waves & foam)
│ [Layer 3] Topsoil & Pathways  (Sand beaches, dirt trails, stone/cobble paths)
│ [Layer 2] Biome / Grass Field (Procedural continuous noise, alpha-feathered at edges)
│ [Layer 1] Bedrock Base        (100% opaque floor: ocean abyss, wet silt, cavern rock)
▼

```

### Layer 1: Bedrock / Abyss Base

* **Role:** Universal fallback and deep floor.
* **Coverage:** Opaque across $100\%$ of world boundaries.
* **Visuals:** Dark, textured rock, cavern stone, or ocean-trench silt.
* **Behavior:** Ensures there are never transparent voids or black clipping regions when water recedes or upper terrain masks cut away.

### Layer 2: Biome / Grass Field

* **Role:** Continuous organic field.
* **Generation:** Generated using multi-octave 2D Simplex/Perlin noise evaluated against **world coordinates** (not grid indices).
* **Color Ramp:** Smooth variation between rich green, mossy dark green, and dry yellow/lime tufts. Quantized to an indexed retro palette.
* **Alpha Mask:** Opacity is `1.0` across inland regions, fading down to `0.0` at coasts, cliff sides, or barren clearings.

### Layer 3: Topsoil, Paths & Beach Sand

* **Role:** Transitional and human-made surfaces.
* **Sand:** Encircles grass perimeters to form coastlines and riverbanks. Extends beneath shallow water zones into Layer 1.
* **Trails & Stone:** Dirt tracks feather naturally over the grass; stone and concrete use crisp pixel cutouts or autotile masks.
* **Behavior:** Renders directly over Layer 2 (grass) and Layer 1 (bedrock), defining natural coastlines and roads.

### Layer 4: Flowing Water

* **Role:** Dynamic liquid surface.
* **Depth & Transparency:**
* Deep ocean regions use high opacity (`0.85`–`0.95`, deep teal/navy).
* Shallow coastal water over beaches uses medium opacity (`0.4`–`0.6`), allowing submerged sand and underwater rock details from Layers 1 & 3 to show through.


* **Dynamic Wave Drift:** Live animated UV offset or noise pass driving subtle horizontal/diagonal water flow.
* **Shoreline Foam:** Animated threshold wave crests washing bright foam pixels back and forth across the sand boundaries of Layer 3.

### Layer 5: Entities & Oblique Stacking

* **Role:** All interactables, structures, props, and characters.


* **Rules:**
* Uses the existing orthogonal square grid coordinates ($64 \times 64$ footprints).


* Anchored at bottom-center registration points (`x: width / 2`, `y: height`).


* Sorted dynamically every frame strictly by their foot $Y$-coordinate (`tileY * 64 + 64`) to guarantee correct occlusion.





---

## 3. Performance & Rendering Strategy

To sustain 60 FPS in HTML5 Canvas without calculating per-pixel procedural noise every frame:

1. **Static Bake (Layers 1–3):**
* Generate and composite Bedrock $\rightarrow$ Grass $\rightarrow$ Sand/Paths onto a cached offscreen canvas (`OffscreenCanvas`) once upon map load or chunk generation.
* Draw the entire static ground slice using a single `ctx.drawImage()` call per frame.


2. **Live Dynamic Pass (Layer 4):**
* Water noise, scrolling surface details, and foam lines execute on an active canvas loop directly above the baked background.


3. **Entity Pass (Layer 5):**
* Draw $Y$-sorted sprites over the water/terrain composite. Submerged entities can optionally receive a lower-leg water tint or ripple overlay.





---

## 4. POC Deliverables & Success Criteria

1. **No Checkerboard Seams:** Grass color variations sweep organically across multiple tiles without respecting tile borders.


2. **Submerged Sand Visibility:** Sand visibly runs underneath shallow coastal water.
3. **Animated Shoreline:** White foam pixels pulse onto the beach and recede smoothly.
4. **Clean Stacking Intact:** The fisherman hut, trees, barrels, and Archer sprite sit flat on the new substrate with correct $Y$-depth ordering.
