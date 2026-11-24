import { ALL_CARDS, cardById, type Card } from './cards';
import { scoreCards, settle, type Settlement } from './scoring';

/** 맞고 규칙 엔진. 화면과 무관한 순수 로직. 행동 하나를 적용하면 새 상태와 연출용 이벤트 목록을 돌려준다. */

export type PlayerId = 0 | 1;
export const HUMAN: PlayerId = 0;
export const AI: PlayerId = 1;
export const WIN_SCORE = 7;

export interface PlayerState {
  hand: string[];
  captured: string[];
  goCount: number;
  /** 마지막으로 고를 부른 시점의 점수 */
  lastGoScore: number;
  shakes: number;
  ppeokCount: number;
  turnsTaken: number;
}

export type Phase = 'play' | 'goStop' | 'over';

export interface RoundResult {
  winner: PlayerId | null; // null = 나가리
  reason: 'stop' | 'chongtong' | 'samppeok' | 'nagari' | 'lastTurn';
  settlement?: Settlement;
}

export interface GameState {
  deck: string[];
  floor: string[];
  players: [PlayerState, PlayerState];
  turn: PlayerId;
  phase: Phase;
  /** 뻑을 만든 사람 (월 → 플레이어). 자뻑 판정용 */
  ppeokOwner: Record<number, PlayerId>;
  /** 나가리로 누적된 배수 */
  carry: number;
  dummyCounter: number;
  result?: RoundResult;
}

export type GameEvent =
  | { type: 'deal'; hands: [string[], string[]]; floor: string[]; deckCount: number }
  | { type: 'floorBonus'; card: string; to: PlayerId; replacement: string }
  | { type: 'play'; player: PlayerId; card: string; target?: string; shake?: boolean }
  | { type: 'bomb'; player: PlayerId; cards: string[]; target: string }
  | { type: 'dummy'; player: PlayerId; card: string }
  | { type: 'bonusPlay'; player: PlayerId; card: string; drawn?: string }
  | { type: 'flip'; player: PlayerId; card: string; target?: string }
  | { type: 'bonusFlip'; player: PlayerId; card: string }
  | { type: 'capture'; player: PlayerId; cards: string[] }
  | { type: 'special'; player: PlayerId; kind: SpecialKind }
  | { type: 'steal'; from: PlayerId; to: PlayerId; card: string }
  | { type: 'score'; player: PlayerId; score: number }
  | { type: 'goStopPrompt'; player: PlayerId; score: number }
  | { type: 'go'; player: PlayerId; count: number }
  | { type: 'stop'; player: PlayerId }
  | { type: 'turn'; player: PlayerId }
  | { type: 'roundOver'; result: RoundResult };

export type SpecialKind =
  | 'jjok'
  | 'ppeok'
  | 'firstPpeok'
  | 'ttadak'
  | 'sweep'
  | 'bomb'
  | 'shake'
  | 'ppeokEat'
  | 'jappeok'
  | 'chongtong'
  | 'samppeok'
  | 'godori'
  | 'hongdan'
  | 'cheongdan'
  | 'chodan'
  | 'samgwang'
  | 'sagwang'
  | 'ogwang';

export type Action = { type: 'play'; card: string; target?: string; shake?: boolean } | { type: 'go' } | { type: 'stop' };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export type Rng = () => number;

export const defaultRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isDummy = (id: string) => id.startsWith('dummy');
export const cardOf = (id: string): Card | null => (isDummy(id) ? null : cardById(id));
export const monthOf = (id: string) => (isDummy(id) ? -1 : cardById(id).month);
export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function emptyPlayer(): PlayerState {
  return { hand: [], captured: [], goCount: 0, lastGoScore: 0, shakes: 0, ppeokCount: 0, turnsTaken: 0 };
}

/** 카드 가치 (먹을 패 고를 때 쓰는 기본 우선순위) */
export function cardValue(id: string): number {
  const c = cardOf(id);
  if (!c) return 0;
  if (c.kind === 'gwang') return c.biGwang ? 18 : 20;
  if (c.kind === 'yeol') return c.godori ? 16 : c.gukjin ? 15 : 12;
  if (c.kind === 'tti') return c.ttiKind === 'none' ? 9 : 11;
  return c.piValue >= 2 ? 10 : 5;
}

