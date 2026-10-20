import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const runnerDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = process.env.WORKSPACE_DIR
  ? path.resolve(process.env.WORKSPACE_DIR)
  : path.resolve(runnerDir, "..");

const MESHY_KEY = "msy_smoke_test_do_not_use_0123456789";
const OPENCODE_KEY = "sk-smoke-test-do-not-use-0123456789";
const SCENE_STORAGE_KEY = "oblique.playground.scenes.v1";
const SETTINGS_STORAGE_KEY = "oblique.ai.settings.v1";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const GLB = Buffer.concat([Buffer.from("glTF", "ascii"), Buffer.alloc(64, 0x2a)]);

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
  ".woff2": "font/woff2"
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, Accept",
    "access-control-expose-headers": "Retry-After, Content-Type",
    "cache-control": "no-store"
  };
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    headers: { ...corsHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function binary(route, body, contentType) {
  return route.fulfill({
    status: 200,
    headers: { ...corsHeaders(), "content-type": contentType },
    body
  });
}

function serveStatic(req, res) {
  const urlPath = (req.url || "/").split("?")[0];
  const relPath = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath).replace(/^\//, "");
  const filePath = path.join(rootDir, relPath);
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME_TYPES[extension] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(data);
  });
}

const checks = [];
function check(value, label) {
  assert.ok(value, label);
  checks.push(label);
  console.log(`PASS ${label}`);
}

function equal(actual, expected, label) {
  assert.equal(actual, expected, `${label} (expected ${expected}, got ${actual})`);
  checks.push(label);
  console.log(`PASS ${label}`);
}

async function waitForText(page, selector, expected, timeout = 20000) {
  await page.waitForFunction(
    ({ selector, expected }) => {
      const node = document.querySelector(selector);
      return !!node && (node.textContent || "").includes(expected);
    },
    { selector, expected },
    { timeout }
  );
}

