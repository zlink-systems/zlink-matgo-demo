import { expect, it } from 'vitest';
import { newRound } from './engine';
import { initialMatchState, matchReducer } from './reducer';
import { toTableView } from './view';

const view = toTableView(newRound(0, 1, () => 0.5).state, 0);

it('판 상태는 이벤트를 그대로 투영한다', () => {
  let s = matchReducer(initialMatchState, { type: 'RoundStarted', options: { difficulty: 'hard' }, round: 3, events: [], view });
  expect(s).toMatchObject({ status: 'playing', round: 3, options: { difficulty: 'hard' }, view });

  s = matchReducer(s, { type: 'ActionRejected', reason: 'not-your-turn' });
  expect(s.lastRejected).toBe('not-your-turn');
  expect(s.view).toBe(view);

  const over = { ...view, phase: 'over' as const, result: { winner: 0 as const, reason: 'stop' as const } };
  s = matchReducer(s, { type: 'ActionResolved', actor: 0, events: [], view: over });
  expect(s).toMatchObject({ status: 'roundOver', result: { winner: 0 }, lastRejected: null });
});
