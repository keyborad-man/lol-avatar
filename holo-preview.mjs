import * as THREE from "./vendor/three/three.module.min.js";

// Noise, spectrum, overlay and view-dependent foil adapted from Holo Card Studio (MIT).
// See THIRD_PARTY_NOTICES.md for attribution and the original license.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const foilShader = `
  uniform sampler2D uImage;
  uniform vec3 uView;
  uniform float uTime, uStrength;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 spectrum(float t) {
    return .55 + .45 * cos(6.283185 * (t + vec3(0.0, .33, .67)));
  }
  vec3 overlay(vec3 b, vec3 f) {
    return mix(2.0 * b * f, 1.0 - 2.0 * (1.0 - b) * (1.0 - f), step(vec3(.5), b));
  }
  void main() {
    vec2 uv = vUv;
    vec3 art = texture2D(uImage, uv).rgb;
    vec2 view = uView.xy / max(uView.z, .4);
    vec2 p = uv + view * 1.8;
    float wave = dot(p, vec2(.85, -.53)) * 1.4 + noise(p * 2.2) * .7;
    vec3 rainbow = spectrum(wave);
    float sweep = pow(.5 + .5 * sin((uv.x * .83 + uv.y * .35 + view.x * 1.8 + view.y * .9) * 6.283), 16.0);
    float grain = noise(uv * 180.0);
    float grooves = .5 + .5 * sin((uv.x + uv.y * .7) * 1100.0);
    vec3 color = mix(art, overlay(art, rainbow), uStrength * (.32 + grain * .08));
    color += rainbow * sweep * uStrength * (.20 + grooves * .08);
    // Restrict the highlight so the original illustration keeps its contrast.
    vec2 light = vec2(.5) + view * vec2(-.7, -.7);
    float glare = exp(-length((uv - light) * vec2(1.0, 1.4)) * 7.0);
    color += vec3(.8, .9, 1.0) * glare * uStrength * .10;
    gl_FragColor = vec4(pow(max(color, vec3(0)), vec3(2.2)), 1.0);
    #include <colorspace_fragment>
  }
`;

const sparkleShader = `
  uniform vec3 uView;
  uniform float uTime, uStrength;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float glitter(vec2 uv, float density, float threshold, float crossSize) {
    vec2 cell = floor(uv * density), local = fract(uv * density);
    vec2 point = .2 + .6 * vec2(hash(cell), hash(cell + 37.1));
    vec2 d = abs(local - point);
    float phase = hash(cell + 71.0) * 30.0 + dot(uView.xy, vec2(27.0, 21.0));
    float twinkle = pow(.5 + .5 * sin(uTime * 1.9 + phase), 10.0);
    float dotLight = exp(-length(d) * (density > 30.0 ? 11.0 : 28.0));
    float crossLight = exp(-min(d.x, d.y) * 55.0) * exp(-max(d.x, d.y) * 5.0);
    return step(threshold, hash(cell + 8.8)) * twinkle * (dotLight + crossLight * crossSize);
  }
  void main() {
    float fine = glitter(vUv, 75.0, .82, .15);
    float stars = glitter(vUv, 13.0, .86, 1.7);
    float light = (fine + stars) * uStrength * 1.25;
    gl_FragColor = vec4(vec3(.72, .87, 1.0), min(light, .95));
  }