async function main() {
  const server = http.createServer(serveStatic);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`Static server: ${baseUrl}`);
  console.log(`Workspace: ${rootDir}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true
  });

  let meshyImagePolls = 0;
  let meshyThreePolls = 0;
  const consoleLines = [];
  const pageErrors = [];
  const requestUrls = [];

  await context.route("https://api.meshy.ai/**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders() });
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (request.method() === "GET" && pathname === "/openapi/v1/balance") {
      return json(route, { credits: 42, plan: "smoke" });
    }
    if (request.method() === "POST" && pathname === "/openapi/v1/text-to-image") {
      return json(route, { result: "task-image-1" });
    }
    if (request.method() === "GET" && pathname === "/openapi/v1/text-to-image/task-image-1") {
      meshyImagePolls += 1;
      return json(route, {
        id: "task-image-1",
        status: "SUCCEEDED",
        progress: 100,
        image_urls: ["https://assets.meshy.test/generated-image.png"]
      });
    }
    if (request.method() === "POST" && pathname === "/openapi/v2/text-to-3d") {
      return json(route, { result: "task-3d-1" });
    }
    if (request.method() === "GET" && pathname === "/openapi/v2/text-to-3d/task-3d-1") {
      meshyThreePolls += 1;
      return json(route, {
        id: "task-3d-1",
        status: "SUCCEEDED",
        progress: 100,
        thumbnail_url: "https://assets.meshy.test/model-thumb.png",
        model_urls: { glb: "https://assets.meshy.test/model.glb" }
      });
    }
    return json(route, { message: `Unexpected Meshy mock path: ${request.method()} ${pathname}` }, 404);
  });

  await context.route("https://assets.meshy.test/**", route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders() });
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(".glb")) return binary(route, GLB, "model/gltf-binary");
    return binary(route, PNG, "image/png");
  });

  await context.route("https://opencode-blocked.test/**", route => route.abort("failed"));

  await context.route("https://opencode.test/**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders() });
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/v1/models") {
      return json(route, {
        data: [
          { id: "mock-chat-1", architecture: { output_modalities: ["text"] } },
          { id: "mock-image-1", architecture: { output_modalities: ["image"] } }
        ]
      });
    }
    if (request.method() === "POST" && url.pathname === "/v1/images/generations") {
      return json(route, {
        data: [{ b64_json: PNG.toString("base64"), revised_prompt: "mocked smoke image" }]
      });
    }
    return json(route, { message: `Unexpected OpenCode mock path: ${request.method()} ${url.pathname}` }, 404);
  });

  const page = await context.newPage();
  page.on("console", message => consoleLines.push({ type: message.type(), text: message.text() }));
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => requestUrls.push(request.url()));
  page.on("dialog", dialog => dialog.accept());

  async function openDrawer(tab) {
    if (await page.locator("#ai-studio").isHidden()) {
      await page.click("#ai-studio-toggle");
      await page.waitForSelector("#ai-studio:not([hidden])");
    }
    if (tab) {
      await page.click(`#ai-tab-${tab}`);
      await page.waitForSelector(`#ai-panel-${tab}:not([hidden])`);
    }
  }

  async function openScenes() {
    if (await page.evaluate(() => document.getElementById("scene-manager")?.hidden !== false)) {
      await page.click("#layout-toggle");
    }
    await page.waitForSelector("#scene-name", { state: "visible" });
  }

  async function closeDrawer() {
    if (await page.locator("#ai-studio").isVisible()) {
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.getElementById("ai-studio")?.hidden === true);
    }
  }

  try {
    const landing = await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    check(landing?.ok(), "plain static server serves the landing page");
    check((await page.title()).length > 0, "landing page title loads");

    const playground = await page.goto(`${baseUrl}/playground.html`, { waitUntil: "domcontentloaded" });
    check(playground?.ok(), "plain static server serves playground.html");
    await page.waitForFunction(() => window.ObliqueAI && typeof window.ObliqueAI.placeSpriteAt === "function");
    await page.evaluate(() => window.ObliqueAI.ready);
    check(await page.evaluate(() => localStorage.getItem("oblique.ai.settings.v1") === null), "fresh browser has no stored AI keys");

    await page.click("#ai-studio-toggle");
    await page.waitForSelector("#ai-studio:not([hidden])");
    await page.waitForFunction(() => document.activeElement?.id === "ai-tab-image");
    equal(await page.getAttribute("#ai-studio-toggle", "aria-expanded"), "true", "AI drawer opens and reports expanded");
    check(await page.locator("#ai-panel-image").isVisible(), "AI drawer opens on the Image tab");
    check(await page.locator("#ai-image-empty").isVisible(), "AI drawer shows the empty state with no keys");

    await page.click("#ai-tab-3d");
    check(await page.locator("#ai-panel-3d").isVisible(), "3D tab activates");
    equal(await page.getAttribute("#ai-tab-3d", "aria-selected"), "true", "3D tab is marked selected");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.id === "ai-tab-settings");
    check(await page.locator("#ai-panel-settings").isVisible(), "arrow keys switch tabs");

    await page.keyboard.press("Escape");
    check(await page.locator("#ai-studio").isHidden(), "Escape closes the AI drawer");
    equal(await page.evaluate(() => document.activeElement?.id), "ai-studio-toggle", "Escape returns focus to the AI button");

    await openDrawer("settings");
    await page.fill("#ai-meshy-key", MESHY_KEY);
    check(await page.isChecked("#ai-meshy-remember"), "Meshy remember-on-device defaults to checked");
    await page.click("#ai-meshy-test");
    await waitForText(page, "#ai-meshy-status", "42 credits available");
    check((await page.textContent("#ai-meshy-status")).includes("plan smoke"), "mocked Meshy balance test succeeds");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.ObliqueAI.ready);
    await openDrawer("settings");
    equal(await page.inputValue("#ai-meshy-key"), MESHY_KEY, "Meshy key survives reload when remembered");

    await openDrawer("image");
    await page.fill("#ai-image-prompt", "smoke test lantern");
    await page.click("#ai-image-generate");
    await page.waitForSelector("#ai-image-result:not([hidden])", { timeout: 20000 });
    check(((await page.getAttribute("#ai-image-preview", "src")) || "").startsWith("blob:"), "mocked Text to Image returns a PNG blob preview");
    equal(await page.textContent("#ai-image-dimensions"), "1 × 1 px", "generated image dimensions are measured");
    check(await page.locator("#ai-image-add").isEnabled(), "generated image can be added to the scene");
    await page.click("#ai-image-add");
    await waitForText(page, "#ai-image-add", "Added to scene");
    const customSpritesAfterImage = await page.evaluate(() =>
      window.ObliqueAI.listSpriteTypes().filter(type => type.custom)
    );
    equal(customSpritesAfterImage.length, 1, "Add to scene registers a custom sprite");
    check(customSpritesAfterImage[0].id.startsWith("custom-"), "custom sprite id uses the asset registry");

    await closeDrawer();
    await openScenes();
    await page.fill("#scene-name", "ai-smoke-scene");
    await page.click("#save-scene");
    await waitForText(page, "#scene-message", "Saved");
    const sceneRaw = await page.evaluate(key => localStorage.getItem(key) || "", SCENE_STORAGE_KEY);
    check(sceneRaw.includes("custom-"), "saved scene stores the generated sprite id");
    check(!sceneRaw.includes(MESHY_KEY) && !sceneRaw.includes(OPENCODE_KEY), "saved scene JSON contains no keys");

    await openDrawer("3d");
    await page.fill("#ai-3d-prompt", "smoke test crate");
    await page.click("#ai-3d-generate");
    await page.waitForSelector("#ai-3d-result:not([hidden])", { timeout: 20000 });
    check(await page.locator("#ai-3d-download").isEnabled(), "mocked Text to 3D exposes an enabled GLB download");
    equal(await page.textContent("#ai-3d-meta-stage"), "Preview", "3D result reports the preview stage");
    const glbDownloadPromise = page.waitForEvent("download");
    await page.click("#ai-3d-download");
    const glbDownload = await glbDownloadPromise;
    check(glbDownload.suggestedFilename().endsWith(".glb"), "GLB download uses a .glb filename");
    const glbPath = await glbDownload.path();
    check(glbPath && fs.statSync(glbPath).size > 0, "GLB download contains mocked binary data");

    await openDrawer("settings");
    await page.fill("#ai-opencode-base-url", "https://opencode-blocked.test/v1");
    await page.fill("#ai-opencode-key", OPENCODE_KEY);
    await page.fill("#ai-opencode-model", "mock-image-1");
    await page.click("#ai-opencode-test");
    await waitForText(page, "#ai-opencode-status", "OPENCODE_CORS_BLOCKED");
    check((await page.textContent("#ai-opencode-status")).includes("CORS-enabled"), "blocked OpenCode endpoint explains the CORS fix");

    await openDrawer("image");
    await page.selectOption("#ai-image-provider", "opencode");
    await page.waitForSelector("#ai-image-opencode-note:not([hidden])");
    check(
      ((await page.textContent("#ai-image-opencode-detail")) || "").includes("OPENCODE_CORS_BLOCKED"),
      "Image tab shows the precise OPENCODE_CORS_BLOCKED state"
    );
    check(await page.locator("#ai-image-generate").isDisabled(), "blocked OpenCode endpoint disables Generate instead of failing a request");

    await openDrawer("settings");
    await page.fill("#ai-opencode-base-url", "https://opencode.test/v1");
    await page.fill("#ai-opencode-key", OPENCODE_KEY);
    await page.fill("#ai-opencode-model", "mock-image-1");
    await page.click("#ai-opencode-test");
    await waitForText(page, "#ai-opencode-status", "Image models: mock-image-1");
    check(true, "CORS-enabled OpenCode-compatible endpoint reports its image model");

    await openDrawer("image");
    await page.selectOption("#ai-image-provider", "opencode");
    await page.fill("#ai-image-prompt", "smoke test opencode image");
    await page.click("#ai-image-generate");
    await waitForText(page, "#ai-image-meta-provider", "OpenCode-compatible");
    check(
      ((await page.textContent("#ai-image-meta-provider")) || "").includes("OpenCode-compatible"),
      "OpenCode success result is labelled with the compatible provider"
    );
    await page.click("#ai-image-add");
    await waitForText(page, "#ai-image-add", "Added to scene");
    const customSpritesAfterOpenCode = await page.evaluate(() =>
      window.ObliqueAI.listSpriteTypes().filter(type => type.custom)
    );
    equal(customSpritesAfterOpenCode.length, 2, "OpenCode success adds a second image to the scene");

    await closeDrawer();
    await openScenes();
    await page.fill("#scene-name", "ai-smoke-scene");
    await page.click("#save-scene");
    await waitForText(page, "#scene-message", "Updated");

    const exportDownloadPromise = page.waitForEvent("download");
    await page.click("#export-document");
    const exportDownload = await exportDownloadPromise;
    const exportPath = await exportDownload.path();
    const exportText = fs.readFileSync(exportPath, "utf8");
    const exported = JSON.parse(exportText);
    equal(exported.format, "oblique-playground-document", "document export is valid JSON");
    check(exported.scenes.some(scene => scene.name === "ai-smoke-scene"), "export includes the saved AI scene");
    check(exportText.includes("custom-"), "export references generated sprite ids");
    check(!exportText.includes(MESHY_KEY), "exported document contains no Meshy key");
    check(!exportText.includes(OPENCODE_KEY), "exported document contains no OpenCode key");

    check(!page.url().includes(MESHY_KEY) && !page.url().includes(OPENCODE_KEY), "page URL contains no keys");
    check(
      !requestUrls.join("\n").includes(MESHY_KEY) && !requestUrls.join("\n").includes(OPENCODE_KEY),
      "captured request URLs contain no keys"
    );
    const consoleText = consoleLines.map(line => line.text).join("\n");
    check(!consoleText.includes(MESHY_KEY), "captured console output contains no Meshy key");
    check(!consoleText.includes(OPENCODE_KEY), "captured console output contains no OpenCode key");
    equal(pageErrors.join(" | "), "", "no unhandled page errors or rejections");

    await openDrawer("settings");
    await page.click("#ai-forget-all");
    await page.waitForFunction(() => document.getElementById("ai-meshy-key").value === "");
    equal(await page.inputValue("#ai-meshy-key"), "", "Forget all clears the Meshy key field");
    equal(await page.inputValue("#ai-opencode-key"), "", "Forget all clears the OpenCode key field");
    check(await page.evaluate(key => localStorage.getItem(key) === null, SETTINGS_STORAGE_KEY), "Forget all removes localStorage settings");
    check(await page.evaluate(key => sessionStorage.getItem(key) === null, SETTINGS_STORAGE_KEY), "Forget all removes sessionStorage settings");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.ObliqueAI.ready);
    await openDrawer("settings");
    equal(await page.inputValue("#ai-meshy-key"), "", "Meshy key stays forgotten after reload");
    equal(await page.inputValue("#ai-opencode-key"), "", "OpenCode key stays forgotten after reload");
    check(
      await page.evaluate(() => window.ObliqueAI.listSpriteTypes().filter(type => type.custom).length === 2),
      "generated sprites still restore after the final reload"
    );

    check(meshyImagePolls >= 1, "Meshy image task was polled");
    check(meshyThreePolls >= 1, "Meshy 3D task was polled");

    console.log(`\n${checks.length} checks passed.`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error("\nAI smoke test failed:");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
