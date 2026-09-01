import "../../three-jsx";
import { useMemo } from "react";
import * as THREE from "three";
import { PLAYER_TOWER, type House, type Prop, type World } from "../../game/world";

/* ------------------------------------------------------------------ */
/*  Multi-story house renderer                                         */
/* ------------------------------------------------------------------ */

function HouseMesh({ h }: { h: House }) {
  const floorH = h.h / h.floors;

  return (
    <group position={[h.x, 0, h.z]}>
      {/* Main building body per floor */}
      {Array.from({ length: h.floors }).map((_, fi) => {
        const yBase = fi * floorH;
        // Each floor slightly inset for visual layering
        const inset = fi * 0.15;
        const fw = h.w - inset;
        const fd = h.d - inset;
        return (
          <group key={fi}>
            {/* Floor body */}
            <mesh position={[0, yBase + floorH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[fw, floorH - 0.08, fd]} />
              <meshStandardMaterial color={h.color} roughness={0.92} />
            </mesh>

            {/* Floor divider band */}
            {fi > 0 && (
              <mesh position={[0, yBase + 0.04, 0]} castShadow>
                <boxGeometry args={[fw + 0.2, 0.14, fd + 0.2]} />
                <meshStandardMaterial color={h.trimColor} roughness={1} />
              </mesh>
            )}

            {/* Windows on front face */}
            {(() => {
              const windowCount = Math.max(1, Math.floor(fw / 3));
              const spacing = fw / (windowCount + 1);
              return Array.from({ length: windowCount }).map((_, wi) => {
                const wx = -fw / 2 + spacing * (wi + 1);
                const wy = yBase + floorH * 0.55;
                const winH = fi === 0 && wi === Math.floor(windowCount / 2) ? floorH * 0.55 : floorH * 0.32;
                const winW = fi === 0 && wi === Math.floor(windowCount / 2) ? 1.2 : 0.9;
                const isDoor = fi === 0 && wi === Math.floor(windowCount / 2);
                return (
                  <group key={`fw${wi}`}>
                    <mesh position={[wx, isDoor ? floorH * 0.38 : wy, fd / 2 + 0.02]}>
                      <planeGeometry args={[winW, winH]} />
                      <meshStandardMaterial
                        color={isDoor ? "#3e2a1a" : "#a8d8c8"}
                        roughness={isDoor ? 1 : 0.3}
                        metalness={isDoor ? 0 : 0.4}
                      />
                    </mesh>
                    {/* Window frame */}
                    {!isDoor && (
                      <mesh position={[wx, wy, fd / 2 + 0.03]}>
                        <planeGeometry args={[winW + 0.16, winH + 0.16]} />
                        <meshStandardMaterial color={h.trimColor} roughness={1} />
                      </mesh>
                    )}
                  </group>
                );
              });
            })()}

            {/* Windows on back face */}
            {(() => {
              const windowCount = Math.max(1, Math.floor(fw / 3.5));
              const spacing = fw / (windowCount + 1);
              return Array.from({ length: windowCount }).map((_, wi) => (
                <group key={`bw${wi}`}>
                  <mesh position={[-fw / 2 + spacing * (wi + 1), yBase + floorH * 0.55, -fd / 2 - 0.02]} rotation={[0, Math.PI, 0]}>
                    <planeGeometry args={[0.85, floorH * 0.3]} />
                    <meshStandardMaterial color="#a8d8c8" roughness={0.3} metalness={0.4} />
                  </mesh>
                </group>
              ));
            })()}

            {/* Windows on right side */}
            <mesh position={[fw / 2 + 0.02, yBase + floorH * 0.55, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[fd * 0.28, floorH * 0.3]} />
              <meshStandardMaterial color="#a8d8c8" roughness={0.3} />
            </mesh>

            {/* Windows on left side */}
            <mesh position={[-fw / 2 - 0.02, yBase + floorH * 0.55, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[fd * 0.28, floorH * 0.3]} />
              <meshStandardMaterial color="#a8d8c8" roughness={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* L-Shape extension */}
      {h.shape === "lshape" && (
        <group>
          <mesh position={[h.w * 0.3, floorH / 2, h.d * 0.3]} castShadow receiveShadow>
            <boxGeometry args={[h.w * 0.45, floorH, h.d * 0.45]} />
            <meshStandardMaterial color={h.color} roughness={0.92} />
          </mesh>
          {/* Small windows on extension */}
          <mesh position={[h.w * 0.3 + h.w * 0.225 + 0.02, floorH * 0.55, h.d * 0.3]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.7, 0.7]} />
            <meshStandardMaterial color="#a8d8c8" roughness={0.3} metalness={0.4} />
          </mesh>
        </group>
      )}

      {/* T-Shape extension */}
      {h.shape === "tshape" && (
        <mesh position={[0, floorH / 2, -h.d * 0.4]} castShadow receiveShadow>
          <boxGeometry args={[h.w * 0.4, floorH, h.d * 0.35]} />
          <meshStandardMaterial color={h.color} roughness={0.92} />
        </mesh>
      )}

      {/* Balcony on 2nd+ floor */}
      {h.hasBalcony && h.floors >= 2 && (
        <group>
          {/* Balcony platform */}
          <mesh position={[0, floorH + 0.06, h.d / 2 + 0.8]} castShadow>
            <boxGeometry args={[h.w * 0.5, 0.12, 1.6]} />
            <meshStandardMaterial color={h.trimColor} roughness={0.9} />
          </mesh>
          {/* Railing front */}
          <mesh position={[0, floorH + 0.5, h.d / 2 + 1.55]} castShadow>
            <boxGeometry args={[h.w * 0.5, 0.8, 0.08]} />
            <meshStandardMaterial color={h.trimColor} roughness={1} metalness={0.2} />
          </mesh>
          {/* Railing sides */}
          {[-1, 1].map((s, i) => (
            <mesh key={i} position={[s * h.w * 0.25, floorH + 0.5, h.d / 2 + 0.8]} castShadow>
              <boxGeometry args={[0.08, 0.8, 1.6]} />
              <meshStandardMaterial color={h.trimColor} roughness={1} metalness={0.2} />
            </mesh>
          ))}
        </group>
      )}

      {/* Awning over door */}
      {h.hasAwning && (
        <mesh position={[0, floorH * 0.72, h.d / 2 + 0.7]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[2.4, 0.08, 1.4]} />
          <meshStandardMaterial color={h.roofColor} roughness={0.9} />
        </mesh>
      )}

      {/* Roof */}
      {h.roof === "pitch" ? (
        <mesh position={[0, h.h + 1.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[Math.max(h.w, h.d) * 0.78, 2.8, 4]} />
          <meshStandardMaterial color={h.roofColor} roughness={0.9} />
        </mesh>
      ) : (
        <group>
          {/* Flat roof slab */}
          <mesh position={[0, h.h + 0.16, 0]} castShadow>
            <boxGeometry args={[h.w + 0.5, 0.28, h.d + 0.5]} />
            <meshStandardMaterial color={h.roofColor} roughness={0.95} />
          </mesh>
          {/* Rooftop parapet for tall buildings */}
          {h.floors >= 2 && (
            <>
              {[
                { pos: [0, h.h + 0.55, -h.d / 2] as const, args: [h.w + 0.5, 0.6, 0.15] as const },
                { pos: [0, h.h + 0.55, h.d / 2] as const, args: [h.w + 0.5, 0.6, 0.15] as const },
                { pos: [-h.w / 2, h.h + 0.55, 0] as const, args: [0.15, 0.6, h.d + 0.5] as const },
                { pos: [h.w / 2, h.h + 0.55, 0] as const, args: [0.15, 0.6, h.d + 0.5] as const },
              ].map((wall, i) => (
                <mesh key={i} position={[wall.pos[0], wall.pos[1], wall.pos[2]]} castShadow>
                  <boxGeometry args={[wall.args[0], wall.args[1], wall.args[2]]} />
                  <meshStandardMaterial color={h.color} roughness={1} />
                </mesh>
              ))}
            </>
          )}
        </group>
      )}

      {/* Stairs visible on side for multi-story */}
      {h.floors >= 2 && (
        <group>
          {Array.from({ length: Math.min(h.floors - 1, 2) }).map((_, si) => {
            const stairY = (si + 1) * floorH;
            return (
              <mesh key={si} position={[-h.w / 2 - 0.8, stairY / 2, 0]} castShadow>
                <boxGeometry args={[1.2, stairY, 2.0]} />
                <meshStandardMaterial color={h.trimColor} roughness={1} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Broken/damaged details */}
      {h.broken && (
        <>
          <mesh position={[h.w * 0.2, h.h + 0.7, -h.d * 0.2]} rotation={[0.5, 0.7, 0.3]}>
            <boxGeometry args={[3, 0.3, 3]} />
            <meshStandardMaterial color="#d8b888" roughness={1} />
          </mesh>
          <mesh position={[h.w / 2 + 1.4, 0.35, h.d * 0.3]} rotation={[0, 0.6, 0]}>
            <boxGeometry args={[2.2, 0.7, 1.6]} />
            <meshStandardMaterial color="#c8a070" roughness={1} />
          </mesh>
          {/* Bullet holes / crack marks */}
          <mesh position={[h.w * 0.15, h.h * 0.6, h.d / 2 + 0.03]}>
            <circleGeometry args={[0.3, 8]} />
            <meshStandardMaterial color="#4a3a2a" roughness={1} />
          </mesh>
          <mesh position={[-h.w * 0.3, h.h * 0.3, h.d / 2 + 0.03]}>
            <circleGeometry args={[0.2, 6]} />
            <meshStandardMaterial color="#5a4a3a" roughness={1} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

function PropMesh({ p }: { p: Prop }) {
  const s = p.scale;
  switch (p.type) {
    case "tree":
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={s}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.36, 3.2, 6]} />
            <meshStandardMaterial color="#6a4a30" roughness={1} />
          </mesh>
          <mesh position={[0, 4.0, 0]} castShadow>
            <icosahedronGeometry args={[1.9, 0]} />
            <meshStandardMaterial color={p.color} roughness={1} flatShading />
          </mesh>
          <mesh position={[0.7, 3.1, 0.3]} castShadow>
            <icosahedronGeometry args={[1.15, 0]} />
            <meshStandardMaterial color={p.color} roughness={1} flatShading />
          </mesh>
        </group>
      );
    case "bush":
      return (
        <mesh position={[p.x, 0.5 * s, p.z]} scale={s} castShadow>
          <icosahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color={p.color} roughness={1} flatShading />
        </mesh>
      );
    case "rock":
      return (
        <mesh position={[p.x, 0.4 * s, p.z]} rotation={[p.rot, p.rot, 0]} scale={s} castShadow>
          <dodecahedronGeometry args={[0.85, 0]} />
          <meshStandardMaterial color={p.color} roughness={1} flatShading />
        </mesh>
      );
    case "car":
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={s}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <boxGeometry args={[1.9, 0.8, 4.2]} />
            <meshStandardMaterial color={p.color} roughness={0.6} metalness={0.35} />
          </mesh>
          <mesh position={[0, 1.35, -0.2]} castShadow>
            <boxGeometry args={[1.7, 0.7, 2.0]} />
            <meshStandardMaterial color="#a8d8c8" roughness={0.3} metalness={0.5} />
          </mesh>
          {[
            [-0.95, 1.4],
            [0.95, 1.4],
            [-0.95, -1.4],
            [0.95, -1.4],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x!, 0.34, z!]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.34, 0.34, 0.24, 10]} />
              <meshStandardMaterial color="#1b1b1e" roughness={1} />
            </mesh>
          ))}
        </group>
      );
    case "bike":
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={s}>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[0.3, 0.4, 1.5]} />
            <meshStandardMaterial color={p.color} roughness={0.5} metalness={0.4} />
          </mesh>
          {[-0.62, 0.62].map((z, i) => (
            <mesh key={i} position={[0, 0.36, z]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.34, 0.06, 6, 14]} />
              <meshStandardMaterial color="#191a1d" roughness={1} />
            </mesh>
          ))}
        </group>
      );
    case "barrel":
      return (
        <mesh position={[p.x, 0.55, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 1.1, 12]} />
          <meshStandardMaterial color={p.color} roughness={0.8} metalness={0.2} />
        </mesh>
      );
    case "crate":
      return (
        <mesh position={[p.x, 0.45, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color={p.color} roughness={1} />
        </mesh>
      );
    case "wall":
      return (
        <mesh position={[p.x, 0.8, p.z]} rotation={[0, p.rot, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.5 * s, 1.6, 0.45]} />
          <meshStandardMaterial color={p.color} roughness={1} />
        </mesh>
      );
    case "pole":
      return (
        <group position={[p.x, 0, p.z]}>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 6, 6]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
          <mesh position={[0.5, 5.9, 0]}>
            <boxGeometry args={[1.1, 0.12, 0.12]} />
            <meshStandardMaterial color={p.color} />
          </mesh>
        </group>
      );
    case "well":
      return (
        <group position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[1.3, 1.4, 1, 12]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
        </group>
      );
    case "sandbag":
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
          {/* Stacked sandbag wall */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[2.2 * s, 0.6, 0.7]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[1.8 * s, 0.5, 0.65]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
          {/* Top row offset */}
          <mesh position={[0.15, 1.2, 0]} castShadow>
            <boxGeometry args={[1.4 * s, 0.4, 0.6]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
        </group>
      );
    case "antenna":
      return (
        <group position={[p.x, 0, p.z]}>
          <mesh position={[0, 4.5, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.1, 9, 4]} />
            <meshStandardMaterial color={p.color} roughness={0.8} metalness={0.5} />
          </mesh>
          {/* Cross arms */}
          <mesh position={[0, 7.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 2, 4]} />
            <meshStandardMaterial color={p.color} roughness={0.8} metalness={0.5} />
          </mesh>
          <mesh position={[0, 6.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 4]} />
            <meshStandardMaterial color={p.color} roughness={0.8} metalness={0.5} />
          </mesh>
        </group>
      );
    case "stall":
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={s}>
          {/* Table */}
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[2.8, 0.1, 1.6]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
          {/* Legs */}
          {[[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx!, 0.42, lz!]} castShadow>
              <boxGeometry args={[0.12, 0.84, 0.12]} />
              <meshStandardMaterial color="#6a5040" roughness={1} />
            </mesh>
          ))}
          {/* Canopy (cloth cover) */}
          <mesh position={[0, 2.1, 0]} castShadow>
            <boxGeometry args={[3.2, 0.06, 2.0]} />
            <meshStandardMaterial color="#c05030" roughness={1} />
          </mesh>
          {/* Canopy poles */}
          {[[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx!, 1.48, lz!]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 2.5, 4]} />
              <meshStandardMaterial color="#5a4030" roughness={1} />
            </mesh>
          ))}
        </group>
      );
    case "wreck":
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0.12]} scale={s}>
          {/* Wrecked car body — tilted */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[2.0, 0.7, 4.4]} />
            <meshStandardMaterial color={p.color} roughness={1} />
          </mesh>
          {/* Crushed cabin */}
          <mesh position={[0.15, 1.1, -0.3]} rotation={[0, 0, 0.08]} castShadow>
            <boxGeometry args={[1.6, 0.45, 1.8]} />
            <meshStandardMaterial color="#3a3028" roughness={1} />
          </mesh>
          {/* Debris */}
          <mesh position={[1.3, 0.2, 1.5]} rotation={[0.3, 0.5, 0.2]}>
            <boxGeometry args={[0.8, 0.15, 0.6]} />
            <meshStandardMaterial color="#5a4a3a" roughness={1} />
          </mesh>
          {/* Burn marks */}
          <mesh position={[0, 0.98, 1.8]}>
            <planeGeometry args={[1.8, 0.8]} />
            <meshStandardMaterial color="#1a1510" roughness={1} />
          </mesh>
        </group>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Main Village component                                             */
/* ------------------------------------------------------------------ */

export function Village({ world }: { world: World }) {
  const groundTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    // Base sandy ground
    g.fillStyle = "#dab870";
    g.fillRect(0, 0, 512, 512);
    // Sand grain noise
    for (let i = 0; i < 12000; i++) {
      const v = 190 + Math.random() * 50;
      g.fillStyle = `rgba(${v},${v - 20},${v - 70},0.35)`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // Scratches / tire marks
    g.strokeStyle = "rgba(160,125,65,0.16)";
    for (let i = 0; i < 120; i++) {
      g.lineWidth = 0.5 + Math.random() * 1.3;
      g.beginPath();
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      g.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (Math.random() - 0.5) * 22;
        y += 1 + Math.random() * 1.8;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Pebbles
    for (let i = 0; i < 350; i++) {
      const r = 210 + Math.random() * 30;
      const gC = 175 + Math.random() * 35;
      const b = 105 + Math.random() * 35;
      g.fillStyle = `rgba(${r},${gC},${b},${0.1 + Math.random() * 0.2})`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Dark patches
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(65,50,28,${0.06 + Math.random() * 0.15})`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 8, 0, Math.PI * 2);
      g.fill();
    }
    // Grass tufts at edges
    for (let i = 0; i < 200; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      // More grass towards edges
      const edgeFactor = Math.max(
        Math.abs(gx - 256) / 256,
        Math.abs(gy - 256) / 256
      );
      if (Math.random() > edgeFactor * 0.8) continue;
      g.fillStyle = `rgba(${85 + Math.random() * 40},${110 + Math.random() * 40},${50 + Math.random() * 30},${0.15 + Math.random() * 0.15})`;
      g.beginPath();
      g.ellipse(gx, gy, 2 + Math.random() * 4, 1 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(80, 80);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const roadTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#a88658";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const v = 140 + Math.random() * 65;
      g.fillStyle = `rgba(${v + 25},${v - 8},${v - 50},0.45)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // Ruts and cracks
    g.strokeStyle = "rgba(80,58,25,0.45)";
    for (let i = 0; i < 25; i++) {
      g.lineWidth = 0.5 + Math.random() * 1.5;
      g.beginPath();
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 55;
        y += (Math.random() - 0.5) * 55;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 12);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  // Parapet wall height: 30% shorter than original 1.1 → 0.77
  const PARAPET_H = 0.77;

  return (
    <group>
      {/* Ground */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[3200, 3200]} />
        <meshStandardMaterial map={groundTex} roughness={1} />
      </mesh>

      {/* Roads */}
      {world.roads.map((r, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, r.rot]}
          position={[r.x, 0.02, r.z]}
          receiveShadow
        >
          <planeGeometry args={[r.w, r.d]} />
          <meshStandardMaterial map={roadTex} roughness={1} />
        </mesh>
      ))}

      {/* Houses */}
      {world.houses.map((h, i) => (
        <HouseMesh key={i} h={h} />
      ))}

      {/* Props */}
      {world.props.map((p, i) => (
        <PropMesh key={i} p={p} />
      ))}

      {/* ========================================================= */}
      {/* Player rooftop tower — RUSTY OLD STYLE                     */}
      {/* ========================================================= */}
      <group position={[PLAYER_TOWER.x, 0, PLAYER_TOWER.z]}>
        {/* Main tower body — weathered concrete */}
        <mesh position={[0, PLAYER_TOWER.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[PLAYER_TOWER.w, PLAYER_TOWER.h, PLAYER_TOWER.d]} />
          <meshStandardMaterial color="#8a7d6a" roughness={1} />
        </mesh>

        {/* Weathering stains on sides */}
        {[
          { pos: [0, PLAYER_TOWER.h * 0.7, PLAYER_TOWER.d / 2 + 0.03] as const, rot: [0, 0, 0] as const, size: [4, 3] as const },
          { pos: [PLAYER_TOWER.w / 2 + 0.03, PLAYER_TOWER.h * 0.5, 2] as const, rot: [0, Math.PI / 2, 0] as const, size: [3, 5] as const },
          { pos: [-PLAYER_TOWER.w / 2 - 0.03, PLAYER_TOWER.h * 0.6, -1] as const, rot: [0, -Math.PI / 2, 0] as const, size: [2.5, 4] as const },
        ].map((stain, i) => (
          <mesh key={`stain${i}`} position={[stain.pos[0], stain.pos[1], stain.pos[2]]} rotation={[stain.rot[0], stain.rot[1], stain.rot[2]]}>
            <planeGeometry args={[stain.size[0], stain.size[1]]} />
            <meshStandardMaterial color="#6a5a42" roughness={1} transparent opacity={0.35} />
          </mesh>
        ))}

        {/* Roof slab — cracked, dark */}
        <mesh position={[0, PLAYER_TOWER.h + 0.06, 0]} receiveShadow>
          <boxGeometry args={[PLAYER_TOWER.w, 0.12, PLAYER_TOWER.d]} />
          <meshStandardMaterial color="#5a4f42" roughness={1} />
        </mesh>

        {/* Rust patches on roof surface */}
        {[
          [-3, PLAYER_TOWER.h + 0.13, -2],
          [4, PLAYER_TOWER.h + 0.13, 3],
          [-1, PLAYER_TOWER.h + 0.13, 5],
          [5, PLAYER_TOWER.h + 0.13, -4],
        ].map((pos, i) => (
          <mesh key={`rust${i}`} position={[pos[0]!, pos[1]!, pos[2]!]} rotation={[-Math.PI / 2, 0, i * 1.2]}>
            <circleGeometry args={[0.8 + i * 0.3, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#8a5530" : "#6a4020"} roughness={1} transparent opacity={0.55} />
          </mesh>
        ))}

        {/* Cracks on roof */}
        {[
          [-2, PLAYER_TOWER.h + 0.14, 1],
          [3, PLAYER_TOWER.h + 0.14, -3],
        ].map((pos, i) => (
          <mesh key={`crack${i}`} position={[pos[0]!, pos[1]!, pos[2]!]} rotation={[-Math.PI / 2, 0, i * 2.3]}>
            <planeGeometry args={[3, 0.05]} />
            <meshStandardMaterial color="#3a3028" roughness={1} />
          </mesh>
        ))}

        {/* Parapet walls — corroded / rusted — 30% SHORTER */}
        {/* Front and back */}
        {[
          [0, -PLAYER_TOWER.d / 2 + 0.25, PLAYER_TOWER.w, 0.5],
          [0, PLAYER_TOWER.d / 2 - 0.25, PLAYER_TOWER.w, 0.5],
        ].map(([x, z, w, d], i) => (
          <mesh key={`fb${i}`} position={[x!, PLAYER_TOWER.h + PARAPET_H / 2 + 0.12, z!]} castShadow>
            <boxGeometry args={[w!, PARAPET_H, d!]} />
            <meshStandardMaterial color="#9a6a4a" roughness={1} />
          </mesh>
        ))}
        {/* Left and right */}
        {[-1, 1].map((s, i) => (
          <mesh
            key={`lr${i}`}
            position={[(s * PLAYER_TOWER.w) / 2 - s * 0.25, PLAYER_TOWER.h + PARAPET_H / 2 + 0.12, 0]}
            castShadow
          >
            <boxGeometry args={[0.5, PARAPET_H, PLAYER_TOWER.d]} />
            <meshStandardMaterial color="#9a6a4a" roughness={1} />
          </mesh>
        ))}

        {/* Rust streaks on parapets */}
        {[
          { pos: [2, PLAYER_TOWER.h + 0.5, -PLAYER_TOWER.d / 2 + 0.28] as const, size: [1.5, 0.5] as const },
          { pos: [-3, PLAYER_TOWER.h + 0.4, PLAYER_TOWER.d / 2 - 0.28] as const, size: [2, 0.4] as const },
        ].map((rs, i) => (
          <mesh key={`prust${i}`} position={[rs.pos[0], rs.pos[1], rs.pos[2]]}>
            <planeGeometry args={[rs.size[0], rs.size[1]]} />
            <meshStandardMaterial color="#7a4520" roughness={1} transparent opacity={0.4} />
          </mesh>
        ))}

        {/* Water tank — old corroded steel */}
        <mesh position={[4, PLAYER_TOWER.h + 0.9, 4]} castShadow>
          <cylinderGeometry args={[0.9, 1.0, 1.6, 10]} />
          <meshStandardMaterial color="#4a3a2e" roughness={1} metalness={0.15} />
        </mesh>
        {/* Tank rust rings */}
        <mesh position={[4, PLAYER_TOWER.h + 0.4, 4]}>
          <cylinderGeometry args={[1.02, 1.02, 0.1, 10]} />
          <meshStandardMaterial color="#6a4020" roughness={1} />
        </mesh>
        <mesh position={[4, PLAYER_TOWER.h + 1.4, 4]}>
          <cylinderGeometry args={[0.92, 0.92, 0.1, 10]} />
          <meshStandardMaterial color="#6a4020" roughness={1} />
        </mesh>

        {/* Old pipe on roof */}
        <mesh position={[-5, PLAYER_TOWER.h + 0.7, -3]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 6]} />
          <meshStandardMaterial color="#5a4a3a" roughness={1} metalness={0.3} />
        </mesh>

        {/* Debris/rubble on roof */}
        <mesh position={[-3, PLAYER_TOWER.h + 0.2, 5]} rotation={[0.3, 0.8, 0.1]}>
          <boxGeometry args={[1.2, 0.3, 0.8]} />
          <meshStandardMaterial color="#7a6a5a" roughness={1} />
        </mesh>
        <mesh position={[6, PLAYER_TOWER.h + 0.18, -5]} rotation={[0.1, 1.2, 0.2]}>
          <boxGeometry args={[0.8, 0.25, 1.0]} />
          <meshStandardMaterial color="#8a7a6a" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}
