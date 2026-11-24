import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from './cards';
import { apply, newRound, type GameState, type PlayerId, type Rng } from './engine';
import { scoreCards, settle } from './scoring';
import { chooseAction } from '../ai/computer';
import type { Difficulty } from './types';

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** 원하는 상태를 직접 만든다 */
function make(partial: {
  hand0: string[];
  hand1?: string[];
  floor: string[];
  deck: string[];
  cap0?: string[];
  cap1?: string[];
}): GameState {
  const p = (hand: string[], cap: string[] = []) => ({
    hand,
    captured: cap,
    goCount: 0,
    lastGoScore: 0,
    shakes: 0,
    ppeokCount: 0,
    turnsTaken: 1,
  });
  return {
    deck: partial.deck,
    floor: partial.floor,
    players: [p(partial.hand0, partial.cap0), p(partial.hand1 ?? ['05-pi1'], partial.cap1)],
    turn: 0,
    phase: 'play',
    ppeokOwner: {},
    carry: 1,
    dummyCounter: 0,
  };
}

describe('scoring', () => {
  it('3광, 비광 포함 3광', () => {
    expect(scoreCards(['01-gwang', '03-gwang', '08-gwang']).gwang).toBe(3);
    expect(scoreCards(['01-gwang', '03-gwang', '12-gwang']).gwang).toBe(2);
    expect(scoreCards(['01-gwang', '03-gwang', '08-gwang', '11-gwang', '12-gwang']).gwang).toBe(15);
  });
  it('고도리, 홍단', () => {
    expect(scoreCards(['02-yeol', '04-yeol', '08-yeol']).godori).toBe(5);
    expect(scoreCards(['01-tti', '02-tti', '03-tti']).hongdan).toBe(3);
  });
  it('피 10장 1점, 쌍피 계산', () => {
    const pis = ['01-pi1', '01-pi2', '02-pi1', '02-pi2', '03-pi1', '03-pi2', '04-pi1', '11-ssangpi', '12-ssangpi'];
    expect(scoreCards(pis).piCount).toBe(11);
    expect(scoreCards(pis).pi).toBe(2);
  });
  it('국진은 점수가 높은 쪽으로', () => {
    const pis = ['01-pi1', '01-pi2', '02-pi1', '02-pi2', '03-pi1', '03-pi2', '04-pi1', '04-pi2'];
    const s = scoreCards([...pis, '09-yeol']);
    expect(s.gukjinAsPi).toBe(true);
    expect(s.pi).toBe(1);
  });
  it('정산: 피박, 광박, 고 배수', () => {
    const r = settle({
      winnerCaptured: [
        '01-gwang',
        '03-gwang',
        '08-gwang',
        '01-pi1',
        '01-pi2',
        '02-pi1',
        '02-pi2',
        '03-pi1',
        '03-pi2',
        '04-pi1',
        '04-pi2',
        '05-pi1',
        '05-pi2',
      ],
      loserCaptured: ['06-pi1'],
      winnerGo: 3,
      loserGo: 0,
      winnerShakes: 0,
      carry: 1,
    });
    // 광3 + 피1 = 4, +3고 = 7, x2(3고) x2(피박) x2(광박) = 56
    expect(r.base).toBe(4);
    expect(r.final).toBe(56);
  });
});

