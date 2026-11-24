# 멀티플레이 작업 규칙

- 커밋은 감독자가 수행한다. 요청 없이 커밋하지 않는다.
- `view/`는 그대로 유지한다. 화면은 의도만 보내고 게이트웨이 이벤트를 reducer로 투영해 연출한다. 온라인 표시(남은 시간, 연결 상태, 매칭)용 DOM 조각은 더할 수 있다.
- `gateway/match-gateway.ts`의 계약을 지켜 `OnlineMatchGateway`를 구현한다. [zlink.systems/start](https://zlink.systems/start)의 보드 장르 서버 템플릿(`board-tables`)과 브라우저용 stream-connector(`@zlink-systems/stream-connector`)를 연결한다. 절차와 상세 요구는 README의 「멀티 플레이 붙이기」를 따른다.
- 서버 코드를 고치기 전에 사용자에게 묻는다: 서버 템플릿을 이미 받아 두었는지(받았다면 압축을 푼 위치), 서버 언어를 무엇으로 할지. 답한 언어가 템플릿 언어(`zlink.structure.json`의 `language`)와 다르면 그 언어로 다시 받아 달라고 안내하고 기다린다. 템플릿을 직접 다른 언어로 옮기지 않는다.
- 서버 판정은 `model/`의 규칙을 기준으로 한다. 서버가 TypeScript면 순수 규칙(cards·scoring·engine·view)을 그대로 재사용하고(Pixi·DOM 의존성 추가 금지), 다른 언어면 같은 동작으로 옮겨 같은 경우를 시험한다.
- 맞고는 숨은 정보가 있는 게임이다. 서버만 더미 순서와 두 사람의 손패를 가지고, 사람마다 `model/view.ts`와 같은 규칙으로 가린 상태와 이벤트만 보낸다. 상대 손패·더미가 응답에 없는지 시험한다.
- 클라이언트에서 패 내기·턴·점수·승패를 선반영하지 않는다. 서버가 검증한 이벤트만 적용한다.
- 인증 → 매칭 → 이벤트 연결을 구현하고 재접속·이벤트 순서·중복·연결 해제를 처리한다.
- 가상 머니와 전적은 서버가 계정별로 소유한다. 실제 돈을 연상시키는 표현은 쓰지 않는다.
- npm run build / npm test / npm run typecheck / npm run lint를 통과시킨다.
