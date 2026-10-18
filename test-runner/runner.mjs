import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const rootDir = process.env.WORKSPACE_DIR || "/game";
const artifactsDir = process.env.ARTIFACTS_DIR || "/artifacts";
const galleryDir = path.join(artifactsDir, "gallery");

fs.mkdirSync(galleryDir, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  const relPath = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath).replace(/^\//, "");
  const filePath = path.join(rootDir, relPath);
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function injectCursor(page) {
  await page.evaluate(() => {
    if (window.__cursorInjected) return;
    window.__cursorInjected = true;
    const cursor = document.createElement("div");
    cursor.id = "playwright-demo-cursor";
    cursor.style.position = "fixed";
    cursor.style.top = "0";
    cursor.style.left = "0";
    cursor.style.width = "20px";
    cursor.style.height = "20px";
    cursor.style.borderRadius = "50%";
    cursor.style.backgroundColor = "rgba(56, 189, 248, 0.75)";
    cursor.style.border = "2px solid #ffffff";
    cursor.style.boxShadow = "0 0 10px rgba(56, 189, 248, 0.9)";
    cursor.style.pointerEvents = "none";
    cursor.style.zIndex = "9999999";
    cursor.style.transform = "translate(-50%, -50%)";
    cursor.style.transition = "width 0.15s ease, height 0.15s ease, background-color 0.15s ease";
    document.body.appendChild(cursor);

    window.__setCursorPos = (x, y) => {
      cursor.style.left = x + "px";
      cursor.style.top = y + "px";
    };

    window.__cursorClickAnim = () => {
      cursor.style.width = "30px";
      cursor.style.height = "30px";
      cursor.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
      setTimeout(() => {
        cursor.style.width = "20px";
        cursor.style.height = "20px";
        cursor.style.backgroundColor = "rgba(56, 189, 248, 0.75)";
      }, 200);
    };

    document.addEventListener("mousemove", (e) => {
      window.__setCursorPos(e.clientX, e.clientY);
    });
    document.addEventListener("mousedown", () => {
      window.__cursorClickAnim();
    });
  });
}

server.listen(4180, "127.0.0.1", async () => {
  console.log("Local server running at http://127.0.0.1:4180");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--enable-unsafe-swiftshader",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } },
  });

  const page = await context.newPage();
  const startTime = Date.now();

  page.on("console", (msg) => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
  page.on("pageerror", (err) => console.error(`[BROWSER ERROR]:`, err));

  try {
    // =========================================================================
    // BEAT 1 & 2 & 3: sandbox.html (~0:00 - 0:15)
    // Dynamic Y-depth, player navigation, debug hitboxes, and live sprite editor
    // =========================================================================
    console.log("Navigating to sandbox.html...");
    await page.goto("http://127.0.0.1:4180/sandbox.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#gameCanvas");
    await injectCursor(page);
    await sleep(800);

    // Player walking navigation (WASD) through the 2.5D world
    console.log("Navigating player through scene...");
    await page.keyboard.down("KeyD");
    await sleep(650);
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyS");
    await sleep(600);
    await page.keyboard.up("KeyS");
    await page.keyboard.down("KeyA");
    await sleep(550);
    await page.keyboard.up("KeyA");
    await page.keyboard.down("KeyW");
    await sleep(500);
    await page.keyboard.up("KeyW");

    // Capture Gallery 1: 01-sandbox-depth-and-shadows.png
    console.log("Capturing 01-sandbox-depth-and-shadows.png...");
    await page.screenshot({ path: path.join(galleryDir, "01-sandbox-depth-and-shadows.png") });
    await sleep(500);

    // Beat 2: Enable Debug Overlays
    console.log("Toggling debug overlays...");
    await page.mouse.move(1120, 185, { steps: 5 });
    await page.click("#chk-hitbox");
    await sleep(350);
    await page.click("#chk-anchor");
    await sleep(350);
    await page.click("#chk-bounds");
    await sleep(350);
    await page.click("#chk-grid");
    await sleep(500);

    // Adjust shadow feather slider
    await page.evaluate(() => {
      const slider = document.querySelector("#rng-shadow-feather");
      if (slider) {
        slider.value = "15";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await sleep(400);

    // Capture Gallery 2: 02-debug-overlays-and-hitboxes.png
    console.log("Capturing 02-debug-overlays-and-hitboxes.png...");
    await page.screenshot({ path: path.join(galleryDir, "02-debug-overlays-and-hitboxes.png") });
    await sleep(500);

    // Beat 3: Live Sprite & Prop Editor Turntable Scrubbing
    console.log("Selecting prop in Sprite Editor...");
    await page.selectOption("#editor-entity-select", "palm-tree-1");
    await sleep(600);

    // Scrub 8-angle frame slider for palm tree
    for (const frame of [2, 4, 6, 7, 0]) {
      await page.evaluate((val) => {
        const slider = document.querySelector("#ed-frame-slider");
        if (slider) {
          slider.value = String(val);
          slider.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, frame);
      await sleep(250);
    }
    await sleep(300);

    // Capture Gallery 3: 03-sprite-editor-turntable-tuning.png
    console.log("Capturing 03-sprite-editor-turntable-tuning.png...");
    await page.screenshot({ path: path.join(galleryDir, "03-sprite-editor-turntable-tuning.png") });
    await sleep(600);

    // =========================================================================
    // BEAT 4: terrain-layers.html (~0:15 - 0:20)
    // 5-Layer Substrate Deconstruction and Solo Layer Views
    // =========================================================================
    console.log("Navigating to terrain-layers.html...");
    await page.goto("http://127.0.0.1:4180/terrain-layers.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvas-wrapper");
    await injectCursor(page);
    await sleep(800);

    // Solo L1 Bedrock
    console.log("Soloing L1 Bedrock...");
    await page.mouse.move(1100, 240, { steps: 5 });
    await page.click('button.btn-solo[data-layer="l1"]');
    await sleep(900);

    // Solo L2 Grass Turf
    console.log("Soloing L2 Turf...");
    await page.click('button.btn-solo[data-layer="l2"]');
    await sleep(900);

    // Solo L4 Flowing Water & Foam
    console.log("Soloing L4 Flowing Water...");
    await page.click('button.btn-solo[data-layer="l4"]');
    await sleep(900);

    // Un-solo to restore full composite stack
    console.log("Restoring full substrate composite...");
    await page.click('button.btn-solo[data-layer="l4"]');
    await sleep(800);

    // Capture Gallery 4: 04-five-layer-substrate-matrix.png
    console.log("Capturing 04-five-layer-substrate-matrix.png...");
    await page.screenshot({ path: path.join(galleryDir, "04-five-layer-substrate-matrix.png") });
    await sleep(600);

    // =========================================================================
    // BEAT 5: playground.html (~0:20 - 0:25)
    // 16x16 Scene Builder, Terrain Painting, and Event Sequencer
    // =========================================================================
    console.log("Navigating to playground.html...");
    await page.goto("http://127.0.0.1:4180/playground.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#playground");
    await injectCursor(page);
    await sleep(600);

    // Switch scene preset to Beach Side
    console.log("Selecting Beach Side preset...");
    await page.click('button.scene[data-scene="beach"]');
    await sleep(700);

    // Select Water brush and paint a stroke across the playground canvas
    console.log("Painting water brush onto terrain grid...");
    await page.click('button.brush[data-tool="water"]');
    await sleep(300);

    const canvasBox = await page.locator("#playground").boundingBox();
    if (canvasBox) {
      const startX = canvasBox.x + canvasBox.width * 0.35;
      const startY = canvasBox.y + canvasBox.height * 0.45;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 120, startY + 40, { steps: 8 });
      await page.mouse.move(startX + 180, startY - 30, { steps: 8 });
      await page.mouse.up();
    }
    await sleep(500);

    // Toggle Autonomous NPCs
    console.log("Enabling Play NPCs...");
    await page.click("#ai-toggle");
    await sleep(600);

    // Open Sprite Picker drawer
    console.log("Opening Sprite drawer...");
    await page.click("#sprite-toggle");
    await sleep(700);

    // Capture Gallery 5: 05-playground-scene-builder-sequencer.png
    console.log("Capturing 05-playground-scene-builder-sequencer.png...");
    await page.screenshot({ path: path.join(galleryDir, "05-playground-scene-builder-sequencer.png") });
    await sleep(600);

    // =========================================================================
    // BEAT 6: beach-camp.html (~0:25 - 0:30.5)
    // Coastal Scene Study & Water/Foam Simulation
    // =========================================================================
    console.log("Navigating to beach-camp.html...");
    await page.goto("http://127.0.0.1:4180/beach-camp.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#canvas-wrapper");
    await injectCursor(page);
    await sleep(1000);

    // Smooth pan/scroll through coastal beach camp
    await page.evaluate(() => {
      const wrapper = document.getElementById("canvas-wrapper");
      if (wrapper) {
        wrapper.scrollBy({ left: 160, top: 100, behavior: "smooth" });
      }
    });
    await sleep(1500);

    // Capture Gallery 6: 06-coastal-beach-camp-study.png
    console.log("Capturing 06-coastal-beach-camp-study.png...");
    await page.screenshot({ path: path.join(galleryDir, "06-coastal-beach-camp-study.png") });

    // Pad duration to reach target ~30.5s duration
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 30500 - elapsed);
    console.log(`Elapsed: ${elapsed}ms, waiting ${remaining}ms to reach ~30.5s target...`);
    await sleep(remaining);

  } catch (err) {
    console.error("Automation error:", err);
    throw err;
  } finally {
    console.log("Closing browser and finalizing video...");
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const rawVideoPath = await video.path();
      console.log("Raw video recorded at:", rawVideoPath);
      const targetWebm = path.join(artifactsDir, "demo.webm");

      try {
        console.log("Transcoding video to 30s 720p WebM (VP9)...");
        execSync(
          `ffmpeg -y -i "${rawVideoPath}" -t 30 -vf "scale=1280:720,fps=30" -c:v libvpx-vp9 -b:v 1500k -crf 30 -an "${targetWebm}"`,
          { stdio: "inherit" }
        );
        console.log("Optimized demo.webm created:", targetWebm);
      } catch (ffErr) {
        console.error("FFmpeg transcode failed, copying raw video:", ffErr);
        fs.copyFileSync(rawVideoPath, targetWebm);
      }

    }

    server.close();
    console.log("Showcase test run complete.");
  }
});