function bestOf(ids: string[]): string {
  return [...ids].sort((a, b) => cardValue(b) - cardValue(a))[0];
}

/** 새 판. 선(first)이 먼저 친다. */
export function newRound(first: PlayerId, carry = 1, rng: Rng = defaultRng, presetDeck?: string[]): StepResult {
  for (let attempt = 0; attempt < 100; attempt++) {
    const deck = presetDeck
      ? [...presetDeck]
      : shuffle(
          ALL_CARDS.map((c) => c.id),
          rng,
        );
    const players: [PlayerState, PlayerState] = [emptyPlayer(), emptyPlayer()];
    const floor: string[] = [];
    // 바닥 4 → 선 5 → 후 5 → 바닥 4 → 선 5 → 후 5
    const second = other(first);
    floor.push(...deck.splice(0, 4));
    players[first].hand.push(...deck.splice(0, 5));
    players[second].hand.push(...deck.splice(0, 5));
    floor.push(...deck.splice(0, 4));
    players[first].hand.push(...deck.splice(0, 5));
    players[second].hand.push(...deck.splice(0, 5));

    // 바닥에 같은 월 4장이면 다시 섞음
    const counts = new Map<number, number>();
    for (const id of floor) if (!cardById(id).bonus) counts.set(monthOf(id), (counts.get(monthOf(id)) ?? 0) + 1);
    if ([...counts.values()].some((n) => n === 4) && !presetDeck) continue;

    const events: GameEvent[] = [
      {
        type: 'deal',
        hands: [[...players[0].hand], [...players[1].hand]],
        floor: [...floor],
        deckCount: deck.length,
      },
    ];

    // 바닥 보너스피는 선이 가져가고 더미에서 채움
    for (let i = 0; i < floor.length; i++) {
      while (cardById(floor[i]).bonus && deck.length > 0) {
        const bonus = floor[i];
        const replacement = deck.shift()!;
        players[first].captured.push(bonus);
        floor[i] = replacement;
        events.push({ type: 'floorBonus', card: bonus, to: first, replacement });
      }
    }

    const state: GameState = { deck, floor, players, turn: first, phase: 'play', ppeokOwner: {}, carry, dummyCounter: 0 };

    // 총통: 손에 같은 월 4장
    for (const p of [first, second] as PlayerId[]) {
      const byMonth = new Map<number, number>();
      for (const id of players[p].hand) {
        const m = monthOf(id);
        if (m > 0) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
      }
      if ([...byMonth.values()].some((n) => n === 4)) {
        events.push({ type: 'special', player: p, kind: 'chongtong' });
        state.phase = 'over';
        state.result = {
          winner: p,
          reason: 'chongtong',
          settlement: {
            base: WIN_SCORE,
            goBonus: 0,
            multipliers: carry > 1 ? [{ label: '나가리', factor: carry }] : [],
            final: WIN_SCORE * carry,
          },
        };
        events.push({ type: 'roundOver', result: state.result });
        return { state, events };
      }
    }
    events.push({ type: 'turn', player: first });
    return { state, events };
  }
  throw new Error('could not deal');
}

/** 손에 든 패로 할 수 있는 행동 */
export function legalPlays(state: GameState): string[] {
  if (state.phase !== 'play') return [];
  return [...state.players[state.turn].hand];
}

export function floorMatches(state: GameState, cardId: string): string[] {
  const m = monthOf(cardId);
  if (m <= 0) return [];
  return state.floor.filter((id) => monthOf(id) === m);
}

/** 흔들기 가능: 손에 같은 월 3장, 바닥에 0장 */
export function canShake(state: GameState, cardId: string): boolean {
  const m = monthOf(cardId);
  if (m <= 0) return false;
  const p = state.players[state.turn];
  return p.hand.filter((id) => monthOf(id) === m).length === 3 && floorMatches(state, cardId).length === 0;
}

/** 폭탄 가능: 손에 같은 월 3장, 바닥에 1장 */
export function isBomb(state: GameState, cardId: string): boolean {
  const m = monthOf(cardId);
  if (m <= 0) return false;
  const p = state.players[state.turn];
  return p.hand.filter((id) => monthOf(id) === m).length === 3 && floorMatches(state, cardId).length === 1;
}

