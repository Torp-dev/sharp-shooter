import "../../three-jsx";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime } from "../../game/runtime";

const MAX = 24;

export function Effects() {
  const tracers = useRef<THREE.Mesh[]>([]);
  const impacts = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    for (let i = 0; i < MAX; i++) {
      const m = tracers.current[i];
      if (!m) continue;
      const t = runtime.tracers[i];
      if (!t) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const dir = new THREE.Vector3().subVectors(t.to, t.from);
      const len = dir.length();
      m.position.copy(t.from).addScaledVector(dir, 0.5);
      m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(t.enemy ? "#ff2bd6" : "#7ad3ff");
      mat.opacity = Math.max(0, t.life * 8);
    }
    for (let i = 0; i < MAX; i++) {
      const m = impacts.current[i];
      if (!m) continue;
      const im = runtime.impacts[i];
      if (!im) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.copy(im.pos);
      const s = (1 - im.life / 0.5) * (im.blood ? 1.1 : 0.8) + 0.15;
      m.scale.setScalar(s);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(im.blood ? "#ff2bd6" : "#ffd166");
      mat.opacity = Math.max(0, im.life * 1.8);
    }
  });

  return (
    <group>
      {Array.from({ length: MAX }).map((_, i) => (
        <mesh
          key={`t${i}`}
          visible={false}
          ref={(el) => {
            if (el) tracers.current[i] = el;
          }}
        >
          <cylinderGeometry args={[0.035, 0.035, 1, 5]} />
          <meshBasicMaterial transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: MAX }).map((_, i) => (
        <mesh
          key={`i${i}`}
          visible={false}
          ref={(el) => {
            if (el) impacts.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshBasicMaterial transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