describe('special plays', () => {
  it('쪽: 낸 패가 바닥에 없고 뒤집은 패가 같은 월', () => {
    const s = make({ hand0: ['01-gwang', '06-pi1'], floor: ['02-pi1'], deck: ['01-pi1', '07-pi1'], cap1: ['03-pi1'] });
    const r = apply(s, { type: 'play', card: '01-gwang' });
    expect(r.events.some((e) => e.type === 'special' && e.kind === 'jjok')).toBe(true);
    expect(r.state.players[0].captured).toEqual(expect.arrayContaining(['01-gwang', '01-pi1', '03-pi1']));
  });
  it('뻑: 먹은 패와 뒤집은 패가 같은 월이면 셋 다 바닥에', () => {
    const s = make({ hand0: ['01-gwang', '06-pi1'], floor: ['01-pi1'], deck: ['01-pi2', '07-pi1'] });
    const r = apply(s, { type: 'play', card: '01-gwang' });
    expect(r.events.some((e) => e.type === 'special' && e.kind === 'ppeok')).toBe(true);
    expect(r.state.floor).toHaveLength(3);
    expect(r.state.players[0].captured).toHaveLength(0);
  });
  it('따닥: 바닥 2장 + 손 + 뒤집은 패', () => {
    const s = make({ hand0: ['01-gwang', '06-pi1'], floor: ['01-pi1', '01-tti'], deck: ['01-pi2'], cap1: ['03-pi1'] });
    const r = apply(s, { type: 'play', card: '01-gwang' });
    expect(r.events.some((e) => e.type === 'special' && e.kind === 'ttadak')).toBe(true);
    expect(r.state.players[0].captured).toHaveLength(5);
  });
  it('폭탄: 손 3장 + 바닥 1장, 빈패 2장 받음', () => {
    const s = make({ hand0: ['01-gwang', '01-pi1', '01-pi2', '06-pi1'], floor: ['01-tti', '05-pi2'], deck: ['07-pi1'] });
    const r = apply(s, { type: 'play', card: '01-pi1' });
    expect(r.events.some((e) => e.type === 'special' && e.kind === 'bomb')).toBe(true);
    expect(r.state.players[0].hand.filter((h) => h.startsWith('dummy'))).toHaveLength(2);
    expect(r.state.players[0].shakes).toBe(1);
  });
  it('싹쓸이', () => {
    const s = make({ hand0: ['01-gwang', '06-pi1'], floor: ['01-pi1', '07-pi1'], deck: ['07-pi2', '08-pi1'], cap1: ['03-pi1'] });
    const r = apply(s, { type: 'play', card: '01-gwang' });
    expect(r.events.some((e) => e.type === 'special' && e.kind === 'sweep')).toBe(true);
  });
  it('자뻑: 내가 싼 뻑을 먹으면 피 2장', () => {
    const s = make({ hand0: ['01-gwang', '06-pi1'], floor: ['01-pi1', '01-pi2', '01-tti'], deck: ['08-pi1'], cap1: ['03-pi1', '03-pi2'] });
    s.ppeokOwner[1] = 0;
    const r = apply(s, { type: 'play', card: '01-gwang' });
    expect(r.events.some((e) => e.type === 'special' && e.kind === 'jappeok')).toBe(true);
    expect(r.events.filter((e) => e.type === 'steal')).toHaveLength(2);
  });
});

describe('full game simulation', () => {
  const levels: Difficulty[] = ['easy', 'normal', 'hard'];
  it('수천 판을 끝까지 진행해도 카드가 사라지거나 복제되지 않는다', () => {
    const tally = { wins: [0, 0], nagari: 0 };
    for (let g = 0; g < 3000; g++) {
      const rng = seeded(g + 1);
      let { state } = newRound((g % 2) as PlayerId, 1, rng);
      let steps = 0;
      while (state.phase !== 'over') {
        const level = levels[g % 3];
        const action = chooseAction(state, level, rng);
        state = apply(state, action).state;
        const all = [...state.deck, ...state.floor, ...state.players.flatMap((p) => [...p.hand, ...p.captured])].filter(
          (id) => !id.startsWith('dummy'),
        );
        expect(all.length).toBe(ALL_CARDS.length);
        expect(new Set(all).size).toBe(ALL_CARDS.length);
        if (++steps > 200) throw new Error('game did not finish');
      }
      if (state.result!.winner === null) tally.nagari++;
      else tally.wins[state.result!.winner]++;
      if (state.result!.settlement) expect(state.result!.settlement.final).toBeGreaterThan(0);
    }
    expect(tally.wins[0] + tally.wins[1]).toBeGreaterThan(2000);
  });
});
