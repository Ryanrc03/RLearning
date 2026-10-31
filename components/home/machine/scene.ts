import {
  AdditiveBlending, AmbientLight, BoxGeometry, CanvasTexture, CatmullRomCurve3, Color, CylinderGeometry,
  DirectionalLight, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PointLight, Scene, Sprite, SpriteMaterial,
  SRGBColorSpace, Texture, TorusGeometry, Vector3, WebGLRenderer,
  type BufferGeometry, type Material, type MeshStandardMaterialParameters, type Object3D,
} from "three";
import { grpoPhases, type PacketPath, type PartId } from "@/content/machine";
import type { SimState } from "./sim";

export type SceneOptions = { pixelRatio: number; animate: boolean };
export type ScreenPoint = { x: number; y: number; visible: boolean };
export type MachineScene = {
  /** Draw one frame for this state; nowMs drives RGB, fans and packets. */
  render(state: SimState, nowMs: number): void;
  /** Where a part's label anchor lands on the canvas, in CSS pixels. */
  partScreenPosition(id: PartId): ScreenPoint;
  resize(width: number, height: number): void;
  orbitBy(dxPx: number, dyPx: number): void;
  dispose(): void;
};

// three r155+ measures light in physical units; × π reproduces the r128 prototype's intensities. Tune by eye.
const AMBIENT_INTENSITY = 0.55 * Math.PI;
const DIRECTIONAL_INTENSITY = 0.55 * Math.PI;
const CYAN_POINT_INTENSITY = 0.8 * Math.PI;
const VIOLET_POINT_INTENSITY = 0.35 * Math.PI;
const POINT_DECAY = 0;

const BACKGROUND = 0x05070d;
// Aimed below the case's center so the case sits above the HUD strip at the bottom of the panel.
const TARGET = new Vector3(0, -7, 0);
const FOV = 35;
/** Half-extents (scene units) that must stay in view, labels included; the camera backs off to fit narrow panels. */
const FIT_HALF_HEIGHT = 40;
const FIT_HALF_WIDTH = 34;
const IDLE_AZ = 0.62;
const IDLE_EL = 0.3;
const IDLE_AFTER_MS = 2500;
/** RGB hue of a still frame: the case light's cyan. */
const STILL_HUE = 0.55;
/** The prototype's per-frame rates assume a 16 ms frame. */
const FRAME_MS = 16;
const MAX_DT_MS = 100;
const PACKET_POOL = 44;
const PCB_SEED = 0x7e5;

const partAnchors: Record<PartId, Vector3> = {
  cpu: new Vector3(-14, 12, -3.4),
  ram: new Vector3(13.6, 18.8, -6.5),
  gpu: new Vector3(-16.5, 0.5, 2.4),
  ssd: new Vector3(6, 4.2, -9.4),
  psu: new Vector3(-13, -16, 10),
  hdd: new Vector3(13, -16, 10),
};

const curve = (...points: [number, number, number][]) =>
  new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));

const packetCurves: Record<PacketPath, CatmullRomCurve3> = {
  ssdToRam: curve([2, 4.2, -9], [8, 8, -6.5], [12.9, 12, -6.4]),
  ramToGpu: curve([12.9, 10, -6.4], [7, -1.8, -8.6], [-3, -1.8, -8.6], [-3, 0.6, 1]),
  gpuLoop: curve([-15, 0.4, 2.9], [-6, 1.8, 2.9], [3, -0.6, 2.9], [9.5, 0.6, 2.9]),
  gpuToCpu: curve([-3, 2.6, -2], [-2, 6.5, -7.5], [-2, 12, -8.6]),
};

