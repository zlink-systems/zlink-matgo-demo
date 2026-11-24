import type { MatchEvent, MatchState } from './types';

export const initialMatchState: MatchState = {
  status: 'idle',
  options: { difficulty: 'normal' },
  round: 0,
  view: null,
  result: null,
  lastRejected: null,
};

/** 판 상태는 게이트웨이 이벤트의 투영이다. 차례나 승패를 스스로 정하지 않는다. */
export function matchReducer(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    case 'RoundStarted':
      return {
        ...state,
        status: event.view.phase === 'over' ? 'roundOver' : 'playing',
        options: event.options,
        round: event.round,
        view: event.view,
        result: event.view.result ?? null,
        lastRejected: null,
      };
    case 'ActionResolved':
      return {
        ...state,
        status: event.view.phase === 'over' ? 'roundOver' : 'playing',
        view: event.view,
        result: event.view.result ?? null,
        lastRejected: null,
      };
    case 'ActionRejected':
      return { ...state, lastRejected: event.reason };
  }
}