/** 손패를 냈을 때 바닥에서 고를 수 있는 서로 다른 대상 (2장이 겹쳐 있을 때) */
export function needsTargetChoice(state: GameState, cardId: string): string[] {
  const matches = floorMatches(state, cardId);
  if (matches.length !== 2 || isBomb(state, cardId)) return [];
  const [a, b] = matches;
  const ca = cardById(a),
    cb = cardById(b);
  const same = ca.kind === cb.kind && ca.piValue === cb.piValue && ca.ttiKind === cb.ttiKind;
  return same ? [] : matches;
}

function remove(arr: string[], id: string) {
  const i = arr.indexOf(id);
  if (i < 0) throw new Error(`card ${id} not found`);
  arr.splice(i, 1);
}

function stealPi(state: GameState, to: PlayerId, events: GameEvent[], times = 1) {
  const from = other(to);
  for (let t = 0; t < times; t++) {
    const cap = state.players[from].captured;
    const pis = cap.filter((id) => {
      const c = cardById(id);
      return c.kind === 'pi';
    });
    if (pis.length === 0) return;
    // 일반 피 → 쌍피 → 보너스 순으로 내준다
    pis.sort((a, b) => cardById(a).piValue - cardById(b).piValue);
    const card = pis[0];
    remove(cap, card);
    state.players[to].captured.push(card);
    events.push({ type: 'steal', from, to, card });
  }
}

const clone = (s: GameState): GameState => structuredClone(s);

