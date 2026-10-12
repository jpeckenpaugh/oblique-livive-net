/**
 * Procedural Offscreen Tile Texture Generation.
 * Pre-renders grass, dirt, and sand variants to offscreen canvases.
 */
import { TILE_SIZE } from '../core/constants.js';

export function makePrng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function createOffscreenTile(drawFn) {
  const oc = document.createElement('canvas');
  oc.width = TILE_SIZE;
  oc.height = TILE_SIZE;
  const octx = oc.getContext('2d');
  drawFn(octx);
  return oc;
}

export const tileCanvases = {
  grass: [
    // Variant 0: Standard meadow
    createOffscreenTile(c => {
      const rand = makePrng(101);
      c.fillStyle = '#2d5e38';
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 90; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#244d2e' : '#377345';
        c.fillRect(px, py, 1, 1);
      }
      for (let i = 0; i < 7; i++) {
        const bx = Math.floor(rand() * 56) + 4;
        const by = Math.floor(rand() * 56) + 4;
        c.fillStyle = '#469156';
        c.fillRect(bx, by, 1, 2);
        c.fillRect(bx + 1, by - 1, 1, 3);
        c.fillRect(bx + 2, by, 1, 2);
      }
    }),
    // Variant 1: Lush with tiny wildflowers
    createOffscreenTile(c => {
      const rand = makePrng(202);
      c.fillStyle = '#2b5a36';
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 90; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#22472b' : '#397848';
        c.fillRect(px, py, 1, 1);
      }
      for (let i = 0; i < 8; i++) {
        const bx = Math.floor(rand() * 56) + 4;
        const by = Math.floor(rand() * 56) + 4;
        c.fillStyle = '#489458';
        c.fillRect(bx, by, 1, 2);
        c.fillRect(bx + 1, by - 1, 1, 3);
      }
      c.fillStyle = '#fef08a'; // Buttercup
      c.fillRect(18, 22, 2, 2);
      c.fillStyle = '#ffffff'; // Daisy
      c.fillRect(44, 38, 2, 2);
    }),
    // Variant 2: Dense blade patches
    createOffscreenTile(c => {
      const rand = makePrng(303);
      c.fillStyle = '#2f633b';
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 95; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#244d2e' : '#3b7d4a';
        c.fillRect(px, py, 1, 1);
      }
      for (let i = 0; i < 9; i++) {
        const bx = Math.floor(rand() * 56) + 4;
        const by = Math.floor(rand() * 56) + 4;
        c.fillStyle = '#4ea05f';
        c.fillRect(bx, by, 1, 3);
        c.fillRect(bx + 1, by + 1, 1, 2);
      }
    })
  ],
  dirt: [
    // Variant 0: Fine packed earth
    createOffscreenTile(c => {
      const rand = makePrng(404);
      c.fillStyle = '#735137';
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 110; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#5b3f2a' : '#8a6345';
        c.fillRect(px, py, 1, 1);
      }
      for (let i = 0; i < 4; i++) {
        const pbx = Math.floor(rand() * 54) + 4;
        const pby = Math.floor(rand() * 54) + 4;
        c.fillStyle = '#483120';
        c.fillRect(pbx, pby, 2, 2);
        c.fillStyle = '#9e7352';
        c.fillRect(pbx, pby - 1, 2, 1);
      }
    }),
    // Variant 1: Trail path with central wear
    createOffscreenTile(c => {
      const rand = makePrng(505);
      c.fillStyle = '#6e4c33';
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = 'rgba(74, 50, 33, 0.4)';
      c.fillRect(16, 0, 32, 64);
      for (let i = 0; i < 110; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#583c27' : '#886142';
        c.fillRect(px, py, 1, 1);
      }
      for (let i = 0; i < 5; i++) {
        const pbx = Math.floor(rand() * 54) + 4;
        const pby = Math.floor(rand() * 54) + 4;
        c.fillStyle = '#47301f';
        c.fillRect(pbx, pby, 2, 2);
      }
    })
  ],
  sand: [
    // Variant 0: Golden beach sand with granular specks
    createOffscreenTile(c => {
      const rand = makePrng(606);
      c.fillStyle = '#d4a373';
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 125; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#be8c5c' : '#e6be8b';
        c.fillRect(px, py, 1, 1);
      }
      // Tiny seashell flecks
      c.fillStyle = '#fff4e6';
      c.fillRect(22, 34, 2, 1);
      c.fillRect(48, 16, 1, 2);
    }),
    // Variant 1: Shoreline sand with gentle drift grain
    createOffscreenTile(c => {
      const rand = makePrng(707);
      c.fillStyle = '#d19e6d';
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 125; i++) {
        const px = Math.floor(rand() * 64);
        const py = Math.floor(rand() * 64);
        c.fillStyle = rand() > 0.5 ? '#ba8856' : '#e4bb87';
        c.fillRect(px, py, 1, 1);
      }
      c.fillStyle = 'rgba(182, 132, 82, 0.35)';
      c.fillRect(0, 26, 64, 2);
      c.fillStyle = '#fff9f0';
      c.fillRect(38, 46, 2, 1);
    })
  ]
};
