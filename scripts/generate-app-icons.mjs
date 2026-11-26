// Builds store-ready icons from the client's logo (public/brand/anvira-logo.png).
// The logo's tagline is cropped off; only the "AS · ANVIRA SERVICES" mark is used.
// Usage: node scripts/generate-app-icons.mjs  (set CHROMIUM_EXECUTABLE if needed)
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const source = await readFile("public/brand/anvira-logo.png");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});
const page = await browser.newPage();
await page.setContent("<body></body>");
const outputs = await page.evaluate(
  async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scan = document.createElement("canvas");
    scan.width = img.width;
    scan.height = img.height;
    const sctx = scan.getContext("2d");
    sctx.drawImage(img, 0, 0);
    const { data } = sctx.getImageData(0, 0, img.width, img.height);
    const dark = (x, y) => data[(y * img.width + x) * 4] < 128;
    // The tagline sits in the bottom band; find the gap above it.
    const rowHas = (y) => {
      for (let x = 0; x < img.width; x += 2) if (dark(x, y)) return true;
      return false;
    };
    let y = img.height - 1;
    while (y > 0 && !rowHas(y)) y--; // bottom of tagline
    while (y > 0 && rowHas(y)) y--; // top of tagline
    while (y > 0 && !rowHas(y)) y--; // bottom of the mark
    const markBottom = y;
    let top = 0;
    while (!rowHas(top)) top++;
    let left = img.width,
      right = 0;
    for (let yy = top; yy <= markBottom; yy++)
      for (let x = 0; x < img.width; x++)
        if (dark(x, yy)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    const box = {
      x: left,
      y: top,
      w: right - left + 1,
      h: markBottom - top + 1,
    };
    // Mark as an alpha mask: dark logo pixels stay, white becomes transparent.
    const mask = document.createElement("canvas");
    mask.width = box.w;
    mask.height = box.h;
    const mctx = mask.getContext("2d");
    mctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const m = mctx.getImageData(0, 0, box.w, box.h);
    for (let i = 0; i < m.data.length; i += 4) {
      const lum = (m.data[i] + m.data[i + 1] + m.data[i + 2]) / 3;
      // Off-white JPEG noise in the source becomes fully transparent.
      m.data[i + 3] = Math.max(0, Math.min(255, ((225 - lum) * 255) / 175));
      m.data[i] = m.data[i + 1] = m.data[i + 2] = 0;
    }
    mctx.putImageData(m, 0, 0);
    function render(size, markWidth, background, color = "#0B0B0B") {
      const out = document.createElement("canvas");
      out.width = out.height = size;
      const ctx = out.getContext("2d");
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      }
      const tinted = document.createElement("canvas");
      tinted.width = box.w;
      tinted.height = box.h;
      const tctx = tinted.getContext("2d");
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = color;
      tctx.fillRect(0, 0, box.w, box.h);
      const w = markWidth,
        h = (box.h / box.w) * w;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(tinted, (size - w) / 2, (size - h) / 2, w, h);
      return out.toDataURL("image/png");
    }
    return {
      box,
      // iOS/App Store icon: opaque, no transparency allowed.
      icon: render(1024, 800, "#FFFFFF"),
      // Android adaptive icon: keep the mark inside the 66% safe zone.
      foreground: render(1024, 600, null),
      monochrome: render(1024, 600, null),
      splash: render(1024, 960, null),
      web512: render(512, 400, "#FFFFFF"),
      web192: render(192, 150, "#FFFFFF"),
    };
  },
  "data:image/png;base64," + source.toString("base64"),
);
await browser.close();
const save = (path, url) =>
  writeFile(path, Buffer.from(url.split(",")[1], "base64"));
await save("assets/icon.png", outputs.icon);
await save("assets/android-icon-foreground.png", outputs.foreground);
await save("assets/android-icon-monochrome.png", outputs.monochrome);
await save("assets/splash-icon.png", outputs.splash);
await save("public/brand/anvira-icon-512.png", outputs.web512);
await save("public/brand/anvira-icon-192.png", outputs.web192);
console.log("Logo mark crop:", outputs.box);
