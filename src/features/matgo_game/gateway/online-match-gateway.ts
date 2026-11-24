import type { MatchEvent, MatchOptions } from '../model/types';
import type { MatchGateway } from './match-gateway';

/**
 * TODO: ZLink 서버 템플릿(zlink.systems/start, 보드 장르, board-tables)에 stream-connector(@zlink-systems/stream-connector)로 연결한다.
 * 인증 → 매칭(빠른 대전·방 코드) → 판 이벤트 구독 순서로 붙고, 서버 메시지를 RoundStarted·ActionResolved·ActionRejected로 바꾼다.
 * 서버가 원본 판(더미 순서, 두 사람의 손패)을 소유하고, 사람마다 model/view.ts의 toTableView·toViewerEvents와 같은 방식으로 가린 상태만 보낸다.
 * 서버 자리 번호를 보는 사람 기준(0 = 나)으로 바꾼다. 판 번호와 순서 번호로 중복·지난 이벤트를 버리고, 재접속하면 지금 판 상태를 한 번에 받는다.
 * 요청(패 내기·고/스톱·다음 판)은 서버로만 보내고 결과를 미리 반영하지 않는다. dispose에서 구독과 연결을 닫는다. 화면(view/)은 고치지 않는다.
 */
export class OnlineMatchGateway implements MatchGateway {
  subscribe(_listener: (event: MatchEvent) => void): () => void {
    throw new Error('not implemented');
  }
  start(_options: MatchOptions): void {
    throw new Error('not implemented');
  }
  requestPlay(_card: string, _target?: string, _shake?: boolean): void {
    throw new Error('not implemented');
  }
  requestGoStop(_go: boolean): void {
    throw new Error('not implemented');
  }
  requestNextRound(): void {
    throw new Error('not implemented');
  }
  dispose(): void {
    throw new Error('not implemented');
  }
}
