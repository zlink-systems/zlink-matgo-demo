import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { floorMatches, isBomb } from '../model/engine';
import { initialMatchState, matchReducer } from '../model/reducer';
import type { MatchEvent } from '../model/types';
import { isHidden } from '../model/view';
import { COMPUTER_DELAY_MS, LocalMatchGateway } from './local-match-gateway';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setup(seed = 7) {
  const gateway = new LocalMatchGateway(seeded(seed));
  const events: MatchEvent[] = [];
  let state = initialMatchState;
  gateway.subscribe((event) => {
    events.push(event);
    state = matchReducer(state, event);
  });
  return {
    gateway,
    events,
    get state() {
      return state;
    },
  };
}

/** 사람 차례에 낼 만한 패: 먹을 수 있는 패가 있으면 그 패, 없으면 첫 장 */
function pickCard(m: ReturnType<typeof setup>) {
  const v = m.state.view!;
  const hand = v.players[0].hand;
  return hand.find((id) => floorMatches(v, id).length > 0 || isBomb(v, id)) ?? hand[0];
}

it('첫 판을 나눠 주고 상대 손패와 더미를 가린다', () => {
  const m = setup();
  m.gateway.start({ difficulty: 'normal' });
  expect(m.events[0].type).toBe('RoundStarted');
  const v = m.state.view!;
  expect(m.state.round).toBe(1);
  expect(v.players[0].hand.some(isHidden)).toBe(false);
  expect(v.players[1].hand.every(isHidden)).toBe(true);
  expect(v.deck.every(isHidden)).toBe(true);
  m.gateway.dispose();
});

it('차례가 아니거나 손에 없는 패는 거절하고 판을 그대로 둔다', () => {
  const m = setup();
  m.gateway.start({ difficulty: 'normal' });
  if (m.state.view!.turn !== 0) vi.advanceTimersByTime(COMPUTER_DELAY_MS);
  const before = m.state.view;
  m.gateway.requestPlay('not-a-card');
  expect(m.state.lastRejected).toBe('illegal-action');
  expect(m.state.view).toBe(before);
  m.gateway.requestGoStop(true);
  expect(m.state.lastRejected).toBe('not-your-turn');
  m.gateway.requestNextRound();
  expect(m.state.lastRejected).toBe('round-in-progress');
  m.gateway.dispose();
});

it('사람이 패를 내면 결과를 보내고, 컴퓨터는 잠시 뒤 둔다', () => {
  const m = setup();
  m.gateway.start({ difficulty: 'normal' });
  const card = pickCard(m);
  const targets = floorMatches(m.state.view!, card);
  m.gateway.requestPlay(card, targets.length === 2 ? targets[0] : undefined);
  const mine = m.events.at(-1)!;
  expect(mine).toMatchObject({ type: 'ActionResolved', actor: 0 });
  if (m.state.view!.turn === 1 && m.state.status === 'playing') {
    const count = m.events.length;
    vi.advanceTimersByTime(COMPUTER_DELAY_MS - 1);
    expect(m.events).toHaveLength(count);
    vi.advanceTimersByTime(1);
    expect(m.events.at(-1)).toMatchObject({ type: 'ActionResolved', actor: 1 });
  }
  m.gateway.dispose();
});

it('한 판을 끝까지 두고 다음 판을 시작한다', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const m = setup(seed);
    m.gateway.start({ difficulty: 'hard' });
    for (let guard = 0; guard < 400 && m.state.status === 'playing'; guard++) {
      const v = m.state.view!;
      if (v.turn === 1) {
        vi.advanceTimersByTime(COMPUTER_DELAY_MS);
        continue;
      }
      if (v.phase === 'goStop') {
        m.gateway.requestGoStop(false);
        continue;
      }
      const card = pickCard(m);
      const targets = floorMatches(v, card);
      m.gateway.requestPlay(card, targets.length === 2 ? targets[0] : undefined);
    }
    expect(m.state.status).toBe('roundOver');
    expect(m.events.some((e) => e.type === 'ActionRejected')).toBe(false);
    m.gateway.requestNextRound();
    expect(m.state.round).toBe(2);
    expect(m.state.status).not.toBe('idle');
    m.gateway.dispose();
  }
});

it('dispose와 다시 시작은 대기 중인 컴퓨터 행동을 취소하고, 구독을 끊으면 이벤트가 오지 않는다', () => {
  const m = setup();
  m.gateway.start({ difficulty: 'easy' });
  const listener = vi.fn();
  const off = m.gateway.subscribe(listener);
  off();
  m.gateway.start({ difficulty: 'easy' });
  expect(m.state.round).toBe(1);
  m.gateway.dispose();
  vi.runAllTimers();
  expect(listener).not.toHaveBeenCalled();
});
