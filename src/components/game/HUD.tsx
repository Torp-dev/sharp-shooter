import { useEffect, useRef, useState } from "react";
import { getGame, resetGame, setGame, useGame, roundConfig } from "../../game/state";
import { input, queueFire } from "../../game/input";
import { initAudio, setMuted, sfx } from "../../game/audio";
import { spawnRound } from "../../game/runtime";

function Scope({ level }: { level: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 27%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.96) 42%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="50" y1="0" x2="50" y2="44" stroke="rgba(122,211,255,0.85)" strokeWidth="0.25" />
        <line x1="50" y1="56" x2="50" y2="100" stroke="rgba(122,211,255,0.85)" strokeWidth="0.25" />
        <line x1="0" y1="50" x2="44" y2="50" stroke="rgba(122,211,255,0.85)" strokeWidth="0.25" />
        <line x1="56" y1="50" x2="100" y2="50" stroke="rgba(122,211,255,0.85)" strokeWidth="0.25" />
      </svg>
      <svg
        className="absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2"
        viewBox="-50 -50 100 100"
      >
        <circle r="49" fill="none" stroke="rgba(122,211,255,0.85)" strokeWidth="1.4" />
        <line x1="-49" y1="0" x2="-6" y2="0" stroke="#7ad3ff" strokeWidth="0.7" />
        <line x1="6" y1="0" x2="49" y2="0" stroke="#7ad3ff" strokeWidth="0.7" />
        <line x1="0" y1="-49" x2="0" y2="-6" stroke="#7ad3ff" strokeWidth="0.7" />
        <line x1="0" y1="6" x2="0" y2="49" stroke="#7ad3ff" strokeWidth="0.7" />
        {[8, 16, 24, 32].map((d) => (
          <g key={d} stroke="#7ad3ff" strokeWidth="0.6">
            <line x1="-3" y1={d} x2="3" y2={d} />
            <line x1={-d} y1="-2.2" x2={-d} y2="2.2" />
            <line x1={d} y1="-2.2" x2={d} y2="2.2" />
          </g>
        ))}
        <circle r="0.9" fill="#7ad3ff" />
      </svg>
      <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 font-mono text-xs tracking-[0.3em] text-primary">
        {level}X
      </div>
    </div>
  );
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const idRef = useRef<number | null>(null);

  const handle = (e: React.PointerEvent) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const d = Math.min(1, Math.hypot(dx, dy) / max);
    const a = Math.atan2(dy, dx);
    const nx = Math.cos(a) * d;
    const ny = Math.sin(a) * d;
    setKnob({ x: nx * max, y: ny * max });
    onMove(nx, -ny);
  };

  return (
    <div
      ref={base}
      className="pointer-events-auto h-32 w-32 touch-none rounded-full border border-primary/30 bg-background/25 backdrop-blur-sm"
      onPointerDown={(e) => {
        idRef.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handle(e);
      }}
      onPointerMove={(e) => idRef.current === e.pointerId && handle(e)}
      onPointerUp={() => {
        idRef.current = null;
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
      onPointerCancel={() => {
        idRef.current = null;
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
    >
      <div
        className="pointer-events-none relative left-1/2 top-1/2 h-14 w-14 rounded-full border border-primary/50 bg-primary/25"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

/* ------- Health bar gradient helper ------- */
function healthColor(pct: number): string {
  if (pct > 0.6) return "#22c55e";
  if (pct > 0.35) return "#eab308";
  return "#ef4444";
}

function healthGlow(pct: number): string {
  if (pct > 0.6) return "0 0 8px rgba(34,197,94,0.5)";
  if (pct > 0.35) return "0 0 8px rgba(234,179,8,0.5)";
  return "0 0 12px rgba(239,68,68,0.7)";
}

/* ------- Performance rating ------- */
function getRating(kills: number, headshots: number, total: number, health: number, maxHealth: number): string {
  const hsRatio = total > 0 ? headshots / total : 0;
  const hpRatio = health / maxHealth;
  const score = (kills / Math.max(total, 1)) * 40 + hsRatio * 35 + hpRatio * 25;
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  return "C";
}

function ratingColor(r: string): string {
  switch (r) {
    case "S": return "#ffd700";
    case "A": return "#22c55e";
    case "B": return "#3b82f6";
    default: return "#94a3b8";
  }
}

export function HUD() {
  const g = useGame((s) => s);
  const [muted, setMutedState] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const start = () => {
    initAudio();
    resetGame();
    spawnRound(1);
    setGame({ phase: "playing" });
    sfx.roundStart();
  };

  const nextRound = () => {
    const r = getGame().round + 1;
    setGame({ round: r, phase: "playing", health: Math.min(200, getGame().health + 40) });
    spawnRound(r);
    sfx.roundStart();
  };

  const cycleScope = () => {
    const next = getGame().scope === 10 ? 0 : 10;
    setGame({ scope: next as 0 | 10 });
    sfx.scope(next !== 0);
  };

  const killMsgVisible = performance.now() - g.lastKillAt < 1400;
  const cfg = roundConfig(g.round);
  const hpPct = g.health / g.maxHealth;
  const isHeadshot = g.lastKillMsg.includes("HEADSHOT");

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-foreground">
      {g.scope > 0 && g.phase === "playing" && <Scope level={g.scope} />}

      {/* hit flash */}
      {g.hitFlash > 0 && (
        <div
          className="absolute inset-0 z-30 animate-pulse"
          style={{ boxShadow: "inset 0 0 180px rgba(255,43,214,0.7)" }}
          onAnimationIteration={() => setGame({ hitFlash: 0 })}
        />
      )}

      {/* ====== TOP BAR ====== */}
      {g.phase !== "menu" && (
        <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3 text-xs sm:text-sm">
          {/* Health panel */}
          <div
            className="rounded-lg border bg-black/60 px-4 py-2.5 backdrop-blur-md"
            style={{
              borderColor: healthColor(hpPct) + "40",
              boxShadow: healthGlow(hpPct),
            }}
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill={healthColor(hpPct)} className="opacity-80">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-60">Health</span>
            </div>
            <div className="mt-1.5 h-2.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${hpPct * 100}%`,
                  background: `linear-gradient(90deg, ${healthColor(hpPct)}cc, ${healthColor(hpPct)})`,
                  boxShadow: `0 0 6px ${healthColor(hpPct)}80`,
                }}
              />
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums" style={{ color: healthColor(hpPct) }}>
              {g.health}<span className="text-xs opacity-50"> / {g.maxHealth}</span>
            </div>
          </div>

          {/* Center — Round info */}
          <div className="rounded-lg border border-white/10 bg-black/60 px-5 py-2.5 text-center backdrop-blur-md">
            <div className="flex items-center justify-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  background: g.phase === "playing" ? "#22c55e" : "#ef4444",
                  boxShadow: g.phase === "playing" ? "0 0 6px #22c55e" : "0 0 6px #ef4444",
                }}
              />
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">
                Round {g.round}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white/90 tabular-nums">
              {/* Skull icons for enemies */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#ef4444" className="opacity-70">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-1-3h6l-1 3H10zm5-5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
              </svg>
              <span>{g.enemiesLeft}</span>
              <span className="text-xs opacity-40">/ {g.enemiesTotal}</span>
            </div>
            <div className={`mt-0.5 text-xs font-mono tabular-nums ${g.timeLeft < 20 ? "text-red-400" : "text-white/50"}`}>
              {g.timeLeft < 20 && (
                <span className="mr-1 inline-block animate-pulse">⚠</span>
              )}
              {Math.floor(g.timeLeft / 60)}:{String(Math.floor(g.timeLeft % 60)).padStart(2, "0")}
            </div>
          </div>

          {/* Right — Ammo + Coins */}
          <div className="rounded-lg border border-white/10 bg-black/60 px-4 py-2.5 text-right backdrop-blur-md">
            {/* Coins */}
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-500/70">Coins</span>
              <span className="text-sm font-bold tabular-nums text-yellow-400">{g.coins}</span>
            </div>
            {/* Ammo */}
            <div className="mt-1.5 flex items-center justify-end gap-2">
              {/* Magazine visualization */}
              <div className="flex gap-0.5">
                {Array.from({ length: g.magSize }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3 w-1 rounded-sm transition-all duration-150"
                    style={{
                      background: i < g.ammo ? "#7ad3ff" : "rgba(255,255,255,0.1)",
                      boxShadow: i < g.ammo ? "0 0 3px #7ad3ff60" : "none",
                    }}
                  />
                ))}
              </div>
              <span className="text-sm font-bold tabular-nums text-white/80">
                {g.ammo}<span className="text-xs opacity-40">/{g.reserve}</span>
              </span>
            </div>
            {g.reloading && (
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400 animate-pulse">
                ◈ Reloading
              </div>
            )}
            {/* Stats row */}
            <div className="mt-1 flex items-center justify-end gap-3 text-[10px] text-white/40">
              <span>{g.kills} kills</span>
              <span>{g.headshots} HS</span>
            </div>
          </div>
        </div>
      )}

      {/* ====== KILL FEED ====== */}
      {killMsgVisible && (
        <div
          className="absolute left-1/2 top-[22%] z-30 -translate-x-1/2"
          style={{
            animation: "killSlideIn 0.3s ease-out",
          }}
        >
          <div className="flex items-center gap-2">
            {isHeadshot && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffd700" style={{ filter: "drop-shadow(0 0 4px rgba(255,215,0,0.6))" }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-1-3h6l-1 3H10zm5-5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
              </svg>
            )}
            <span
              className="text-lg font-black tracking-[0.2em] drop-shadow-lg"
              style={{
                color: isHeadshot ? "#ffd700" : "#fff",
                textShadow: isHeadshot
                  ? "0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)"
                  : "0 0 10px rgba(255,255,255,0.4)",
              }}
            >
              {g.lastKillMsg}
            </span>
          </div>
        </div>
      )}

      {/* free-look crosshair */}
      {g.phase === "playing" && g.scope === 0 && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-6 w-6">
            <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-px bg-white/60" />
            <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-px bg-white/60" />
            <div className="absolute left-0 top-1/2 h-px w-2 -translate-y-px bg-white/60" />
            <div className="absolute right-0 top-1/2 h-px w-2 -translate-y-px bg-white/60" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
          </div>
        </div>
      )}

      {/* touch look layer */}
      {isTouch && g.phase === "playing" && (
        <div
          className="pointer-events-auto absolute inset-y-0 right-0 z-20 w-1/2 touch-none"
          onPointerDown={(e) => {
            lookId.current = e.pointerId;
            lookLast.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (lookId.current !== e.pointerId) return;
            input.lookDX = (e.clientX - lookLast.current.x) * 2.2;
            input.lookDY = (e.clientY - lookLast.current.y) * 2.2;
            lookLast.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => (lookId.current = null)}
        />
      )}

      {/* mobile controls */}
      {isTouch && g.phase === "playing" && (
        <>
          <div className="absolute bottom-6 left-5 z-30">
            <Joystick
              onMove={(x, y) => {
                input.strafe = x;
                input.forward = y;
                input.run = Math.hypot(x, y) > 0.85;
              }}
            />
          </div>
          <div className="absolute bottom-6 right-5 z-30 flex flex-col items-end gap-3">
            <div className="flex gap-3">
              <HudButton label={g.scope ? `${g.scope}X` : "SCOPE"} onPress={cycleScope} />
              <HudButton label={g.crouched ? "STAND" : "SIT"} onPress={() => setGame({ crouched: !g.crouched })} />
            </div>
            <div className="flex items-center gap-3">
              <HudButton label="RELOAD" onPress={() => (window as any).__startReload?.()} />
              <button
                className="pointer-events-auto h-20 w-20 rounded-full border-2 border-destructive/70 bg-destructive/30 text-sm font-bold tracking-widest text-foreground active:scale-95"
                onPointerDown={queueFire}
              >
                FIRE
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====== MENU SCREEN ====== */}
      {g.phase === "menu" && (
        <Overlay>
          <div className="relative">
            {/* Glow behind title */}
            <div
              className="absolute inset-0 blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)",
              }}
            />
            <h1 className="relative text-5xl font-black tracking-[0.15em] text-white sm:text-7xl">
              ROOFTOP
              <br />
              <span
                className="text-red-500"
                style={{
                  textShadow: "0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.2)",
                }}
              >
                SNIPER
              </span>
            </h1>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/50">
            You hold the high ground over a broken village. Range the hostiles on rooftops and streets,
            control your breath, and drop them before they range you.
          </p>
          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-left text-xs text-white/40 backdrop-blur-sm">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Controls</div>
            <div className="grid gap-1.5">
              <span><b className="text-white/60">PC</b> — WASD move · Mouse look · LMB fire · RMB / Z scope</span>
              <span><b className="text-white/60">PC</b> — C sit · Shift run · Space hold breath · R reload</span>
              <span><b className="text-white/60">Mobile</b> — left stick move · right side look · on-screen buttons</span>
            </div>
          </div>
          <PrimaryButton onClick={start}>Deploy</PrimaryButton>
        </Overlay>
      )}

      {/* ====== ROUND OVER ====== */}
      {g.phase === "roundover" && (() => {
        const rating = getRating(g.kills, g.headshots, g.enemiesTotal, g.health, g.maxHealth);
        return (
          <Overlay>
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-green-400/70">Mission Complete</div>
            <h2 className="mt-2 text-4xl font-black tracking-[0.15em] text-white">SECTOR CLEAR</h2>
            {/* Rating */}
            <div
              className="mt-4 text-6xl font-black"
              style={{
                color: ratingColor(rating),
                textShadow: `0 0 30px ${ratingColor(rating)}60`,
              }}
            >
              {rating}
            </div>
            {/* Stats table */}
            <div className="mt-4 w-72 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-white/40">Round</span>
                <span className="text-right font-bold text-white/80">{g.round}</span>
                <span className="text-white/40">Kills</span>
                <span className="text-right font-bold text-white/80">{g.kills}</span>
                <span className="text-white/40">Headshots</span>
                <span className="text-right font-bold text-yellow-400">{g.headshots}</span>
                <span className="text-white/40">Coins</span>
                <span className="text-right font-bold text-yellow-400">{g.coins}</span>
                <span className="text-white/40">Health</span>
                <span className="text-right font-bold" style={{ color: healthColor(hpPct) }}>{g.health}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-red-400/70">
              Round {g.round + 1}: {roundConfig(g.round + 1).enemies} hostiles · {roundConfig(g.round + 1).coinPerKill} coins/kill
            </p>
            <PrimaryButton onClick={nextRound}>Next Round</PrimaryButton>
          </Overlay>
        );
      })()}

      {/* ====== GAME OVER ====== */}
      {g.phase === "gameover" && (() => {
        const rating = getRating(g.kills, g.headshots, g.enemiesTotal, 0, g.maxHealth);
        return (
          <Overlay>
            <div
              className="text-5xl font-black tracking-[0.15em]"
              style={{
                color: "#ef4444",
                textShadow: "0 0 40px rgba(239,68,68,0.5), 0 0 80px rgba(239,68,68,0.2)",
              }}
            >
              YOU ARE DOWN
            </div>
            {/* Rating */}
            <div
              className="mt-3 text-5xl font-black"
              style={{
                color: ratingColor(rating),
                textShadow: `0 0 20px ${ratingColor(rating)}40`,
              }}
            >
              {rating}
            </div>
            {/* Stats */}
            <div className="mt-4 w-72 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-white/40">Rounds</span>
                <span className="text-right font-bold text-white/80">{g.round}</span>
                <span className="text-white/40">Total Kills</span>
                <span className="text-right font-bold text-white/80">{g.kills}</span>
                <span className="text-white/40">Headshots</span>
                <span className="text-right font-bold text-yellow-400">{g.headshots}</span>
                <span className="text-white/40">Coins Earned</span>
                <span className="text-right font-bold text-yellow-400">{g.coins}</span>
                <span className="text-white/40">Accuracy</span>
                <span className="text-right font-bold text-cyan-400">
                  {g.kills > 0 ? Math.round((g.headshots / g.kills) * 100) : 0}% HS
                </span>
              </div>
            </div>
            <PrimaryButton onClick={start}>Redeploy</PrimaryButton>
          </Overlay>
        );
      })()}

      {/* mute button */}
      <button
        className="pointer-events-auto absolute bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-white/40 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white/60"
        onClick={() => {
          const m = !muted;
          setMutedState(m);
          setMuted(m);
        }}
      >
        {muted ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        )}
        <span>{muted ? "off" : "on"}</span>
      </button>

      {g.phase === "playing" && !isTouch && !input.pointerLocked && (
        <div className="absolute inset-x-0 bottom-24 z-30 text-center text-xs text-white/40">
          click to capture mouse · {cfg.coinPerKill} coins per kill
        </div>
      )}

      {/* Kill slide-in animation */}
      <style>{`
        @keyframes killSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.9); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function HudButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      className="pointer-events-auto rounded-md border border-primary/40 bg-background/50 px-3 py-2 text-[11px] font-bold tracking-widest text-foreground backdrop-blur-sm active:scale-95"
      onPointerDown={onPress}
    >
      {label}
    </button>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 px-6 text-center backdrop-blur-md">
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-8 rounded-lg border border-red-500/40 bg-red-500/15 px-10 py-3.5 text-sm font-bold uppercase tracking-[0.3em] text-white transition-all hover:border-red-500/60 hover:bg-red-500/25 hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
    >
      {children}
    </button>
  );
}