export function apply(prev: GameState, action: Action): StepResult {
  const state = clone(prev);
  const events: GameEvent[] = [];
  if (state.phase === 'over') throw new Error('round is over');

  if (action.type === 'go' || action.type === 'stop') {
    if (state.phase !== 'goStop') throw new Error('not in go/stop phase');
    const p = state.turn;
    const ps = state.players[p];
    if (action.type === 'go') {
      ps.goCount += 1;
      ps.lastGoScore = scoreCards(ps.captured).total;
      events.push({ type: 'go', player: p, count: ps.goCount });
      state.phase = 'play';
      nextTurn(state, events);
    } else {
      events.push({ type: 'stop', player: p });
      finishWin(state, p, 'stop', events);
    }
    return { state, events };
  }

  if (state.phase !== 'play') throw new Error('not in play phase');
  const p = state.turn;
  const me = state.players[p];
  const card = action.card;
  if (!me.hand.includes(card)) throw new Error(`card ${card} not in hand`);
  const before = scoreCards(me.captured);
  const toCapture: string[] = [];

  // --- 보너스피 내기: 먹고, 더미에서 한 장 받아 다시 낸다
  const cardInfo = cardOf(card);
  if (cardInfo?.bonus) {
    remove(me.hand, card);
    me.captured.push(card);
    const drawn = state.deck.shift();
    if (drawn) me.hand.push(drawn);
    events.push({ type: 'bonusPlay', player: p, card, drawn });
    events.push({ type: 'capture', player: p, cards: [card] });
    stealPi(state, p, events);
    emitScore(state, p, before.total, events);
    if (me.hand.length === 0) nextTurn(state, events);
    return { state, events };
  }

  me.turnsTaken += 1;
  const firstTurn = me.turnsTaken === 1;

  type HandStep =
    | { kind: 'none' }
    | { kind: 'placed'; card: string; month: number }
    | { kind: 'pair'; card: string; target: string; month: number }
    | { kind: 'doublePair'; card: string; target: string; other: string; month: number }
    | { kind: 'done'; month: number };
  let hs: HandStep = { kind: 'none' };

  if (isDummy(card)) {
    remove(me.hand, card);
    events.push({ type: 'dummy', player: p, card });
  } else {
    const m = monthOf(card);
    const matches = floorMatches(state, card);
    if (isBomb(state, card)) {
      const three = me.hand.filter((id) => monthOf(id) === m);
      three.forEach((id) => remove(me.hand, id));
      const target = matches[0];
      remove(state.floor, target);
      toCapture.push(...three, target);
      me.shakes += 1;
      events.push({ type: 'bomb', player: p, cards: three, target });
      events.push({ type: 'special', player: p, kind: 'bomb' });
      stealPi(state, p, events);
      me.hand.push(`dummy-${state.dummyCounter++}`, `dummy-${state.dummyCounter++}`);
      hs = { kind: 'done', month: m };
    } else {
      const shake = !!action.shake && canShake(state, card);
      if (shake) {
        me.shakes += 1;
        events.push({ type: 'special', player: p, kind: 'shake' });
      }
      remove(me.hand, card);
      if (matches.length === 0) {
        state.floor.push(card);
        events.push({ type: 'play', player: p, card, shake });
        hs = { kind: 'placed', card, month: m };
      } else if (matches.length === 1) {
        events.push({ type: 'play', player: p, card, target: matches[0], shake });
        hs = { kind: 'pair', card, target: matches[0], month: m };
      } else if (matches.length === 2) {
        const target = action.target && matches.includes(action.target) ? action.target : bestOf(matches);
        const otherCard = matches.find((x) => x !== target)!;
        events.push({ type: 'play', player: p, card, target, shake });
        hs = { kind: 'doublePair', card, target, other: otherCard, month: m };
      } else {
        // 뻑 먹기: 바닥 3장 + 낸 패
        events.push({ type: 'play', player: p, card, target: matches[0], shake });
        matches.forEach((id) => remove(state.floor, id));
        toCapture.push(card, ...matches);
        const own = state.ppeokOwner[m] === p;
        delete state.ppeokOwner[m];
        events.push({ type: 'special', player: p, kind: own ? 'jappeok' : 'ppeokEat' });
        stealPi(state, p, events, own ? 2 : 1);
        hs = { kind: 'done', month: m };
      }
    }
  }

  // --- 더미 뒤집기
  let flipped: string | undefined;
  while (state.deck.length > 0) {
    const f = state.deck.shift()!;
    if (cardById(f).bonus) {
      me.captured.push(f);
      events.push({ type: 'bonusFlip', player: p, card: f });
      events.push({ type: 'capture', player: p, cards: [f] });
      stealPi(state, p, events);
      continue;
    }
    flipped = f;
    break;
  }

  if (flipped) {
    const fm = monthOf(flipped);
    if (hs.kind === 'placed' && fm === hs.month) {
      // 쪽
      events.push({ type: 'flip', player: p, card: flipped, target: hs.card });
      remove(state.floor, hs.card);
      toCapture.push(hs.card, flipped);
      events.push({ type: 'special', player: p, kind: 'jjok' });
      stealPi(state, p, events);
    } else if (hs.kind === 'pair' && fm === hs.month) {
      // 뻑: 셋 다 바닥에 남는다
      events.push({ type: 'flip', player: p, card: flipped, target: hs.target });
      state.floor.push(hs.card, flipped);
      state.ppeokOwner[hs.month] = p;
      me.ppeokCount += 1;
      events.push({ type: 'special', player: p, kind: firstTurn ? 'firstPpeok' : 'ppeok' });
      if (firstTurn) stealPi(state, p, events);
      hs = { kind: 'none' };
    } else if (hs.kind === 'doublePair' && fm === hs.month) {
      // 따닥
      events.push({ type: 'flip', player: p, card: flipped, target: hs.other });
      remove(state.floor, hs.target);
      remove(state.floor, hs.other);
      toCapture.push(hs.card, hs.target, hs.other, flipped);
      events.push({ type: 'special', player: p, kind: 'ttadak' });
      stealPi(state, p, events);
      hs = { kind: 'none' };
    } else {
      const fMatches = state.floor.filter((id) => monthOf(id) === fm);
      if (fMatches.length === 0) {
        state.floor.push(flipped);
        events.push({ type: 'flip', player: p, card: flipped });
      } else if (fMatches.length === 1 || fMatches.length === 2) {
        const target = fMatches.length === 1 ? fMatches[0] : bestOf(fMatches);
        events.push({ type: 'flip', player: p, card: flipped, target });
        remove(state.floor, target);
        toCapture.push(flipped, target);
      } else {
        events.push({ type: 'flip', player: p, card: flipped, target: fMatches[0] });
        fMatches.forEach((id) => remove(state.floor, id));
        toCapture.push(flipped, ...fMatches);
        const own = state.ppeokOwner[fm] === p;
        delete state.ppeokOwner[fm];
        events.push({ type: 'special', player: p, kind: own ? 'jappeok' : 'ppeokEat' });
        stealPi(state, p, events, own ? 2 : 1);
      }
    }
  }

  // 손패 단계에서 맞춘 짝을 확정
  if (hs.kind === 'pair' || hs.kind === 'doublePair') {
    remove(state.floor, hs.target);
    toCapture.unshift(hs.card, hs.target);
  }

  if (toCapture.length > 0) {
    me.captured.push(...toCapture);
    events.push({ type: 'capture', player: p, cards: toCapture });
  }

  // 싹쓸이 (마지막 턴 제외)
  const lastTurn = state.players[0].hand.length === 0 && state.players[1].hand.length === 0;
  if (state.floor.length === 0 && toCapture.length > 0 && !lastTurn) {
    events.push({ type: 'special', player: p, kind: 'sweep' });
    stealPi(state, p, events);
  }

  // 삼뻑
  if (me.ppeokCount >= 3) {
    events.push({ type: 'special', player: p, kind: 'samppeok' });
    state.phase = 'over';
    state.result = {
      winner: p,
      reason: 'samppeok',
      settlement: {
        base: WIN_SCORE,
        goBonus: 0,
        multipliers: state.carry > 1 ? [{ label: '나가리', factor: state.carry }] : [],
        final: WIN_SCORE * state.carry,
      },
    };
    events.push({ type: 'roundOver', result: state.result });
    return { state, events };
  }

  const after = emitScore(state, p, before.total, events);

  const threshold = me.goCount > 0 ? me.lastGoScore + 1 : WIN_SCORE;
  if (after >= threshold) {
    if (me.hand.length === 0 || state.deck.length === 0) {
      finishWin(state, p, 'lastTurn', events);
    } else {
      state.phase = 'goStop';
      events.push({ type: 'goStopPrompt', player: p, score: after });
    }
    return { state, events };
  }

  nextTurn(state, events);
  return { state, events };
}

