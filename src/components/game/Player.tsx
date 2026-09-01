import "../../three-jsx";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { input } from "../../game/input";
import { getGame, setGame } from "../../game/state";
import { playerShoot, runtime } from "../../game/runtime";
import { PLAYER_TOWER, ROOF_Y } from "../../game/world";
import { sfx } from "../../game/audio";

const BASE_FOV = 72;
const HALF = PLAYER_TOWER.w / 2 - 1.4;

export function Player() {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(PLAYER_TOWER.x, ROOF_Y + 1.7, PLAYER_TOWER.z - 6));
  const recoil = useRef(0);
  const stepT = useRef(0);
  const reloadT = useRef(0);
  const fireCd = useRef(0);

  useEffect(() => {
    camera.position.copy(pos.current);
    (camera as THREE.PerspectiveCamera).far = 700;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const g = getGame();
    const cam = camera as THREE.PerspectiveCamera;

    // ---- look ----
    const zoom = g.scope || 1;
    const fovTarget = g.scope ? BASE_FOV / (g.scope * 0.85) : BASE_FOV;
    cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 12);
    const sens = (cam.fov / BASE_FOV) * 0.0022;
    input.yaw -= input.lookDX * sens;
    input.pitch -= input.lookDY * sens;
    input.pitch = THREE.MathUtils.clamp(input.pitch, -1.15, 0.5);
    input.lookDX = 0;
    input.lookDY = 0;

    // ---- move ----
    if (g.phase === "playing") {
      const speed = (g.crouched ? 1.6 : input.run ? 5.2 : 3.0) * (g.scope ? 0.45 : 1);
      const fwd = new THREE.Vector3(Math.sin(input.yaw), 0, Math.cos(input.yaw)).multiplyScalar(-1);
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      const move = new THREE.Vector3()
        .addScaledVector(fwd, input.forward)
        .addScaledVector(right, input.strafe);
      if (move.lengthSq() > 0.001) {
        move.normalize().multiplyScalar(speed * dt);
        pos.current.x = THREE.MathUtils.clamp(pos.current.x + move.x, PLAYER_TOWER.x - HALF, PLAYER_TOWER.x + HALF);
        pos.current.z = THREE.MathUtils.clamp(pos.current.z + move.z, PLAYER_TOWER.z - HALF, PLAYER_TOWER.z + HALF);
        stepT.current -= dt * (input.run ? 1.7 : 1);
        if (stepT.current <= 0) {
          stepT.current = 0.48;
          sfx.step(input.run);
        }
      }
    }
    const eyeY = ROOF_Y + (g.crouched ? 1.05 : 1.72);
    pos.current.y += (eyeY - pos.current.y) * Math.min(1, dt * 10);

    // ---- sway + recoil + shake ----
    const t = performance.now() / 1000;
    const steady = input.holdBreath ? 0.15 : 1;
    const swayAmp = (g.scope ? 0.0016 : 0.004) * (g.crouched ? 0.55 : 1) * steady;
    const swayX = Math.sin(t * 1.3) * swayAmp + Math.sin(t * 2.7) * swayAmp * 0.4;
    const swayY = Math.cos(t * 1.7) * swayAmp * 0.8;
    recoil.current = Math.max(0, recoil.current - dt * 2.2);
    const shake = runtime.shake;

    cam.position.copy(pos.current);
    cam.position.x += (Math.random() - 0.5) * shake * 0.12;
    cam.position.y += (Math.random() - 0.5) * shake * 0.12;
    cam.rotation.set(0, 0, 0, "YXZ");
    cam.rotation.y = input.yaw + swayX;
    cam.rotation.x = input.pitch + swayY + recoil.current * 0.09;
    cam.updateProjectionMatrix();

    runtime.playerPos.copy(cam.position);
    cam.getWorldDirection(runtime.playerDir);

    // ---- reload / fire ----
    fireCd.current = Math.max(0, fireCd.current - dt);
    if (reloadT.current > 0) {
      reloadT.current -= dt;
      if (reloadT.current <= 0) {
        const need = g.magSize - g.ammo;
        const take = Math.min(need, g.reserve);
        setGame({ ammo: g.ammo + take, reserve: g.reserve - take, reloading: false });
      }
    }

    if (input.fireQueued) {
      input.fireQueued = false;
      if (g.phase === "playing" && reloadT.current <= 0 && fireCd.current <= 0) {
        if (g.ammo <= 0) {
          sfx.dryFire();
          startReload();
        } else {
          setGame({ ammo: g.ammo - 1 });
          fireCd.current = 1.1;
          recoil.current = 1;
          runtime.shake = 0.35;
          sfx.shot();
          const dir = new THREE.Vector3();
          cam.getWorldDirection(dir);
          const spread = (g.scope ? 0.0012 : 0.012) * (g.crouched ? 0.6 : 1) * (input.holdBreath ? 0.4 : 1);
          dir.x += (Math.random() - 0.5) * spread;
          dir.y += (Math.random() - 0.5) * spread;
          playerShoot(cam.position.clone(), dir.normalize(), g.round);
          if (g.ammo - 1 <= 0) setTimeout(startReload, 500);
        }
      }
    }
  });

  function startReload() {
    const g = getGame();
    if (g.reloading || g.ammo >= g.magSize || g.reserve <= 0) return;
    reloadT.current = 1.9;
    setGame({ reloading: true });
    sfx.reload();
  }

  useEffect(() => {
    (window as any).__startReload = startReload;
  });

  return null;
}
