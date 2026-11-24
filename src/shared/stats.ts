import type { GameState, RoundResult } from '../features/matgo_game/model/engine';

/** 전적과 가상 머니. 점당 100냥. */

export const POINT_VALUE = 100;
const KEY = 'motgo.stats.v1';

export interface Stats {
  money: number;
  played: number;
  wins: number;
  losses: number;
  nagari: number;
  bestWin: number;
  maxGo: number;
  streak: number;
}

function load(): Stats {
  const d: Stats = { money: 100000, played: 0, wins: 0, losses: 0, nagari: 0, bestWin: 0, maxGo: 0, streak: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...d, ...JSON.parse(raw) };
  } catch {
    /* 무시 */
  }
  return d;
}

export const stats: Stats = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* 무시 */
  }
}

/** 판 결과를 기록하고 머니 변동(+/-)을 돌려준다 */
export function recordRound(result: RoundResult, state: GameState): number {
  stats.played++;
  let delta = 0;
  if (result.winner === null) {
    stats.nagari++;
  } else {
    const pts = result.settlement?.final ?? 0;
    delta = pts * POINT_VALUE * (result.winner === 0 ? 1 : -1);
    if (result.winner === 0) {
      stats.wins++;
      stats.bestWin = Math.max(stats.bestWin, pts);
      stats.streak = stats.streak >= 0 ? stats.streak + 1 : 1;
    } else {
      stats.losses++;
      stats.streak = stats.streak <= 0 ? stats.streak - 1 : -1;
    }
    stats.maxGo = Math.max(stats.maxGo, state.players[0].goCount);
  }
  stats.money += delta;
  // 파산하면 무료로 다시 채워 준다
  if (stats.money <= 0) stats.money = 100000;
  save();
  return delta;
}

export function resetStats() {
  Object.assign(stats, { money: 100000, played: 0, wins: 0, losses: 0, nagari: 0, bestWin: 0, maxGo: 0, streak: 0 });
  save();
}
