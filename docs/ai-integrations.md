# AI integrations

Oblique's Playground includes an **AI Studio** drawer for generating 2D images and 3D models from the browser. There is no Oblique backend and no relay: all provider requests go directly from the page to the provider you configure. Keys stay in this browser profile.

Open the drawer with the **AI** button in the Playground toolbar.

| Provider | What it does | Current browser support |
| --- | --- | --- |
| **Meshy** | Text to Image and Text to 3D tasks, balance check, GLB download. | Works directly from `oblique.livive.net`; the API returns CORS headers for this origin. |
| **OpenCode-compatible endpoint** | OpenAI-style image generation through a configurable base URL, key, and model. | Only works with an endpoint that serves an image model **and** sends CORS headers. The official OpenCode API does neither today. |

## Meshy

### Setup

1. Create an account at [meshy.ai](https://www.meshy.ai/) and open the [developer keys page](https://www.meshy.ai/developers/keys).
2. Create an API key. Meshy keys start with `msy_`.
3. In Oblique, open **AI → Settings → Meshy**, paste the key, leave **Remember on this device** checked if this is your own machine, and click **Test and show balance**.
4. The test calls `GET /openapi/v1/balance` and reports the credits available. It does not start a generation.

### Images

The **Image** tab sends a Meshy Text to Image task. Choose a model, aspect ratio, and optionally **Remove background**. Models exposed in the UI are `nano-banana`, `nano-banana-2`, `nano-banana-2-lite`, `nano-banana-pro`, `gpt-image-2`, `gpt-image-2-5-flare`, and `gpt-image-2-5-sunburst`.

Image generation is asynchronous:

1. `POST /openapi/v1/text-to-image` returns a task id.
2. Oblique polls `GET /openapi/v1/text-to-image/:id` and shows task progress.
3. When the task succeeds, the image is downloaded into a local blob. **Add to scene** stores the PNG in IndexedDB, registers it as a custom sprite, and places it near the player. The sprite also survives a page reload and appears in the sprite picker.

For game-ready props, enable **Remove background**. Meshy returns a transparent RGBA PNG, which becomes a normal single-frame Oblique sprite.

### 3D

The **3D** tab sends a Meshy Text to 3D task:

1. Generate a **Preview** with a prompt and a `meshy-4` or `meshy-5` model.
2. Optionally switch **Stage** to **Refine** and generate again. Refine reuses the last successful preview task.
3. The result card provides thumbnails plus **Download GLB** and **Open GLB**.

Oblique does not bake the GLB into a 2.5D sprite sheet. Downloads may open the signed URL in a new tab if the asset host blocks a browser download.

### Signed asset URLs

Meshy returns signed, expiring URLs for images and GLBs. Download or store the asset while the task is fresh. If a URL has expired, generate the asset again; the app cannot mint a new URL from a stored one.

## OpenCode-compatible endpoints

> **The official OpenCode API cannot generate images from this site today.** It has **no image models**, it **locks free models to the OpenCode client**, and its inference endpoints **do not send CORS headers**. A standalone browser app therefore cannot call the official OpenCode image/completions endpoints, even with a paid key.

The **OpenCode-compatible endpoint** provider is a direct client for an OpenAI-compatible image API that does send CORS headers. It is not a relay and does not proxy through Oblique.

### Setup

1. In **AI → Settings → OpenCode-compatible endpoint**, enter:
   - **Base URL**: an OpenAI-compatible API root, for example `https://your-gateway.example.com/v1`. The default is the official `https://opencode.ai/inference/openai/v1`.
   - **API key**: the key for that endpoint.
   - **Model**: an image-capable model id exposed by that endpoint.
2. Click **Test connection**. Oblique reads `<base URL>/models` (for the official base URL it reads the public catalog), detects image models, and reports the exact failure when the endpoint is blocked or has no image model.
3. On the **Image** tab, choose **OpenCode-compatible endpoint**, enter a prompt, and generate.

### What you need for OpenCode images

Either:

- a **CORS-enabled OpenCode-compatible image endpoint** (a gateway or provider that serves `/images/generations` with an image model and returns `Access-Control-Allow-Origin`), or
- a future OpenCode provider change that adds image models, lifts the client lock on free models, and sends CORS headers.

No relay is included in this repository. The official OpenCode base URL will show `OPENCODE_CORS_BLOCKED` or `OPENCODE_NO_IMAGE_MODEL` instead of issuing a broken request. The UI disables **Generate** in that state.

## Credential security

- With **Remember on this device** enabled, keys are stored in `localStorage["oblique.ai.settings.v1"]`.
- With it disabled, keys are stored in `sessionStorage` for the current tab only and are cleared when the tab closes.
- Non-secret settings (base URL, model, provider, remember flags) remain in `localStorage`.
- **Forget all keys** removes both storage entries and clears the settings form. It does not delete generated assets from IndexedDB; delete those separately in browser site data.
- `localStorage` is not a vault. Any script running on this origin can read a remembered key. Oblique loads no third-party scripts today, but treat a stored key as spendable by anyone with access to this browser profile.
- On a shared or public machine, leave **Remember on this device** unchecked and use **Forget all keys** before leaving.
- Keys are never written to scene data, exported documents, URLs, query strings, console logs, or error messages. Scene JSON stores only sprite/asset ids.
- Generated binaries are stored in IndexedDB (`oblique-ai` / `assets`), not as base64 in `localStorage`.

## Costs and rate limits

- **Meshy images** cost roughly **3–9 credits** each, depending on model and options.
- **Meshy 3D** starts at about **5 credits**; a preview plus refine costs more than a preview alone.
- The Meshy free plan includes around **100 credits per month**; API credits may be billed separately. Check **Test and show balance** before generating.
- Meshy rate limits return HTTP 429 with `Retry-After`. The client honors it while polling and shows a rate-limit error instead of retrying forever.
- **OpenCode-compatible endpoints** set their own prices and limits. A paid key bills tokens or per-request image costs to that account. Check the endpoint's balance and rate-limit behavior; `429` responses are surfaced with the retry window when provided.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| **401 / 403** | The key was rejected. Recheck the key at the provider, then clear and re-enter it in Settings. For Meshy use the developer keys page; for OpenCode check the endpoint's key. |
| **402** | The account has no credits. Add credits or use another provider. Oblique shows the balance test result for Meshy. |
| **429** | Rate limited. Wait for `Retry-After`; Meshy polling backs off automatically. Reduce generation frequency. |
| **`OPENCODE_CORS_BLOCKED`** | The browser could not call that endpoint. Use a CORS-enabled base URL or a gateway that sends `Access-Control-Allow-Origin` for this origin. The official OpenCode inference endpoints currently do not. |
| **`OPENCODE_NO_IMAGE_MODEL`** | The endpoint is reachable but its catalog/response has no image model. Point it at an image-capable provider. |
| **Meshy asset URL expired** | Signed CloudFront URLs expire. Generate again or download while the result is fresh. |
| **`ASSET_TOO_LARGE`** | A generated asset exceeds the 50 MB per-asset limit. Generate something smaller or download it instead of adding it to the scene. |
| **`ASSET_STORAGE_UNAVAILABLE` / quota errors** | IndexedDB is blocked or full. Close other Oblique tabs, free browser storage, or allow site data for this origin. |
| **Image preview works, Add to scene is disabled** | The asset host blocked the browser download, so no blob is available. Use a provider/asset host that permits CORS, or download the image directly. |
| **GLB download opens a tab** | The file host blocked the blob download. Save the GLB from the opened tab. |

## Tests

The mocked AI smoke test uses Playwright route interception for Meshy and OpenCode. It needs no network, no real keys, and no provider account:

```sh
cd test-runner
npm install
npm run test:ai
```

It covers the drawer and focus behavior, key persistence and forget-all, mocked image generation and scene placement, mocked GLB download, OpenCode CORS/no-model diagnostics, OpenCode success against a mocked CORS-enabled endpoint, and checks that no key appears in scene storage, exports, URLs, or console output.

The existing `npm test` demo runner is unchanged and still produces the demo video and gallery.
