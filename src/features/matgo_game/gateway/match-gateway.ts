import type { MatchEvent, MatchOptions } from '../model/types';

/**
 * 화면은 의도만 보내고, 판정된 이벤트만 받는다.
 * 이벤트와 TableView는 항상 보는 사람 기준이다(0 = 나, 1 = 상대). 상대 손패와 더미 순서는 화면에 오지 않는다.
 * ZLink stream-connector를 쓰는 온라인 게이트웨이도 이 계약을 그대로 구현해 서버 메시지를 같은 이벤트로 바꾼다.
 * start 전에 subscribe하고, 화면을 벗어나면 dispose한다.
 */
export interface MatchGateway {
  subscribe(listener: (event: MatchEvent) => void): () => void;
  /** 새 대국을 시작하고 첫 판을 나눠 준다 */
  start(options: MatchOptions): void;
  /** 손패 한 장 내기. target은 바닥에 같은 월이 두 장일 때 고른 패, shake는 흔들기 */
  requestPlay(card: string, target?: string, shake?: boolean): void;
  /** 고(true) 또는 스톱(false) */
  requestGoStop(go: boolean): void;
  /** 판이 끝난 뒤 다음 판. 선과 나가리 배수는 게이트웨이(서버)가 정한다 */
  requestNextRound(): void;
  dispose(): void;
}
