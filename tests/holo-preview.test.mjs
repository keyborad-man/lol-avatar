import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "../vendor/three/three.module.min.js";
import { HoloPreview } from "../holo-preview.mjs";

function previewHarness(t) {
  const pending = new Map();
  t.mock.method(THREE.TextureLoader.prototype, "loadAsync", (url) => new Promise((resolve, reject) => pending.set(url, { resolve, reject })));
  t.mock.method(globalThis, "cancelAnimationFrame", () => {}, { times: Infinity });
  const preview = Object.assign(Object.create(HoloPreview.prototype), {
    stage: { classList: { remove() {}, toggle() {} } },
    uniforms: { uImage: { value: null } },
    renderer: { capabilities: { getMaxAnisotropy: () => 8 } },
    revision: 0, frame: null, enabled: true,
    printId(id) { this.printedId = id; }, reset() {}, refresh() {},
  });
  return { preview, pending };
}

// These asset-lifecycle checks do not need a browser or GPU.
globalThis.cancelAnimationFrame ??= () => {};

test("a late image cannot replace the newly selected icon", async (t) => {
  const { preview, pending } = previewHarness(t);
  const oldTexture = new THREE.Texture(), newTexture = new THREE.Texture();
  let disposed = false;
  oldTexture.addEventListener("dispose", () => { disposed = true; });
  const old = preview.show("old.png", 29), current = preview.show("new.png", 10005);
  pending.get("new.png").resolve(newTexture);
  assert.equal(await current, true);
  pending.get("old.png").resolve(oldTexture);
  assert.equal(await old, false);
  assert.equal(preview.printedId, 10005);
  assert.equal(preview.uniforms.uImage.value, newTexture);
  assert.equal(disposed, true);
});

test("closing while loading releases the late texture and keeps the preview closed", async (t) => {
  const { preview, pending } = previewHarness(t);
  const texture = new THREE.Texture();
  let disposed = false;
  texture.addEventListener("dispose", () => { disposed = true; });
  const loading = preview.show("icon.png", 29);
  preview.hide();
  pending.get("icon.png").resolve(texture);
  assert.equal(await loading, false);
  assert.equal(disposed, true);
  assert.equal(preview.active, false);
  assert.equal(preview.uniforms.uImage.value, null);
});

test("an old failed load cannot hide a reopened preview of the same icon", async (t) => {
  const { preview, pending } = previewHarness(t);
  const old = preview.show("old-request.png", 29);
  preview.hide();
  const current = preview.show("new-request.png", 29);
  const texture = new THREE.Texture();
  pending.get("new-request.png").resolve(texture);
  await current;
  pending.get("old-request.png").reject(new Error("The old connection failed"));
  assert.equal(await old, false);
  assert.equal(preview.uniforms.uImage.value, texture);
  assert.equal(preview.active, true);
});

test("replacing an image and closing release GPU texture resources", async (t) => {
  const { preview, pending } = previewHarness(t);
  const textures = [new THREE.Texture(), new THREE.Texture()];
  let disposed = 0;
  textures.forEach((texture) => texture.addEventListener("dispose", () => { disposed += 1; }));
  for (let i = 0; i < textures.length; i++) {
    const loading = preview.show(String(i), i);
    pending.get(String(i)).resolve(textures[i]);
    await loading;
  }
  assert.equal(disposed, 1);
  preview.hide();
  assert.equal(disposed, 2);
});

test("reduced motion is static and hidden or disabled previews stop drawing", (t) => {
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame ??= () => 1;
  t.after(() => { delete globalThis.document; });
  let renders = 0, frames = 0;
  t.mock.method(globalThis, "requestAnimationFrame", () => { frames++; return 1; });
  const preview = Object.assign(Object.create(HoloPreview.prototype), {
    stage: { clientWidth: 400, clientHeight: 460 }, active: true, enabled: true, frame: null,
    uniforms: { uImage: { value: new THREE.Texture() }, uTime: { value: 10 }, uView: { value: new THREE.Vector3() } },
    renderer: { setSize() {}, render() { renders++; } },
    camera: new THREE.PerspectiveCamera(32, 1, .1, 100), card: new THREE.Group(),
    target: new THREE.Vector2(.2, .3), inverseRotation: new THREE.Quaternion(),
    reduced: { matches: true }, auto: false, elapsed: 10, lastTime: 0,
  });
  preview.camera.position.z = 9;
  preview.refresh();
  assert.equal(renders, 1);
  assert.equal(frames, 0);
  assert.equal(preview.uniforms.uTime.value, 0);
  assert.equal(preview.card.rotation.x, 0);
  preview.reduced.matches = false;
  preview.refresh();
  assert.equal(frames, 1);
  const before = renders;
  document.hidden = true;
  preview.refresh();
  assert.equal(renders, before);
  assert.equal(preview.frame, null);
  document.hidden = false;
  preview.enabled = false;
  preview.refresh();
  assert.equal(renders, before);
});
