import "../../three-jsx";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime, type Enemy } from "../../game/runtime";

function EnemyModel({ e }: { e: Enemy }) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Mesh>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const baseY = e.elevated ? e.elevationY : 0;
    g.position.set(e.pos.x, baseY, e.pos.z);
    g.rotation.y = e.facing;

    const dead = e.state === "dead";
    if (dead) {
      const t = Math.min(1, e.deadT / 0.55);
      g.rotation.x = -t * (Math.PI / 2) * 0.95;
      g.position.y = baseY - 0.1 * t;
    } else {
      g.rotation.x = 0;
    }
    if (body.current) {
      body.current.position.y = dead ? 0 : e.crouch ? -0.45 : 0;
      body.current.rotation.x = e.crouch && !dead ? 0.25 : 0;
    }
    const moving = e.state === "patrol" || e.state === "seek" || e.state === "cover";
    const sw = moving && !dead ? Math.sin(e.walkPhase * 3) * 0.7 : 0;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    if (muzzle.current) muzzle.current.visible = e.muzzle > 0.1;
    const flash = e.hitFlash;
    for (const m of mats.current) {
      if (m) m.emissiveIntensity = flash * 2.2;
    }
  });

  const reg = (m: THREE.MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m);
  };

  const cloth = e.hp > e.maxHp * 0.9 ? "#3a86ff" : "#2956c8";

  return (
    <group ref={group}>
      <group ref={body}>
        {/* legs */}
        <mesh ref={legL} position={[-0.16, 0.72, 0]} castShadow>
          <boxGeometry args={[0.22, 0.8, 0.22]} />
          <meshStandardMaterial ref={reg} color="#1a2a5e" emissive="#ff2bd6" emissiveIntensity={0} roughness={1} />
        </mesh>
        <mesh ref={legR} position={[0.16, 0.72, 0]} castShadow>
          <boxGeometry args={[0.22, 0.8, 0.22]} />
          <meshStandardMaterial ref={reg} color="#1a2a5e" emissive="#ff2bd6" emissiveIntensity={0} roughness={1} />
        </mesh>
        {/* torso */}
        <mesh position={[0, 1.28, 0]} castShadow>
          <boxGeometry args={[0.62, 0.72, 0.36]} />
          <meshStandardMaterial ref={reg} color={cloth} emissive="#ff2bd6" emissiveIntensity={0} roughness={1} />
        </mesh>
        {/* vest */}
        <mesh position={[0, 1.3, 0.2]}>
          <boxGeometry args={[0.5, 0.5, 0.1]} />
          <meshStandardMaterial color="#ffbe0b" roughness={1} />
        </mesh>
        {/* arms */}
        <mesh position={[-0.42, 1.3, 0.1]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.17, 0.62, 0.17]} />
          <meshStandardMaterial ref={reg} color={cloth} emissive="#ff2bd6" emissiveIntensity={0} roughness={1} />
        </mesh>
        <mesh position={[0.42, 1.3, 0.1]} rotation={[0.7, 0, 0]} castShadow>
          <boxGeometry args={[0.17, 0.62, 0.17]} />
          <meshStandardMaterial ref={reg} color={cloth} emissive="#ff2bd6" emissiveIntensity={0} roughness={1} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.78, 0]} castShadow>
          <sphereGeometry args={[0.21, 12, 10]} />
          <meshStandardMaterial ref={reg} color="#ffd1a8" emissive="#ff2bd6" emissiveIntensity={0} roughness={1} />
        </mesh>
        <mesh position={[0, 1.87, 0]} castShadow>
          <sphereGeometry args={[0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ef476f" roughness={1} />
        </mesh>
        {/* rifle */}
        <group position={[0.28, 1.24, 0.42]}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.12, 0.95]} />
            <meshStandardMaterial color="#2a2f3a" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh ref={muzzle} position={[0, 0, 0.62]}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function Enemies({ version }: { version: number }) {
  return (
    <group key={version}>
      {runtime.enemies.map((e) => (
        <EnemyModel key={e.id} e={e} />
      ))}
    </group>
  );
}
