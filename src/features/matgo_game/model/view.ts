import type { GameEvent, GameState, PlayerId, RoundResult } from './engine';
import type { TableView } from './types';

/** 가린 카드 id 접두사. 상대 손패와 더미를 이 id로 바꿔 보낸다. */
export const HIDDEN_PREFIX = 'hidden-';
export const isHidden = (id: string) => id.startsWith(HIDDEN_PREFIX);

/**
 * 서버 상태를 한 사람이 볼 수 있는 상태로 바꾼다.
 * 보는 사람(viewer)이 0번이 되도록 자리를 돌리고, 상대 손패와 더미를 가린다. 폭탄 뒤 받은 빈 패(dummy)는 공개다.
 */
export function toTableView(state: GameState, viewer: PlayerId): TableView {
  const seat = seatMapper(viewer);
  const me = state.players[viewer];
  const opp = state.players[other(viewer)];
  const ppeokOwner: Record<number, PlayerId> = {};
  for (const [month, owner] of Object.entries(state.ppeokOwner)) ppeokOwner[Number(month)] = seat(owner);
  return {
    deck: state.deck.map((_, i) => `${HIDDEN_PREFIX}d${i}`),
    floor: [...state.floor],
    players: [
      { ...me, hand: [...me.hand], captured: [...me.captured] },
      { ...opp, hand: opp.hand.map((id, i) => (id.startsWith('dummy') ? id : `${HIDDEN_PREFIX}h${i}`)), captured: [...opp.captured] },
    ],
    turn: seat(state.turn),
    phase: state.phase,
    ppeokOwner,
    carry: state.carry,
    dummyCounter: state.dummyCounter,
    result: state.result ? mapResult(state.result, seat) : undefined,
  };
}

/** 연출 이벤트를 보는 사람 기준으로 바꾸고, 상대가 더미에서 가져간 패를 가린다. */
export function toViewerEvents(events: readonly GameEvent[], viewer: PlayerId): GameEvent[] {
  const seat = seatMapper(viewer);
  let hiddenDraws = 0;
  return events.map((e): GameEvent => {
    switch (e.type) {
      case 'deal': {
        const mine = e.hands[viewer];
        const theirs = e.hands[other(viewer)].map((_, i) => `${HIDDEN_PREFIX}h${i}`);
        return { ...e, hands: [[...mine], theirs], floor: [...e.floor] };
      }
      case 'floorBonus':
        return { ...e, to: seat(e.to) };
      case 'bonusPlay': {
        const player = seat(e.player);
        const drawn = e.drawn && player !== 0 ? `${HIDDEN_PREFIX}x${hiddenDraws++}` : e.drawn;
        return { ...e, player, drawn };
      }
      case 'steal':
        return { ...e, from: seat(e.from), to: seat(e.to) };
      case 'roundOver':
        return { ...e, result: mapResult(e.result, seat) };
      case 'play':
      case 'bomb':
      case 'dummy':
      case 'flip':
      case 'bonusFlip':
      case 'capture':
      case 'special':
      case 'score':
      case 'goStopPrompt':
      case 'go':
      case 'stop':
      case 'turn':
        return { ...e, player: seat(e.player) } as GameEvent;
    }
  });
}

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function seatMapper(viewer: PlayerId) {
  return (p: PlayerId): PlayerId => (p === viewer ? 0 : 1);
}

function mapResult(r: RoundResult, seat: (p: PlayerId) => PlayerId): RoundResult {
  return { ...r, winner: r.winner === null ? null : seat(r.winner) };
}
