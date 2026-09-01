import { useSyncExternalStore } from "react";

export type Phase = "menu" | "briefing" | "playing" | "roundover" | "gameover";

export interface GameState {
  phase: Phase;
  round: number;
  health: number;
  maxHealth: number;
  coins: number;
  ammo: number;
  magSize: number;
  reserve: number;
  reloading: boolean;
  scope: 0 | 10;
  crouched: boolean;
  timeLeft: number;
  enemiesLeft: number;
  enemiesTotal: number;
  kills: number;
  headshots: number;
  hitFlash: number;
  lastKillMsg: string;
  lastKillAt: number;
}

const initial: GameState = {
  phase: "menu",
  round: 1,
  health: 200,
  maxHealth: 200,
  coins: 0,
  ammo: 5,
  magSize: 5,
  reserve: 40,
  reloading: false,
  scope: 0,
  crouched: false,
  timeLeft: 100,
  enemiesLeft: 0,
  enemiesTotal: 0,
  kills: 0,
  headshots: 0,
  hitFlash: 0,
  lastKillMsg: "",
  lastKillAt: 0,
};

let state: GameState = { ...initial };
const listeners = new Set<() => void>();

export function setGame(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getGame() {
  return state;
}

export function resetGame() {
  state = { ...initial };
  listeners.forEach((l) => l());
}

export function useGame<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

export const roundConfig = (round: number) => ({
  enemies: Math.min(4 + round * 2, 16),
  enemyHealth: 55 + round * 12,
  enemyDamage: 12 + round * 4,
  enemyAccuracy: Math.min(0.18 + round * 0.05, 0.6),
  enemyFireRate: Math.max(2.4 - round * 0.18, 0.8),
  enemySpeed: 2.2 + round * 0.25,
  coinPerKill: 10 + (round - 1) * 5,
  time: 110 + round * 10,
});