`;

function roundedShape(width, height, radius) {
  const x = -width / 2, y = -height / 2;
  return new THREE.Shape().moveTo(x + radius, y)
    .lineTo(x + width - radius, y).quadraticCurveTo(x + width, y, x + width, y + radius)
    .lineTo(x + width, y + height - radius).quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    .lineTo(x + radius, y + height).quadraticCurveTo(x, y + height, x, y + height - radius)
    .lineTo(x, y + radius).quadraticCurveTo(x, y, x + radius, y);
}

export class HoloPreview {
  constructor(stage) {
    this.stage = stage;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.enabled = true;
    this.active = false;
    this.auto = !this.reduced.matches;
    this.target = new THREE.Vector2(.06, -.20);
    this.revision = 0;
    this.elapsed = 0;
    this.lastTime = 0;
    this.frame = null;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "holo-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    stage.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
    this.camera.position.z = 9;
    this.card = new THREE.Group();
    this.scene.add(this.card, new THREE.HemisphereLight(0xe2f5ff, 0x283042, 2.2));
    [[0xffedcf, 3, -3, 5, 7], [0x82e9ff, 2, 5, -1, 4], [0xcaafff, 1.4, -4, -2, 2]].forEach(([color, power, x, y, z]) => {
      const light = new THREE.DirectionalLight(color, power);
      light.position.set(x, y, z);
      this.scene.add(light);
    });
    this.uniforms = {
      uImage: { value: null }, uTime: { value: 0 }, uStrength: { value: .65 },
      uView: { value: new THREE.Vector3(0, 0, 1) },
    };
    this.inverseRotation = new THREE.Quaternion();
    const gold = new THREE.MeshStandardMaterial({ color: 0xd6c293, metalness: .8, roughness: .24 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b1725, metalness: .55, roughness: .3 });
    const body = new THREE.ExtrudeGeometry(roundedShape(3.5, 4.35, .14), {
      depth: .065, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 3, steps: 1, curveSegments: 10,
    });
    this.card.add(new THREE.Mesh(body, [dark, gold]));
    this.addRim(3.49, 4.34, .135, .034, .10, gold);
    this.addRim(3.38, 4.23, .09, .012, .105, new THREE.MeshBasicMaterial({ color: 0x799aaf }));
    const artRim = this.addRim(3.19, 3.19, .03, .025, .13, gold);
    artRim.position.y = .16;

    const artGeometry = new THREE.PlaneGeometry(3.14, 3.14);
    this.art = new THREE.Mesh(artGeometry, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader: foilShader }));
    this.art.position.set(0, .16, .105);
    this.card.add(this.art);
    const film = new THREE.Mesh(artGeometry, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader: sparkleShader,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    film.position.set(0, .16, .18);
    this.card.add(film);

    this.printCanvas = document.createElement("canvas");
    this.printCanvas.width = 700;
    this.printCanvas.height = 870;
    this.printTexture = new THREE.CanvasTexture(this.printCanvas);
    this.printTexture.colorSpace = THREE.SRGBColorSpace;
    const print = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 4.35), new THREE.MeshBasicMaterial({
      map: this.printTexture, transparent: true, depthWrite: false, toneMapped: false,
    }));
    print.position.z = .145;
    this.card.add(print);
    new ResizeObserver(() => this.refresh()).observe(stage);
    document.addEventListener("visibilitychange", () => this.refresh());
    this.reduced.addEventListener("change", () => { this.reset(); this.refresh(); });
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.hide();
      stage.dispatchEvent(new Event("holo-unavailable"));
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      stage.dispatchEvent(new Event("holo-restored"));
    });
  }

  addRim(width, height, radius, thickness, z, material) {
    const shape = roundedShape(width, height, radius);
    shape.holes.push(roundedShape(width - thickness * 2, height - thickness * 2, Math.max(.01, radius - thickness)));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: .018, bevelEnabled: false, steps: 1, curveSegments: 10,
    }), material);
    mesh.position.z = z;
    this.card.add(mesh);
    return mesh;
  }

  printId(id) {
    const ctx = this.printCanvas.getContext("2d");
    ctx.clearRect(0, 0, 700, 870);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e4d3a8";
    ctx.font = "18px Georgia, serif";
    ctx.fillText("L E A G U E   O F   L E G E N D S", 350, 56);
    ctx.fillStyle = "#91acbd";
    ctx.font = "15px sans-serif";
    ctx.fillText("S U M M O N E R   I C O N", 350, 766);
    ctx.fillStyle = "#eeddb0";
    ctx.font = "34px Georgia, serif";
    ctx.fillText(`#${id}`, 350, 811);
    this.printTexture.needsUpdate = true;
  }

  async show(url, id) {
    const revision = ++this.revision;
    this.active = true;
    this.stage.classList.remove("webgl-ready");
    let texture;
    try {
      texture = await new THREE.TextureLoader().loadAsync(url);
    } catch (error) {
      if (!this.active || revision !== this.revision) return false;
      throw error;
    }
    if (!this.active || revision !== this.revision) { texture.dispose(); return false; }
    this.uniforms.uImage.value?.dispose();
    this.uniforms.uImage.value = texture;
    // The shader blends in print color space before converting to linear output.
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
    this.printId(id);
    this.reset();
    this.refresh();
    this.stage.classList.toggle("webgl-ready", this.enabled);
    return true;
  }

  hide() {
    this.active = false;
    ++this.revision;
    cancelAnimationFrame(this.frame);
    this.frame = null;
    this.lastTime = 0;
    this.stage.classList.remove("webgl-ready");
    this.uniforms.uImage.value?.dispose();
    this.uniforms.uImage.value = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.stage.classList.toggle("webgl-ready", Boolean(enabled && this.active && this.uniforms.uImage.value));
    this.refresh();
  }

  setStrength(value) { this.uniforms.uStrength.value = value; if (this.frame === null) this.refresh(); }
  setAuto(value) { this.auto = value && !this.reduced.matches; if (this.frame === null) this.refresh(); }
  setPointer(x, y) {
    this.auto = false;
    this.target.set((y - 50) / 50 * .32, (x - 50) / 50 * .5);
    if (this.frame === null) this.refresh();
  }
  reset() {
    this.target.set(.06, -.20);
    this.card.rotation.set(this.reduced.matches ? 0 : .06, this.reduced.matches ? 0 : -.20, 0);
  }

  refresh() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    if (!this.active || !this.enabled || !this.uniforms.uImage.value || document.hidden) { this.lastTime = 0; return; }
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    if (!width || !height) return;
    if (this.width !== width || this.height !== height) {
      this.width = width; this.height = height;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    this.draw(performance.now());
  }

  draw(now) {
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, .05) : 0;
    this.lastTime = now;
    if (!this.reduced.matches) this.elapsed += dt;
    if (this.auto) this.target.set(Math.sin(this.elapsed * .65) * .15, Math.sin(this.elapsed * .48) * .38);
    const ease = 1 - Math.exp(-dt * 9);
    this.card.rotation.x += (this.target.x - this.card.rotation.x) * ease;
    this.card.rotation.y += (this.target.y - this.card.rotation.y) * ease;
    if (this.reduced.matches) this.card.rotation.set(0, 0, 0);
    this.card.updateMatrixWorld(true);
    this.uniforms.uView.value.copy(this.camera.position).applyQuaternion(this.inverseRotation.copy(this.card.quaternion).invert()).normalize();
    this.uniforms.uTime.value = this.reduced.matches ? 0 : this.elapsed;
    this.renderer.render(this.scene, this.camera);
    if (!this.reduced.matches) this.frame = requestAnimationFrame((time) => this.draw(time));
  }
}
