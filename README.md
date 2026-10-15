# Oblique — 2.5D Model Sandbox

**Live project:** [oblique.livive.net](https://oblique.livive.net/)

**Source:** [github.com/jpeckenpaugh/oblique-livive-net](https://github.com/jpeckenpaugh/oblique-livive-net)

Oblique is a browser-based workbench for exploring 2.5D game worlds on an orthogonal square grid. It brings sprite testing, terrain experiments, and interactive coastal scenes together in a set of standalone pages built with HTML, CSS, and vanilla JavaScript.

## Explore

- [**2.5D Model Sandbox**](https://oblique.livive.net/sandbox.html) — Move through a scene, inspect and edit sprites, paint terrain, and test anchors, depth sorting, collisions, and shadows.
- [**Terrain Layers**](https://oblique.livive.net/terrain-layers.html) — Experiment with a five-layer terrain substrate, shoreline foam, water, procedural noise, and layer visibility.
- [**Beach Camp**](https://oblique.livive.net/beach-camp.html) — Explore the terrain system in a larger coastal scene with paths, beaches, waterways, vegetation, and props.

Additional builds are available from the [project home page](https://oblique.livive.net/): an alternate Beach Camp water treatment and the original single-file sandbox baseline.

Clone the repository with SSH:

```sh
git clone git@github.com:jpeckenpaugh/oblique-livive-net.git
```

## Features

- 64×64 orthogonal world grid with bottom-anchored sprites and dynamic Y-depth sorting
- Interactive sprite and prop inspection, frame selection, and anchor/dimension editing
- Procedural grass, trails, sand, water, and animated shoreline effects
- Player movement, wandering NPCs, obstacle collision, camera controls, and directional silhouette shadows
- Debug overlays for grids, hitboxes, bounds, anchors, collisions, and shadows
- Custom local image and sprite-sheet loading in the main sandbox

## Run locally

The pages use browser ES modules and load local image assets, so open them through an HTTP server rather than directly as `file://` URLs:

```sh
python3 -m http.server 8000
```

Then visit [http://127.0.0.1:8000](http://127.0.0.1:8000). The landing page links to all featured experiences. You can also open any of the page files directly from the server root.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml` that publishes the repository root when changes are pushed to `main`.

To enable hosting:

1. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source.
2. Configure the DNS for `oblique.livive.net` with a CNAME record pointing to `jpeckenpaugh.github.io`.
3. In **Settings → Pages**, set the custom domain to `oblique.livive.net` and enable HTTPS once GitHub makes it available.

The root `CNAME` file declares the custom domain for Pages. Internal page and asset links are relative so the site also works at a local server root.

## Project layout

```text
index.html                  Landing page and experience directory
sandbox.html                Modular sprite / terrain sandbox
terrain-layers.html         Five-layer terrain proof of concept
beach-camp.html             Coastal scene study
beach-camp-no-foam.html     Alternate Beach Camp water experiment
legacy-sandbox.html         Original single-file sandbox baseline
assets/previews/            Landing page screenshots
css/                        Page stylesheets
src/core/                   App state, input, assets, and main loop
src/entities/               Player, props, NPCs, and collision
src/render/                 Camera, sprite renderer, shadows, debug views
src/terrain/                Terrain maps, textures, rendering, and grass flow
src/ui/                     Sprite editor, terrain painter, and controls
*.webp / *.json             Sprite sheets and animation descriptors
```

## Assets

The repository includes the sprite sheets and metadata used by the demos. Check the source and usage rights for each included asset before reusing or redistributing it outside this project.
