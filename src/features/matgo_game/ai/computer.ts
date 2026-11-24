import {
  canShake,
  cardOf,
  cardValue,
  floorMatches,
  isBomb,
  isDummy,
  monthOf,
  other,
  type Action,
  type GameState,
  type Rng,
  defaultRng,
} from '../model/engine';
import { scoreCards } from '../model/scoring';

import type { Difficulty } from '../model/types';

/**
 * 규칙 기반 AI. 더미 순서와 상대 손패는 보지 않는다 (공정성).
 * 난이도는 판단의 깊이로만 조절한다.
 */
export function chooseAction(state: GameState, difficulty: Difficulty, rng: Rng = defaultRng): Action {
  if (state.phase === 'goStop') return decideGoStop(state, difficulty) ? { type: 'go' } : { type: 'stop' };

  const me = state.players[state.turn];
  const opp = state.players[other(state.turn)];
  const candidates = me.hand.map((card) => {
    const target = bestTarget(state, card, opp.captured);
    return { card, target, score: evaluate(state, card, target, difficulty, opp.captured, me.captured) };
  });

  if (difficulty === 'easy') {
    const capturing = candidates.filter((c) => c.score > 0);
    const pool = capturing.length > 0 && rng() < 0.7 ? capturing : candidates;
    const pick = pool[Math.floor(rng() * pool.length)];
    return { type: 'play', card: pick.card, target: pick.target, shake: canShake(state, pick.card) };
  }

  const noise = difficulty === 'normal' ? 6 : 1;
  for (const c of candidates) c.score += (rng() - 0.5) * noise;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { type: 'play', card: best.card, target: best.target, shake: canShake(state, best.card) };
}

function bestTarget(state: GameState, card: string, oppCaptured: string[]): string | undefined {
  const matches = floorMatches(state, card);
  if (matches.length !== 2) return undefined;
  return [...matches].sort((a, b) => valueFor(b, oppCaptured) - valueFor(a, oppCaptured))[0];
}

/** 상대 족보를 막는 가치까지 더한 카드 가치 */
function valueFor(id: string, oppCaptured: string[]): number {
  const c = cardOf(id);
  if (!c) return 0;
  let v = cardValue(id);
  const opp = oppCaptured.map((x) => cardOf(x)!).filter(Boolean);
  if (c.godori && opp.filter((x) => x.godori).length >= 1) v += 6;
  if (c.ttiKind && c.ttiKind !== 'none' && opp.filter((x) => x.ttiKind === c.ttiKind).length >= 1) v += 5;
  if (c.kind === 'gwang' && opp.filter((x) => x.kind === 'gwang').length >= 2) v += 8;
  return v;
}

function evaluate(
  state: GameState,
  card: string,
  target: string | undefined,
  difficulty: Difficulty,
  oppCaptured: string[],
  myCaptured: string[],
): number {
  if (isDummy(card)) return 1; // 빈패는 부담 없음
  const c = cardOf(card)!;
  if (c.bonus) return 30; // 보너스피는 바로 내는 게 이득
  const matches = floorMatches(state, card);
  const blockWeight = difficulty === 'hard' ? 1 : 0.4;

  if (isBomb(state, card)) return 60;
  if (matches.length === 3) return 55;

  if (matches.length === 0) {
    // 버리는 패: 상대가 먹기 어려운 패(같은 월이 이미 다 나온 패)를 우선 버린다
    const m = monthOf(card);
    const seen = [...myCaptured, ...oppCaptured, ...state.players[state.turn].hand].filter((id) => monthOf(id) === m).length;
    const danger = seen >= 3 ? 0 : valueFor(card, []) * (difficulty === 'hard' ? 1 : 0.6);
    const shakeBonus = canShake(state, card) ? -2 : 0; // 흔들 패는 아껴 두기
    return -danger + shakeBonus;
  }

  const taken = target ?? matches[0];
  let gain = cardValue(card) + cardValue(taken);
  gain += (valueFor(taken, oppCaptured) - cardValue(taken)) * blockWeight;

  // 내 족보 진행
  const before = scoreCards(myCaptured).total;
  const after = scoreCards([...myCaptured, card, taken]).total;
  gain += (after - before) * 8;

  // 바닥에 2장인데 하나만 먹으면 나머지가 남음 (따닥 기대)
  if (matches.length === 2) gain += 2;
  return 10 + gain;
}

function decideGoStop(state: GameState, difficulty: Difficulty): boolean {
  const me = state.players[state.turn];
  const opp = state.players[other(state.turn)];
  const oppScore = scoreCards(opp.captured).total;
  const cardsLeft = me.hand.length;
  if (cardsLeft <= 1) return false;
  if (difficulty === 'easy') return me.goCount < 1 && oppScore < 5;
  // 상대가 날 위험이 크면 멈춘다 (고박 위험)
  const risk = oppScore >= 5 ? 0.85 : oppScore >= 3 ? 0.45 : 0.15;
  const greed = difficulty === 'hard' ? 0.5 : 0.55;
  if (me.goCount >= 3) return false;
  return cardsLeft >= 3 && risk < greed;
}
