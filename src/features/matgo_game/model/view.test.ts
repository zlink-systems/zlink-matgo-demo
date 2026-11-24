import { describe, expect, it } from 'vitest';
import { chooseAction } from '../ai/computer';
import { apply, isDummy, newRound, type GameState, type PlayerId } from './engine';
import { isHidden, toTableView, toViewerEvents } from './view';

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

/** 보는 사람에게 숨겨야 하는 카드: 상대 손패(빈 패 제외)와 더미 */
function secretsFor(state: GameState, viewer: PlayerId): Set<string> {
  const opp = state.players[viewer === 0 ? 1 : 0].hand.filter((id) => !isDummy(id));
  return new Set([...opp, ...state.deck]);
}

describe('toTableView', () => {
  it('상대 손패와 더미를 가리고 장 수는 유지한다', () => {
    const { state } = newRound(0, 1, seeded(1));
    const view = toTableView(state, 0);
    expect(view.players[0].hand).toEqual(state.players[0].hand);
    expect(view.players[1].hand).toHaveLength(state.players[1].hand.length);
    expect(view.players[1].hand.every(isHidden)).toBe(true);
    expect(view.deck).toHaveLength(state.deck.length);
    expect(view.deck.every(isHidden)).toBe(true);
    expect(view.floor).toEqual(state.floor);
  });

  it('보는 사람이 1번이면 자리를 돌려 0번에 둔다', () => {
    const { state } = newRound(0, 1, seeded(2));
    const view = toTableView(state, 1);
    expect(view.players[0].hand).toEqual(state.players[1].hand);
    expect(view.players[1].hand.every(isHidden)).toBe(true);
    expect(view.turn).toBe(1); // 선은 0번 자리, 1번이 보면 상대 차례
  });
});

describe('toViewerEvents', () => {
  it('나눠주기에서 상대 손패를 가린다', () => {
    const { events } = newRound(1, 1, seeded(3));
    const deal = toViewerEvents(events, 0).find((e) => e.type === 'deal');
    if (deal?.type !== 'deal') throw new Error('no deal');
    expect(deal.hands[1].every(isHidden)).toBe(true);
    expect(deal.hands[0].some(isHidden)).toBe(false);
  });

  it('상대가 더미에서 가져간 패만 가린다', () => {
    const e = [{ type: 'bonusPlay' as const, player: 1 as PlayerId, card: 'bonus-2', drawn: '05-pi1' }];
    expect(toViewerEvents(e, 0)[0]).toMatchObject({ player: 1, drawn: expect.stringMatching(/^hidden-/) });
    expect(toViewerEvents(e, 1)[0]).toMatchObject({ player: 0, drawn: '05-pi1' });
  });

  it('AI끼리 300판을 두는 동안 상대 손패와 더미가 한 번도 새지 않는다', () => {
    const rng = seeded(42);
    for (let game = 0; game < 300; game++) {
      let { state, events } = newRound((game % 2) as PlayerId, 1, rng);
      for (let guard = 0; guard < 200; guard++) {
        for (const viewer of [0, 1] as PlayerId[]) {
          const secrets = secretsFor(state, viewer);
          const visible = JSON.stringify([toTableView(state, viewer), toViewerEvents(events, viewer)]);
          for (const id of secrets) expect(visible.includes(`"${id}"`), `${id} 노출 (viewer ${viewer})`).toBe(false);
        }
        if (state.phase === 'over') break;
        ({ state, events } = apply(state, chooseAction(state, 'normal', rng)));
      }
    }
  });
});