function emitScore(state: GameState, p: PlayerId, beforeTotal: number, events: GameEvent[]): number {
  const s = scoreCards(state.players[p].captured);
  if (s.total !== beforeTotal) events.push({ type: 'score', player: p, score: s.total });
  return s.total;
}

/** 족보 달성 여부를 이전/이후 점수표로 비교해 연출 이벤트를 만든다 (화면 쪽에서 사용) */
export function comboEvents(beforeIds: readonly string[], afterIds: readonly string[]): SpecialKind[] {
  const a = scoreCards(beforeIds),
    b = scoreCards(afterIds);
  const out: SpecialKind[] = [];
  if (!a.godori && b.godori) out.push('godori');
  if (!a.hongdan && b.hongdan) out.push('hongdan');
  if (!a.cheongdan && b.cheongdan) out.push('cheongdan');
  if (!a.chodan && b.chodan) out.push('chodan');
  if (a.gwangCount < 3 && b.gwangCount === 3) out.push('samgwang');
  if (a.gwangCount < 4 && b.gwangCount === 4) out.push('sagwang');
  if (a.gwangCount < 5 && b.gwangCount === 5) out.push('ogwang');
  return out;
}

function nextTurn(state: GameState, events: GameEvent[]) {
  const n = other(state.turn);
  if (state.players[n].hand.length === 0 && state.players[state.turn].hand.length === 0) {
    // 패가 모두 소진: 나가리
    state.phase = 'over';
    state.result = { winner: null, reason: 'nagari' };
    events.push({ type: 'roundOver', result: state.result });
    return;
  }
  // 상대 손이 비었으면 (보너스피로 손이 남은 경우 등) 내 차례 유지
  state.turn = state.players[n].hand.length > 0 ? n : state.turn;
  events.push({ type: 'turn', player: state.turn });
}

function finishWin(state: GameState, p: PlayerId, reason: RoundResult['reason'], events: GameEvent[]) {
  const me = state.players[p];
  const opp = state.players[other(p)];
  state.phase = 'over';
  state.result = {
    winner: p,
    reason,
    settlement: settle({
      winnerCaptured: me.captured,
      loserCaptured: opp.captured,
      winnerGo: me.goCount,
      loserGo: opp.goCount,
      winnerShakes: me.shakes,
      carry: state.carry,
    }),
  };
  events.push({ type: 'roundOver', result: state.result });
}
