import "../../three-jsx";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Village } from "./Village";
import { Enemies } from "./Enemies";
import { Effects } from "./Effects";
import { Player } from "./Player";
import { HUD } from "./HUD";
import { runtime, updateSim } from "../../game/runtime";
import { getGame, setGame } from "../../game/state";
import { input, queueFire } from "../../game/input";
import { initAudio, sfx } from "../../game/audio";

function SkyDome() {
  const tex = useRef<THREE.CanvasTexture | null>(null);
  if (!tex.current) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 512;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#3a7fc4");
    grad.addColorStop(0.25, "#6ba9d8");
    grad.addColorStop(0.55, "#b8cfe0");
    grad.addColorStop(0.78, "#e9c89a");
    grad.addColorStop(0.92, "#f0d4a6");
    grad.addColorStop(1, "#c89860");
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    tex.current = t;
  }
  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[1800, 32, 16]} />
      <meshBasicMaterial map={tex.current} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

function Director({ onVersion }: { onVersion: (v: number) => void }) {
  const acc = useRef(0);
  const version = useRef(0);
  const count = useRef(0);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const g = getGame();
    updateSim(dt, g.round);

    if (runtime.enemies.length !== count.current) {
      count.current = runtime.enemies.length;
      version.current++;
      const v = version.current;
      queueMicrotask(() => onVersion(v));
    }

    if (g.phase !== "playing") return;
    acc.current += dt;
    if (acc.current >= 0.25) {
      const left = Math.max(0, g.timeLeft - acc.current);
      setGame({ timeLeft: left, hitFlash: Math.max(0, g.hitFlash - acc.current) });
      acc.current = 0;
      if (left <= 0) {
        sfx.gameOver();
        setGame({ phase: "gameover" });
      }
    }
    if (g.enemiesLeft <= 0 && runtime.enemies.length > 0) {
      setGame({ phase: "roundover", scope: 0 });
    }
  });
  return null;
}

export function GameCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", " ", "shift", "c", "z", "r"].includes(k)) e.preventDefault();
      if (k === "w") input.forward = down ? 1 : input.forward === 1 ? 0 : input.forward;
      if (k === "s") input.forward = down ? -1 : input.forward === -1 ? 0 : input.forward;
      if (k === "a") input.strafe = down ? -1 : input.strafe === -1 ? 0 : input.strafe;
      if (k === "d") input.strafe = down ? 1 : input.strafe === 1 ? 0 : input.strafe;
      if (k === "shift") input.run = down;
      if (k === " ") input.holdBreath = down;
      if (!down) return;
      if (k === "c") setGame({ crouched: !getGame().crouched });
      if (k === "r") (window as any).__startReload?.();
      if (k === "z") cycleScope();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);

    const cycleScope = () => {
      const next = getGame().scope === 10 ? 0 : 10;
      setGame({ scope: next as 0 | 10 });
      sfx.scope(next !== 0);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      input.lookDX = e.movementX;
      input.lookDY = e.movementY;
    };
    const onDown = (e: MouseEvent) => {
      initAudio();
      if (getGame().phase !== "playing") return;
      if (!document.pointerLockElement) {
        el.requestPointerLock?.();
        return;
      }
      if (e.button === 0) queueFire();
      if (e.button === 2) cycleScope();
    };
    const onCtx = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      if (getGame().phase !== "playing") return;
      e.preventDefault();
      cycleScope();
    };
    const onLock = () => {
      input.pointerLocked = !!document.pointerLockElement;
    };

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mousedown", onDown);
    el.addEventListener("contextmenu", onCtx);
    el.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("contextmenu", onCtx);
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onLock);
    };
  }, []);

  return (
    <div ref={wrap} className="fixed inset-0 touch-none bg-background">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ fov: 72, near: 0.1, far: 2200, position: [0, 16, 42] }}
        onCreated={({ scene, gl }) => {
          scene.fog = new THREE.Fog(0xe9c89a, 250, 1200);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <SkyDome />
        <hemisphereLight args={["#bcdcff", "#d2a06a", 1.1]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[70, 90, 40]}
          intensity={2.5}
          color="#fff0c0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-130}
          shadow-camera-right={130}
          shadow-camera-top={130}
          shadow-camera-bottom={-130}
          shadow-camera-far={320}
        />
        <Village key={getGame().round} world={runtime.world} />
        <Enemies version={version} />
        <Effects />
        <Player />
        <Director onVersion={setVersion} />
      </Canvas>
      <HUD />
    </div>
  );
}
