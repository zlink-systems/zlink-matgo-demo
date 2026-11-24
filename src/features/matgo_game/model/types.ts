import type { GameEvent, GameState, PlayerId, RoundResult } from './engine';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface MatchOptions {
  difficulty: Difficulty;
}

/**
 * 한 사람이 볼 수 있는 판 상태. 엔진의 GameState와 모양이 같지만 두 가지가 다르다.
 * - 보는 사람 기준이다: 0 = 나, 1 = 상대.
 * - 상대 손패와 더미는 가린 카드(`hidden-` 로 시작하는 id)로 바뀐다. 가린 id의 이름에는 뜻이 없고 장 수만 뜻이 있다.
 * 서버(또는 로컬 게이트웨이)만 원본 GameState를 가진다.
 */
export type TableView = GameState;

/** 화면이 받는 이벤트. 화면은 이 이벤트로만 판을 바꾼다. */
export type MatchEvent =
  /** 새 판. events는 나눠주기·바닥 보너스·총통 연출, view는 그 뒤 상태 */
  | { type: 'RoundStarted'; options: MatchOptions; round: number; events: GameEvent[]; view: TableView }
  /** 한 사람의 행동(패 내기, 고, 스톱)이 판정된 결과. actor는 보는 사람 기준 */
  | { type: 'ActionResolved'; actor: PlayerId; events: GameEvent[]; view: TableView }
  /** 요청이 거절됨. 판은 그대로다 */
  | { type: 'ActionRejected'; reason: RejectReason };

export type RejectReason = 'not-your-turn' | 'illegal-action' | 'round-over' | 'round-in-progress';

export interface MatchState {
  status: 'idle' | 'playing' | 'roundOver';
  options: MatchOptions;
  round: number;
  view: TableView | null;
  result: RoundResult | null;
  lastRejected: RejectReason | null;
}
