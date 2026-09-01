let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(muted: boolean) {
  if (master) master.gain.value = muted ? 0 : 0.6;
}

function noise(dur: number, gain: number, filterFreq: number, q = 1, delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(filterFreq, t);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function tone(
  freq: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
  slideTo?: number,
  delay = 0,
) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  shot() {
    noise(0.35, 1.0, 3200, 0.7);
    tone(160, 0.3, 0.7, "square", 40);
    noise(0.9, 0.22, 700, 0.4, 0.06); // tail / echo
    noise(0.7, 0.12, 400, 0.4, 0.22);
  },
  dryFire() {
    tone(1800, 0.05, 0.15, "square", 600);
  },
  reload() {
    noise(0.08, 0.35, 2600, 2);
    noise(0.09, 0.3, 1800, 2, 0.28);
    tone(700, 0.06, 0.2, "square", 300, 0.55);
  },
  enemyShot(dist: number) {
    const v = Math.max(0.06, 0.6 - dist / 220);
    noise(0.22, v, 2200, 0.8);
    tone(120, 0.18, v * 0.5, "square", 50);
  },
  hitPlayer() {
    tone(90, 0.35, 0.5, "sawtooth", 40);
    noise(0.25, 0.35, 900);
  },
  hitFlesh() {
    noise(0.14, 0.5, 900, 1.5);
    tone(220, 0.12, 0.25, "sine", 80);
  },
  headshot() {
    noise(0.2, 0.7, 1500, 2);
    tone(900, 0.25, 0.35, "triangle", 180);
    tone(1400, 0.5, 0.18, "sine", 700, 0.05);
  },
  kill() {
    tone(660, 0.12, 0.22, "square");
    tone(990, 0.16, 0.2, "square", undefined, 0.1);
  },
  coin() {
    tone(1320, 0.09, 0.18, "triangle");
    tone(1980, 0.12, 0.14, "triangle", undefined, 0.07);
  },
  step(run: boolean) {
    noise(run ? 0.09 : 0.13, run ? 0.18 : 0.1, run ? 900 : 600, 1.2);
  },
  scope(on: boolean) {
    tone(on ? 500 : 900, 0.08, 0.15, "sine", on ? 900 : 500);
  },
  roundStart() {
    tone(330, 0.25, 0.3, "sawtooth");
    tone(440, 0.25, 0.3, "sawtooth", undefined, 0.2);
    tone(660, 0.5, 0.3, "sawtooth", undefined, 0.4);
  },
  gameOver() {
    tone(400, 0.6, 0.35, "sawtooth", 80);
    tone(260, 1.0, 0.3, "square", 50, 0.2);
  },
  ricochet() {
    tone(2200, 0.22, 0.18, "sine", 500);
    noise(0.12, 0.2, 4000, 3);
  },
};