/** Seeded PRNG so the motherboard traces look the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Packet = { sprite: Sprite; curve: CatmullRomCurve3; t: number; durationMs: number; jitter: number; on: boolean };

/** Requires WebGL2: three r187 throws on WebGL1 or when the context can't be created, so callers must catch. */
export function createMachineScene(canvas: HTMLCanvasElement, options: SceneOptions): MachineScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(options.pixelRatio);
  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 500);

  scene.add(new AmbientLight(0x8090c0, AMBIENT_INTENSITY));
  const sun = new DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
  sun.position.set(30, 50, 40);
  const cyan = new PointLight(0x4cc9ff, CYAN_POINT_INTENSITY, 60, POINT_DECAY);
  cyan.position.set(-4, 12, 5);
  const violet = new PointLight(0x7852ee, VIOLET_POINT_INTENSITY, 50, POINT_DECAY);
  violet.position.set(8, -6, 6);
  scene.add(sun, cyan, violet);

  const place = <T extends Object3D>(object: T, x: number, y: number, z: number) => {
    object.position.set(x, y, z);
    scene.add(object);
    return object;
  };
  const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (g) draw(g, w, h);
    const texture = new CanvasTexture(c);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, extra: MeshStandardMaterialParameters = {}) =>
    place(new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, ...extra })), x, y, z);

  // One radial-gradient texture shared by every glow sprite and packet.
  const glowTexture = canvasTexture(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,255,255,.55)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const glow = (color: number, size: number, x: number, y: number, z: number, opacity: number) => {
    const sprite = new Sprite(new SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false,
    }));
    sprite.scale.set(size, size, 1);
    return place(sprite, x, y, z);
  };

  // Case panels: back, top, bottom, rear, front, the front light bar, edges and side glass.
  box(40, 45, 0.6, 0x0b0e16, 0, 0, -10.6);
  box(40, 0.8, 21, 0x0d111c, 0, 22.6, 0);
  box(40, 0.8, 21, 0x0d111c, 0, -22.6, 0);
  box(0.8, 45, 21, 0x0b0e16, -20.2, 0, 0);
  box(0.8, 45, 21, 0x0a0d15, 20.2, 0, 0);
  box(0.3, 28, 0.7, 0x4cc9ff, 20.7, 3, 7, { emissive: 0x4cc9ff, emissiveIntensity: 1.4 });
  const caseShape = new BoxGeometry(40.8, 46, 21.6);
  const caseEdges = new LineBasicMaterial({ color: 0x3a4a7a, transparent: true, opacity: 0.9 });
  scene.add(new LineSegments(new EdgesGeometry(caseShape), caseEdges));
  caseShape.dispose();
  const glass = new MeshStandardMaterial({
    color: 0x88aaff, transparent: true, opacity: 0.06, depthWrite: false, roughness: 0.1, metalness: 0.9,
  });
  place(new Mesh(new PlaneGeometry(40, 45), glass), 0, 0, 10.6);

  // Motherboard with procedural traces, PCIe slot, SSD.
  const rand = mulberry32(PCB_SEED);
  const pcb = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#0f281d";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,210,150,.33)";
    g.lineWidth = 1.5;
    for (let i = 0; i < 90; i++) {
      const x = rand() * w, y = rand() * h, len = 30 + rand() * 120;
      g.beginPath();
      g.moveTo(x, y);
      if (rand() < 0.5) { g.lineTo(x + len, y); g.lineTo(x + len + 12, y + 12); }
      else { g.lineTo(x, y + len); g.lineTo(x + 12, y + len + 12); }
      g.stroke();
    }
    g.fillStyle = "#c9a24a";
    for (let i = 0; i < 120; i++) g.fillRect(rand() * w, rand() * h, 3, 3);
  });
  box(30, 28, 0.4, 0xffffff, -1, 6, -10, { map: pcb, roughness: 0.8, metalness: 0.1 });
  box(9, 0.6, 0.7, 0x2a2f3c, -3, -1.8, -9.5);
  box(8, 2.2, 0.35, 0x1d2a44, 2, 4.2, -9.6, { emissive: 0x0a1430 });

  // CPU heatsink and fins.
  box(4.5, 12, 7, 0x1c2334, -2, 12, -6, { metalness: 0.85, roughness: 0.3 });
  for (let i = 0; i < 9; i++) box(4.6, 0.12, 7.1, 0x5a6790, -2, 6.6 + i * 1.35, -6, { metalness: 0.9, roughness: 0.2 });

  const bladeGeometry = new BoxGeometry(4.1, 1.5, 0.15);
  const bladeMaterial = new MeshStandardMaterial({ color: 0x2a3556, transparent: true, opacity: 0.85, metalness: 0.2 });
  const fan = (x: number, y: number, z: number) => {
    box(11, 11, 2.2, 0x0e1220, x, y, z - 1.2);
    const frame = place(new Group(), x, y, z);
    const ringMaterial = new MeshStandardMaterial({ color: 0x111111, emissive: 0x4cc9ff, emissiveIntensity: 1.6 });
    const ring = place(new Mesh(new TorusGeometry(5.1, 0.32, 12, 64), ringMaterial), x, y, z + 0.1);
    const blades = new Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const blade = new Mesh(bladeGeometry, bladeMaterial);
      blade.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0);
      blade.rotation.set(0.35, 0, a + 0.5);
      blades.add(blade);
    }
    const hub = new Mesh(new CylinderGeometry(1.1, 1.1, 0.6, 24), new MeshStandardMaterial({ color: 0x1b2440, emissive: 0x112244 }));
    hub.rotation.x = Math.PI / 2;
    frame.add(blades, hub);
    return { blades, ring, glow: glow(0x4cc9ff, 17, x, y, z + 0.5, 0.35) };
  };
  const fans = [fan(-9.5, 12, -4.6), fan(5.5, 12, -4.6)];

  // RAM sticks with RGB tops.
  const ramTops = [12.4, 13.6].map((x) => {
    box(0.7, 12, 3.4, 0x161c2c, x, 12, -8.2);
    return box(0.75, 0.8, 3.4, 0x111111, x, 18.4, -8.2, { emissive: 0x7852ee, emissiveIntensity: 1.5 });
  });

  // GPU, its label, the edge line and the glow that follow utilization.
  const gpu = box(27, 3.6, 12, 0x161b26, -3, 0.5, -3.6, { metalness: 0.6, roughness: 0.4 });
  const gpuLabel = canvasTexture(1024, 128, (g) => {
    g.font = "bold 74px sans-serif";
    g.fillStyle = "#9be15d";
    g.textBaseline = "middle";
    g.fillText("RTX 3060", 24, 62);
    g.font = "38px monospace";
    g.fillStyle = "#5f8a3c";
    g.fillText("12 GB GDDR6", 480, 66);
  });
  place(new Mesh(new PlaneGeometry(20, 2.5), new MeshBasicMaterial({ map: gpuLabel, transparent: true })), -4, 0.5, 2.43);
  const gpuLine = box(27, 0.14, 0.1, 0x111111, -3, -1.2, 2.45, { emissive: 0x76b900, emissiveIntensity: 0.6 });
  const gpuGlow = glow(0x97c459, 22, -4, 0.5, 3, 0.05);

  // PSU shroud with perforation and a blue strip.
  const grille = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = "#0c1019";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1c2436";
    for (let x = 6; x < w; x += 12) for (let y = 6; y < h; y += 12) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  });
  box(39, 9.5, 20, 0xffffff, 0, -17.4, 0, { map: grille, roughness: 0.9, metalness: 0.2 });
  box(39, 0.15, 0.15, 0x111111, 0, -12.6, 10, { emissive: 0x4cc9ff, emissiveIntensity: 1.2 });

  const packets: Packet[] = Array.from({ length: PACKET_POOL }, () => {
    const sprite = glow(0xffffff, 1.9, 0, 0, 0, 0);
    sprite.visible = false;
    return { sprite, curve: packetCurves.ssdToRam, t: 0, durationMs: 1, jitter: 0, on: false };
  });
  const spawn = (path: PacketPath, color: number) => {
    const p = packets.find((q) => !q.on);
    if (!p) return;
    p.on = true;
    p.curve = packetCurves[path];
    p.t = 0;
    p.durationMs = 850 + Math.random() * 350;
    p.jitter = path === "gpuLoop" ? (Math.random() - 0.5) * 1.4 : 0;
    p.sprite.material.color.setHex(color);
    p.sprite.material.opacity = 1;
    p.sprite.visible = true;
  };

  // HSL here means displayed color, as it did in the unmanaged r128 prototype.
  const paintRgb = (hue: number) => {
    fans.forEach((f, i) => {
      const h = (hue + i * 0.12) % 1;
      f.ring.material.emissive.setHSL(h, 0.9, 0.55, SRGBColorSpace);
      f.glow.material.color.setHSL(h, 0.9, 0.6, SRGBColorSpace);
    });
    ramTops.forEach((r, i) => r.material.emissive.setHSL((hue + 0.3 + i * 0.08) % 1, 0.9, 0.55, SRGBColorSpace));
    cyan.color.setHSL(hue, 0.8, 0.6, SRGBColorSpace);
  };

  let az = IDLE_AZ, el = IDLE_EL, orbited = false, lastOrbitMs = -Infinity;
  // animMs only advances while animating, so RGB, sway and spawns pick up where they paused.
  let lastNow = -1, animMs = 0, lastSpawn = -Infinity;
  let width = 0, height = 0, radius = 100;
  const scratch = new Vector3();
  const placeCamera = () => {
    camera.position.set(
      TARGET.x + radius * Math.sin(az) * Math.cos(el),
      TARGET.y + radius * Math.sin(el),
      TARGET.z + radius * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(TARGET);
    camera.updateMatrixWorld();
  };
  placeCamera();

  return {
    render(state, nowMs) {
      const gap = nowMs - lastNow;
      // A gap longer than MAX_DT_MS means the loop was paused (offscreen, hidden tab): resume with one ordinary frame.
      const dt = lastNow < 0 ? 0 : gap > MAX_DT_MS ? FRAME_MS : Math.max(0, gap);
      lastNow = nowMs;
      if (orbited) {
        lastOrbitMs = nowMs;
        orbited = false;
      }
      const util = state.telemetry.gpuUtil;
      if (options.animate) animMs += dt;
      paintRgb((STILL_HUE + (animMs / 1000) * 0.06) % 1);
      if (options.animate) {
        for (const f of fans) f.blades.rotation.z -= ((0.04 + util * 0.004) * dt) / FRAME_MS;
        if (state.mode === "grpo") {
          const phase = grpoPhases[state.phase];
          if (animMs - lastSpawn > (phase.path === "gpuLoop" ? 70 : 150)) {
            spawn(phase.path, phase.color);
            lastSpawn = animMs;
          }
        }
        for (const p of packets) {
          if (!p.on) continue;
          p.t += dt / p.durationMs;
          if (p.t >= 1) { p.on = false; p.sprite.visible = false; continue; }
          p.curve.getPointAt(p.t, scratch);
          p.sprite.position.set(scratch.x, scratch.y + p.jitter, scratch.z);
          p.sprite.material.opacity = Math.min(1, (1 - p.t) * 3);
        }
        if (nowMs - lastOrbitMs > IDLE_AFTER_MS) {
          const goal = IDLE_AZ + 0.28 * Math.sin((animMs / 1000) * 0.22);
          // Ease toward the nearest equivalent angle, so spins from dragging don't unwind whole turns.
          az -= Math.round((az - goal) / (2 * Math.PI)) * 2 * Math.PI;
          const k = Math.min(1, (0.01 * dt) / FRAME_MS);
          az += (goal - az) * k;
          el += (IDLE_EL - el) * k;
        }
      }
      const u = util / 100;
      gpu.material.emissive.setRGB(0.02 * u, 0.07 * u, 0.01 * u, SRGBColorSpace);
      gpuLine.material.emissiveIntensity = 0.4 + u * 1.6;
      gpuGlow.material.opacity = 0.04 + u * 0.35;
      placeCamera();
      renderer.render(scene, camera);
    },
    partScreenPosition(id) {
      if (!width || !height) return { x: 0, y: 0, visible: false };
      scratch.copy(partAnchors[id]).project(camera);
      const x = ((scratch.x + 1) / 2) * width;
      const y = ((1 - scratch.y) / 2) * height;
      return { x, y, visible: scratch.z <= 1 && x >= 0 && x <= width && y >= 0 && y <= height };
    },
    resize(w, h) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180);
      radius = Math.max(FIT_HALF_HEIGHT, FIT_HALF_WIDTH / camera.aspect) / tanHalf;
      placeCamera();
    },
    orbitBy(dx, dy) {
      az -= dx * 0.006;
      el = Math.min(0.95, Math.max(-0.15, el + dy * 0.004));
      orbited = true;
      placeCamera();
    },
    dispose() {
      const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
      scene.traverse((object) => {
        if (!(object instanceof Mesh || object instanceof LineSegments || object instanceof Sprite)) return;
        // Sprites share three's geometry singleton; renderer.dispose() releases this renderer's copy.
        if (!(object instanceof Sprite)) geometries.add(object.geometry);
        for (const m of ([] as Material[]).concat(object.material)) {
          materials.add(m);
          if ("map" in m && m.map instanceof Texture) textures.add(m.map);
        }
      });
      for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
      // Give the WebGL context back now: a client-side navigation away leaves the canvas to the GC, which may be too late for the browser's context limit.
      renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}
