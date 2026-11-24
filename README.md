# 한판 맞고 · ZLink Playground

컴퓨터와 치는 싱글 플레이 맞고(2인 고스톱) 웹 게임입니다. 이 싱글 게임을 [ZLink](https://zlink.systems)를 이용해 멀티 플레이 게임으로 개발하는 과정을 보여 주는 데모용 저장소입니다. 멀티 플레이를 붙이는 방법은 [멀티 플레이 붙이기](#멀티-플레이-붙이기)에 있습니다.

Vite, strict TypeScript, PixiJS v8(WebGL), GSAP로 만들었습니다. 효과음과 배경 음악은 Web Audio로 실시간 합성하므로 음원 파일이 없고, 외침은 브라우저 음성 합성(ko-KR)을 씁니다. 카드 그림은 Codex로 생성한 WebP입니다.

## 실행 방법

Node.js 22.12 이상을 권장합니다. 의존성은 정확한 버전과 package-lock.json으로 고정합니다.

```sh
npm ci
npm run dev
```

터미널에 표시된 로컬 주소를 엽니다. 휴대폰은 같은 네트워크에서 표시된 Network 주소로 가로 화면으로 접속합니다.

```sh
npm run build      # 타입 검사와 프로덕션 빌드
npm run preview    # dist 미리보기
npm test           # Vitest 단위 테스트, 감시 없이 실행
npm run typecheck  # strict 타입 검사
npm run lint       # ESLint flat config
npm run format     # Prettier
```

## 폴더 구조

```text
src/
  app/                         앱 구성 지점(app.ts: 화면 생성, 게이트웨이 연결), 전역 스타일
  features/
    home/                      타이틀 화면, 난이도 선택
    matgo_game/
      model/                   카드 정의, 규칙 엔진, 점수 계산, 보는 사람 기준 가림(view.ts), 이벤트 타입·reducer
      gateway/                 MatchGateway, 로컬 구현(컴퓨터), 온라인 스텁
      ai/                      규칙 기반 컴퓨터 (초급·중급·고급)
      view/                    판 연출(game-scene.ts), 카드, 효과, 배치·배경, HUD(DOM)
  shared/                      효과음·음악·음성, 설정, 전적·가상 머니
public/cards/                  게임에서 쓰는 카드 그림(WebP)과 manifest.json
assets/cards/prompts/          카드 그림 생성 프롬프트와 화풍 기준 이미지
docs/research/                 시장 조사 보고서
```

## 화면 흐름

타이틀에서 초급·중급·고급을 고르고 **게임 시작**을 누릅니다. 첫 판은 내가 선이고, 다음 판부터는 이긴 사람이 선입니다.

손패를 클릭하거나 숫자 키 1~0으로 냅니다. 먹을 수 있는 패는 빛나고, 마우스를 올리면 바닥에서 짝이 되는 패가 함께 빛납니다. 바닥에 같은 월이 종류가 다른 두 장이면 판이 어두워지고 두 장을 크게 보여 주며, 클릭이나 1·2로 고르고 빈 곳이나 Esc로 취소합니다. 손에 같은 월 세 장이 있으면 흔들기를 묻습니다.

7점 이상이 되면 고/스톱 창이 뜨고 지금 멈추면 받을 점수와 상대 점수(고박 위험)를 함께 보여 줍니다. 판이 끝나면 정산 화면에 점수 내역과 박·배수 도장, 가상 머니 변동이 나오고 **한 판 더**로 다음 판을 시작합니다. 설정에서 상대 실력, 게임 속도, 효과음·음악·음성, 월 숫자 표시, 화면 흔들림 줄이기를 바꿉니다.

규칙(기본값): 7점 나기, 손 10장·바닥 8장, 고(1고 +1, 2고 +2, 3고부터 ×2씩), 흔들기·폭탄 ×2, 피박(패자 피 7장 이하)·광박·멍박·고박 ×2, 나가리 다음 판 ×2, 쪽·따닥·싹쓸이·뻑 먹기·폭탄 피 1장(자뻑 2장), 첫뻑 피 1장, 삼뻑·총통 즉시 승리, 보너스피, 국진 자동 판정.

## 이벤트와 권한

화면 → `requestPlay(card, target?, shake?)` / `requestGoStop(go)` / `requestNextRound()` → 게이트웨이 → 이벤트 → `matchReducer` → 화면 순서입니다. 화면은 규칙 엔진이나 AI를 직접 부르지 않고, 결과를 미리 반영하지 않습니다. 패를 내도 `ActionResolved`가 오기 전에는 판이 바뀌지 않으며, 거절되면 `ActionRejected`가 옵니다.

| 이벤트           | 내용                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `RoundStarted`   | 판 번호, 나눠주기·바닥 보너스·총통 연출 이벤트, 그 뒤의 판 상태                                                                  |
| `ActionResolved` | 누가(0 = 나, 1 = 상대) 무엇을 했는지의 연출 이벤트(낸 패, 뒤집은 패, 먹은 패, 쪽·뻑·따닥, 점수, 고·스톱, 판 끝), 그 뒤의 판 상태 |
| `ActionRejected` | 거절 이유(`not-your-turn`, `illegal-action`, `round-over`, `round-in-progress`)                                                  |

맞고는 상대 손패와 더미 순서를 모르는 게임이라, 화면이 받는 판 상태(`TableView`)는 **보는 사람 기준으로 가린 상태**입니다. 내가 0번 자리이고, 상대 손패와 더미는 `hidden-`으로 시작하는 가린 카드로 장 수만 옵니다. 상대가 패를 내거나 더미에서 패가 뒤집힐 때 이벤트에 그 패가 처음 나타나고, 화면은 그 순간 뒷면 카드를 그 패로 바꿔 뒤집습니다. 가리는 규칙은 `model/view.ts`의 `toTableView`·`toViewerEvents`에 있고, 시험은 AI끼리 300판을 두며 두 사람 모두에게 상대 손패와 더미가 한 번도 새지 않는지 확인합니다.

로컬 게이트웨이(`LocalMatchGateway`)가 원본 판 상태, 규칙 판정, 컴퓨터의 수, 선과 나가리 배수를 소유합니다. 컴퓨터는 300ms 뒤 두고, 화면은 상대 행동을 연출하기 전에 생각하는 틈을 둡니다. `start` 이전에 구독하고, 화면을 벗어나면 `dispose`로 타이머와 리스너를 정리합니다. 앱 구성 지점은 `src/app/app.ts`입니다. 전적과 가상 머니(점당 100냥, 실제 돈이 아님)는 지금은 브라우저에 저장합니다.

## 멀티 플레이 붙이기

[zlink.systems/start](https://zlink.systems/start)에서 보드 장르의 ZLink 서버 템플릿 zip 하나를 받습니다. 압축을 푼 템플릿과 이 저장소를 AI 코딩 에이전트에게 주면, 컴퓨터와 하는 싱글 플레이를 유지하면서 두 사람이 브라우저에서 **맞고 온라인 대전**을 할 수 있는 서버와 클라이언트를 만듭니다. 작업 규모는 오목 데모와 비슷합니다.

### 1. 준비물

| 항목 | 받는 곳 | 비고 |
| --- | --- | --- |
| 서버 템플릿 | [ZLink 시작 페이지](https://zlink.systems/start) | 장르 **보드**, 원하는 서버 언어(Node.js, Java 등), 클라이언트 **웹 브라우저**를 고릅니다. `board-tables` zip 하나를 받아 `my-game/`에 풉니다. |
| 브라우저 커넥터 | 시작 페이지의 설치 링크와 [브라우저 가이드](https://docs.zlink.systems/node/guide/stream-connector/08-browser/) | TypeScript stream-connector인 `@zlink-systems/stream-connector`를 설치합니다. 템플릿에 고정된 Framework 버전과 맞춥니다. |
| 실행 도구 | 선택한 언어의 템플릿 README, 이 문서의 [실행 방법](#실행-방법) | 서버는 템플릿이 요구하는 JDK·Docker 등을 준비합니다. 클라이언트에는 Node.js 22.12 이상이 필요합니다. |
| 이 저장소 | 현재 데모 저장소 | 싱글 플레이 클라이언트와 게임 규칙, 게이트웨이 계약이 들어 있습니다. |

`work/` 아래에 `zlink-matgo-demo/`와 `my-game/`을 나란히 두면 프롬프트의 경로를 그대로 쓸 수 있습니다. 다른 곳에 압축을 풀었다면 에이전트에게 그 위치를 알려 줍니다. 템플릿의 `README.md`와 `AGENTS.md`에 실행 방법과 확장 지점이 있고, `zlink.structure.json`의 `language`에 서버 언어가 적혀 있습니다. 작업 전에 받은 템플릿 README의 알려진 문제 절을 확인합니다.

### 2. ZLink가 맡는 것과 게임이 맡는 것

| ZLink와 템플릿이 맡는 것 | 게임이 맡는 것 |
| --- | --- |
| 브라우저 연결, Session 관리, 재접속 시 같은 Actor로 다시 연결하는 흐름 | 재접속한 사람에게 현재 판을 복원하고 자리 만료와 승패를 판정합니다. |
| Session node와 Table node 구성, Redis Location Store를 통한 Actor 위치 조회와 라우팅 | Table Spot이 판 상태를 소유하고 판정과 정산을 서버에서 합니다. |
| 노드를 늘리는 scale-out과 노드를 비우는 drain에 필요한 배치·재배치 흐름 | 이동할 때 복원해야 할 판 상태와 남은 시간을 스냅숏에 담습니다. |
| 이름 있는 테이블 입장과 템플릿이 제공하는 경우 Matchmaker 대기열 | 빠른 대전·방 코드 정책과 게임별 요청·이벤트를 정의합니다. 클라이언트는 받은 이벤트를 그립니다. |

### 3. AI에게 줄 프롬프트

`work/`에서 AI 코딩 에이전트를 열고 아래 프롬프트를 그대로 줍니다.

```text
목표
- zlink-matgo-demo/의 싱글 플레이 맞고(Vite + strict TypeScript + PixiJS)에 두 사람의 온라인 대전을 추가한다.
- ZLink 보드 장르 서버 템플릿(board-tables)으로 게임 서버를 만든다.

범위 밖
- 컴퓨터와 하는 싱글 플레이의 동작과 기존 판 화면은 유지한다. 온라인 표시 추가 범위는 C3과 화면 요구사항(C5부터)을 따른다.
- 템플릿을 다른 서버 언어로 이식하는 작업은 범위 밖이다.

입력
- 클라이언트는 zlink-matgo-demo/이다. README.md, AGENTS.md, src/features/matgo_game/gateway/match-gateway.ts, src/features/matgo_game/model/types.ts, src/features/matgo_game/model/view.ts를 먼저 읽는다.
- 서버 입력 my-game/은 질문 1에서 확인한 board-tables 템플릿 원본이다. 서버 산출물은 별도의 복사본에 둔다.
- 원본의 README.md, AGENTS.md, zlink.structure.json에서 노드 구성, 요청 흐름, 확장 지점, 실행·검증 명령을 먼저 확인한다.
- ZLink 공식 문서 https://docs.zlink.systems/llms.txt, 고른 언어의 서버 가이드, TypeScript stream-connector 브라우저 가이드 https://docs.zlink.systems/node/guide/stream-connector/08-browser/를 확인한다.
- Framework 버전은 템플릿의 빌드 설정에 고정된 값을 기준으로 삼는다. 서버와 브라우저 커넥터에 같은 버전을 정확히 고정한다.

먼저 확인할 질문
서버 코드를 고치기 전에 사용자에게 묻는다.
1. "zlink.systems/start에서 서버 템플릿을 이미 받아 두셨나요?"라고 묻는다.
   - 받았다면 압축을 푼 폴더를 확인하고 그곳을 my-game/으로 사용한다. work/ 밖이어도 된다.
   - zlink.structure.json의 id가 board-tables인지 확인한다. 확인한 id와 language를 사용자에게 알린다.
   - 받지 않았다면 장르 "보드", 원하는 서버 언어, 클라이언트 "웹 브라우저"를 골라 받은 뒤 압축을 푼 위치를 알려 달라고 안내하고 기다린다.
2. "서버 언어를 무엇으로 할까요?"라고 묻는다.
   - 시작 페이지에서 고를 수 있는 언어 중에 선택하도록 안내한다. 받은 템플릿이 있으면 그 언어를 함께 알린다.
   - 답한 언어와 템플릿의 language가 다르면 해당 언어로 다시 받아 위치를 알려 달라고 안내하고 기다린다. 템플릿을 직접 이식하지 않는다.
3. 정해야 할 것이 더 생기면 사용자에게 묻는다. 템플릿에 없는 구조를 추가할지, S6의 시간 초과 정책을 바꿀지와 같은 결정을 추측으로 내리지 않는다.

반드시 지킬 규칙 (MUST)
- M1. 템플릿 원본은 보존한다. 서버 코드는 복사본에서만 고친다. 이후 서버 요구사항과 실행 명령은 그 복사본에 적용한다.
- M2. 게임 상태의 소유 위치, Framework 콜백과 I/O의 위치, 공유 메시지 위치, Session의 클라이언트 요청 허용 목록은 템플릿 규칙을 따른다.
  새 클라이언트 요청은 허용 목록에 등록한다. 목록에 없는 패킷은 packet-not-allowed로 거절한다.
- M3. 템플릿에 고정된 버전의 API만 사용한다.
- M4. 서버 메시지 레코드를 처음 만들기 전에 https://docs.zlink.systems 의 메시지 모델 스펙(05-message-model)을 읽는다.
  null을 허용하는 필드는 nullable로 표시한다(Java·Kotlin @Nullable). @ZLinkJsonOptional은 필드 생략만 허용하며 null은 거절한다.
- M5. 64비트 정수(Java long 등)의 JSON 형식은 10진 문자열이다. 브라우저가 보낼 때도 문자열을 사용한다(예: handNumber: "1").
- M6. 나가기처럼 전송 직후 연결을 닫을 때는 request로 보내고 응답을 받은 뒤 연결을 닫는다. send 직후 닫으면 서버가 처리하지 못할 수 있다.
- M7. 재접속 시 이전 tableId로 테이블을 새로 만들지 않는다. 서버 재시작·교체 뒤 테이블이 사라졌으면 자리 없음으로 거절하고 매칭으로 돌려보낸다.

서버 요구사항 (템플릿 복사본)
- S1. 서버가 맞고 규칙과 패 내기 판정을 소유한다.
  zlink-matgo-demo/src/features/matgo_game/model/의 cards.ts·scoring.ts·engine.ts를 기준으로 템플릿의 기본 게임을 맞고로 바꾼다.
  7점 나기, 고/스톱, 흔들기·폭탄, 쪽·뻑·따닥·싹쓸이, 피박·광박·멍박·고박, 나가리 배수, 총통·삼뻑, 보너스피, 국진 자동 판정을 구현한다.
  TypeScript 서버는 순수 규칙을 그대로 재사용한다. Pixi·DOM 의존성 추가를 금지한다.
  다른 언어에서는 같은 동작을 상태와 분리한 순수 규칙으로 옮긴다. engine.test.ts의 점수·특수 상황·AI끼리 수천 판 불변식과 같은 경우를 검증한다.
  TableState는 더미 순서, 두 사람의 손패, 바닥, 먹은 패, 고·흔들기·뻑 횟수, 차례, 선, 나가리 배수를 소유한다.
  서버가 참가자, 차례, 손에 있는 패, 고른 바닥 패가 같은 월인지, 판 상태(고/스톱 대기 여부)를 검증한다.
  결과는 서버가 판정한다. 더미는 서버의 암호학적 난수로 섞는다. 쓰지 않는 템플릿 게임 메시지와 상수는 지운다.
- S2. 사람마다 가린 판 상태와 이벤트만 보낸다.
  내 손패는 그대로 보낸다. 상대 손패와 더미는 가린 카드의 장 수만 보낸다.
  상대가 낸 패와 더미에서 뒤집힌 패는 해당 이벤트에서 처음 공개한다. 상대가 보너스피로 더미에서 가져간 패는 가져간 사람에게만 알린다.
  model/view.ts의 toTableView·toViewerEvents와 같은 규칙을 쓴다.
  서버에서도 view.test.ts처럼 수천 판 동안 상대 손패와 더미가 한 번도 새지 않는지 시험한다.
- S3. Table Spot 하나에 두 자리를 두고 두 사람이 앉으면 첫 판을 시작한다.
  첫 판 선은 무작위다. 다음 판부터 이긴 사람이 선이다. 나가리면 선을 유지하고 다음 판 점수는 2배다.
  템플릿이 drain·relocation을 제공하면 더미 순서와 남은 시간을 포함한 판 상태 전체를 스냅숏에 담아 옮긴다.
- S4. 빠른 대전과 방 코드 입장을 지원한다.
  이름 있는 테이블 입장은 템플릿의 JoinTableRequest를 쓴다. Matchmaker가 있으면 FindMatch·CancelMatch를 사용한다. 없으면 ZLink Spot 하나가 대기열을 소유한다.
  빠른 대전은 대기 중인 두 사람에게 새 tableId, 내 자리, 상대 닉네임을 알린다.
  방 만들기는 6자리 코드를 발급한다. 다른 사람이 코드로 들어오면 같은 tableId에 앉힌다.
  대기열의 단일 소유자가 방 코드의 발급·조회·만료도 소유한다. 대기 취소, 연결이 끊긴 사람의 대기열·방 코드 제거, 대기 만료를 처리한다.
- S5. 공유 메시지를 타입으로 정의하고 판 이벤트 순서를 표시한다.
  고른 언어의 템플릿 공유 메시지 위치에서 아래 메시지 계약을 구현한다.
- S6. 한 차례에 20초를 주고 시간 초과 시 서버가 대신 둔다.
  고/스톱 선택에도 20초를 적용한다. 먹을 수 있는 패 중 가장 값진 패를 낸다. 고/스톱 대기 중이면 스톱을 선택한다.
  한 판에 같은 사람을 대신 둔 횟수가 3번이면 그 사람이 진다(timeout).
  Table 한 곳에서 단조 시계로 판정한다. 시험용 시계는 Table 생성 시에만 넘긴다. 남은 시간을 재배치용 상태를 포함한 스냅숏에 담는다.
- S7. 가상 머니와 전적은 서버가 계정별로 소유한다.
  점당 100냥으로 정산하고 보유 머니와 전적을 관리한다. 실제 돈·현금 표현은 쓰지 않는다.
- S8. 같은 Actor로 다시 바인딩하고 템플릿의 Rejoin으로 같은 판을 복원한다.
  연결이 끊긴 사람의 차례에도 S6에 따라 대신 둔다. 60초 안에 돌아오지 않으면 그 사람이 진다(leave).
  돌아오면 보는 사람 기준의 현재 판 상태·차례·남은 시간을 한 번에 보낸다. 테이블이 사라졌으면 M7을 적용한다.
- S9. 판이 끝난 뒤 두 사람이 모두 "한 판 더"를 누르면 같은 테이블에서 다음 판을 시작한다.
  판 번호를 늘린다. 한 사람이 나가면 남은 사람에게 알린다.
- S10. 기존 템플릿 e2e를 맞고에 맞추고 시나리오와 규칙·가림 검사를 추가한다.
  zlink.structure.json의 scenarios 목록을 구현과 함께 갱신한다. A1의 시나리오와 규칙·가림 시험을 포함한다.

클라이언트 요구사항 (zlink-matgo-demo/)
- C1. 서버와 같은 버전의 브라우저 커넥터를 설치한다.
  npm install --save-exact @zlink-systems/stream-connector@<서버 템플릿의 Framework 버전>
- C2. OnlineMatchGateway를 기존 MatchGateway 계약에 맞춰 구현한다.
  구현 파일은 src/features/matgo_game/gateway/online-match-gateway.ts이다.
  stream-connector를 Session node의 실제 ws:// 주소에 연결한다. 서버 시작 로그의 "Server ready:" 등에서 주소를 찾는다.
  첫 패킷을 보내기 전에 푸시 핸들러를 등록한다. 템플릿의 인증·Actor 연결 흐름에 따라 매칭하고 판 이벤트를 받는다.
  화면은 requestPlay·requestGoStop·requestNextRound 의도만 보낸다. RoundStarted·ActionResolved·ActionRejected 이벤트를 구독자에게 전달하고 서버에서 받은 이벤트로만 상태를 바꾼다.
  서버 자리 번호는 보는 사람 기준(0 = 나)으로 바꾼다.
  패 내기·고/스톱·다음 판 요청은 전송만 한다. 서버 결과를 받은 뒤에만 판을 바꾼다.
  판 번호와 순서 번호로 중복·지난 판·순서가 어긋난 이벤트를 버린다. dispose에서 구독과 연결을 정리한다.
  64비트 필드를 읽을 때는 템플릿 e2e 클라이언트를 참고해 숫자와 10진 문자열을 모두 받아 변환한다. 보낼 때는 M5를 따른다.
- C3. 온라인 전용 기능은 별도 인터페이스에 둔다.
  온라인 전용 인터페이스에는 매칭, 다음 판 합의, 남은 시간, 상대 연결 상태 기능을 둔다. MatchGateway 계약은 유지한다.
  view/의 판 연출·카드·효과·HUD는 그대로 쓴다. 온라인 표시용 DOM 조각은 추가할 수 있다.
- C4. VITE_ZLINK_STREAM_URL로 Session 주소를 설정한다.
  값이 없으면 온라인 대전 버튼을 비활성화하고 "서버 주소가 없습니다"를 보인다.
  Session의 기본 stream 주소가 루프백이면 다른 기기에서 닿는 주소로 설정을 바꾼다. HTTPS 페이지에서는 wss://로 배포한다.
- C5. 타이틀에 "온라인 대전" 버튼을 추가하고 대전 선택 창을 연다.
  녹색 담요, 원목 테두리, 큰 글씨, 한국어 문구를 유지한다. 금색은 버튼과 승리에만 사용한다.
  2~10자 닉네임을 입력받아 브라우저에 기억한다. "빠른 대전", "방 만들기", "코드로 입장"(6자리 입력칸)을 제공한다.
- C6. 매칭 진행 상태와 취소를 표시한다.
  펼친 광 다섯 장 위에 "상대를 찾는 중", 흐른 시간(초), "취소"를 표시한다.
  방을 만들었으면 큰 방 코드, "복사", "친구가 이 코드로 들어오면 시작합니다"를 표시한다.
- C7. 기존 판 화면에 온라인 상태를 표시한다.
  왼쪽 점수판에 "나"와 상대 닉네임, 차례 강조, 남은 시간 막대(20초)를 표시한다. 마지막 5초에는 막대를 빨갛게 하고 째깍 소리를 낸다.
  상단 연결 상태 점은 연결이면 초록, 다시 연결 중이면 노랑이다. 기존 "상대 차례" 문구를 쓴다.
- C8. 상대 연결이 끊기면 판 위에 반투명 띠와 카운트다운을 표시한다.
  문구는 "상대의 연결이 끊겼어요 — 60초 안에 돌아오지 않으면 승리합니다"를 쓴다.
  내 연결이 끊기면 "다시 연결하는 중…"을 보인다. 실패하면 "타이틀로"를 제공한다.
- C9. 기존 정산 창에 종료 이유와 다음 판 상태를 표시한다.
  스톱·총통·삼뻑·나가리·시간 초과·상대 나감을 구분한다. "한 판 더"와 "타이틀로"를 제공한다.
  내가 먼저 누르면 "상대의 답을 기다리는 중"을 보인다. 상대가 먼저 누르면 "상대가 한 판 더 원해요"를 보인다.
  상대가 나가면 한 판 더 버튼을 끄고 "상대가 나갔어요"를 보인다.
- C10. 휴대폰 가로 844×390에서 요소가 겹치거나 잘리지 않아야 한다.
  세로에서는 기존의 가로로 돌리라는 안내를 보인다.

메시지 계약
- 표의 이름은 논리 계약이다. 템플릿에 같은 패킷이 있으면 실제 이름·필드와의 대응을 명시하고 기존 계약을 유지한다. 표의 범위는 브라우저와 Session 사이다.
- send(푸시)는 서버가 구독된 핸들러로 보내는 이벤트다. request 응답은 해당 호출의 응답으로 돌려준다.
- 모든 판 이벤트에 handNumber(판 번호)와 sequence(순서 번호)를 넣는다. 표의 판 이벤트 필드에는 이 공통 필드가 포함된다.
- ActionRejected의 reason·retryAfterMs는 템플릿 JSON 계약을 유지한다. 새 요청을 Session 허용 목록에 등록한다(M2).

이름 | 방향 | 필드 | send/request
--- | --- | --- | ---
FindMatch | 클라이언트 → 서버 | playerId, nickname | send
MatchQueued | 서버 → 클라이언트 | ticketId | send(푸시)
CancelMatch | 클라이언트 → 서버 | ticketId | send
MatchCancelled | 서버 → 클라이언트 | ticketId, reason | send(푸시)
JoinTableRequest | 클라이언트 → 서버 | playerId, tableId(템플릿의 이름 있는 테이블 입장) | send
CreateRoomRequest / CreateRoomResponse | 클라이언트 → 서버 / 서버 → 클라이언트 | nickname / code(6자리) | request / request 응답
JoinRoomRequest / JoinRoomResponse | 클라이언트 → 서버 / 서버 → 클라이언트 | code, nickname / 수락 여부 또는 거절 사유 | request / request 응답
MatchFound(매칭됨) | 서버 → 클라이언트 | tableId, 내 자리, 상대 닉네임 | send(푸시)
RoundStarted | 서버 → 클라이언트 | 판 이벤트 공통 필드, 나눠주기 연출 이벤트, 보는 사람 기준 판 상태, 남은 시간 | send(푸시)
PlayRequest | 클라이언트 → 서버 | handNumber, card, target(선택), shake(선택) | send
GoStopRequest | 클라이언트 → 서버 | handNumber, go(고=true, 스톱=false) | send
ActionResolved | 서버 → 클라이언트 | 판 이벤트 공통 필드, 행동한 자리, 보는 사람 기준 GameEvent 연출 목록과 그 뒤 판 상태, 남은 시간 | send(푸시)
RoundEnded | 서버 → 클라이언트 | 판 이벤트 공통 필드, 승자, reason(stop/chongtong/samppeok/nagari/timeout/leave), 정산 내역 | send(푸시)
NextRoundRequest / NextRoundResponse | 클라이언트 → 서버 / 서버 → 클라이언트 | handNumber / 판 이벤트 공통 필드, 요청·동의 상태 | send / send(푸시)
Rejoin / 재접속 스냅숏 | 클라이언트 → 서버 / 서버 → 재접속한 클라이언트 | 템플릿의 Actor·tableId 계약 / 판 이벤트 공통 필드, 보는 사람 기준 판 상태와 차례, 남은 시간 | 템플릿 Rejoin 방식
ConnectionChanged | 서버 → 클라이언트 | 판 이벤트 공통 필드, 상대 상태(연결·끊김·나감), 끊겼을 때 복귀 기한 | send(푸시)
LeaveRequest / LeaveResponse | 클라이언트 → 서버 / 서버 → 클라이언트 | tableId / 처리 결과 | request / request 응답
ActionRejected | 서버 → 클라이언트 | reason, retryAfterMs(int32 JSON 숫자, 템플릿 계약) | send(푸시)

완료 조건 (수용 기준)
- A1. 서버 복사본에서 템플릿 README의 빌드 명령과 ./run-e2e.sh 또는 run-e2e.ps1을 실행한다.
  구조 검사, 아래 시나리오, 규칙·가림 시험이 모두 통과해야 한다. 템플릿에 타입 검사·린트 명령이 있으면 함께 통과해야 한다.
  - 빠른 대전 두 명 매칭, 방 코드 입장, 한 판 끝까지 진행(고·스톱 포함)을 확인한다.
  - 차례가 아닌 패 내기, 손에 없는 패, 잘못 고른 바닥 패를 거절한다. 거절 전후 상태가 같아야 한다.
  - 응답에 상대 손패와 더미의 실제 카드가 없는지 확인한다.
  - 시간 초과 시 대신 두기와 패배를 확인한다.
  - 재접속 뒤 같은 판에서 이어 치기, 나가리 뒤 2배 판, 다음 판을 확인한다.
- A2. 클라이언트에서 npm run build, npm test, npm run typecheck, npm run lint가 통과해야 한다.
  가짜 연결로 OnlineMatchGateway의 이벤트 매핑, 자리 번호 변환, 중복 무시, 순서 처리를 검증하는 단위 시험을 더한다.
- A3. ./run-server.sh 또는 run-server.ps1으로 로컬 서버를 띄운다.
  브라우저 두 개(데스크톱·모바일 가로 크기)에서 빠른 대전 → 한 판(고·스톱) → 정산 → 한 판 더 → 한쪽 새로고침 뒤 재접속 순서로 수행한다.
  개발자 도구의 네트워크에서 상대 손패가 오지 않는지도 확인한다.
  화면 캡처를 남긴다.
- A4. 고른 서버 언어, 변경 사항, 실행 방법을 클라이언트와 서버 복사본의 README에 적는다.

알려진 함정
- 먼저 my-game/README.md의 알려진 문제 절(my-game/README.md#known-issues)을 읽는다.
  한국어 문서에서는 README.ko.md#알려진-문제, Node 템플릿에서는 README.md#relocation-timing 또는 README.ko.md#relocation-대기-시간을 확인한다.
- drain(update) 확인에 약 30초가 걸린다. 진행 중인 판의 턴 시계는 그동안 끝날 수 있다.
  update는 끝난 판을 옮겨 확인한다. 남은 시간의 이전 여부는 도메인 검사에서 별도로 확인한다.
- Java·.NET 커넥터는 64비트 정수를 자동 변환한다. 서버 e2e와 별도로 브라우저에서 M5의 전송 형식을 확인한다.
```

### 4. 검증 방법

1. 서버 복사본에서 `./run-server.sh`를 실행합니다. Windows에서는 템플릿 README에 적힌 `run-server.ps1` 또는 실행 래퍼를 사용합니다.
2. Session 주소를 `VITE_ZLINK_STREAM_URL`에 넣고, 이 저장소에서 `npm ci`와 `npm run dev`를 실행합니다. 서로 다른 브라우저 두 개를 열어 프롬프트의 A3 순서로 대전합니다.
3. 서버 복사본에서 `./run-e2e.sh` 또는 템플릿의 `run-e2e.ps1`을 실행합니다. 템플릿 README의 빌드·구조 검사와 A1의 시나리오가 통과하는지 확인합니다.

## 검증 범위

Vitest는 다음을 검증합니다.

- 점수 계산(광·열끗·띠·피, 고도리·홍단·청단·초단, 국진), 박과 배수, 쪽·뻑·따닥·폭탄·싹쓸이·자뻑 같은 특수 상황, AI끼리 3,000판을 두며 카드가 사라지거나 늘지 않는 불변식.
- 가림: 보는 사람 기준 자리 변환, AI끼리 300판 동안 상대 손패와 더미가 두 사람 모두에게 새지 않음.
- 이벤트 reducer.
- 로컬 게이트웨이: 차례·손에 없는 패 거절, 컴퓨터 응답 시각, 한 판 끝까지와 다음 판, 다시 시작·dispose의 타이머 정리.

화면은 데스크톱과 휴대폰 가로 배치, 터치·마우스·키보드 입력, 속도 설정과 흔들림 줄이기 설정을 지원합니다.

## 카드 그림 다시 만들기

생성 원본 PNG(1000×1600, 약 56MB)는 저장소에 넣지 않습니다. 다시 만들려면 Codex CLI로 생성한 뒤 WebP로 바꿉니다.

```sh
sh assets/cards/prompts/run.sh 1     # 1~4 배치, 결과는 assets/cards/originals/
python scripts/optimize-cards.py     # 512×820 WebP로 public/cards/ 에 저장
npm run manifest
```

그림이 없는 카드는 코드로 그린 그림(`src/features/matgo_game/view/card/painter.ts`)으로 대신 표시됩니다.
