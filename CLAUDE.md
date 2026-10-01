# 스도쿠 교실

학생용 단계별 스도쿠 학습 게임과 교사 대시보드가 하나로 된 앱이다.

- **학생:** 이름 + 학급 + 아바타로 로그인 없이 들어온다. 게임 화면의 난이도 탭에서 바로 도전하고, 난이도별로 반 랭킹을 겨룬다.
- **교사:** 상단 메뉴 "교사"에서 학급 코드 + 비밀번호로 들어간다. 반 기록과 랭킹을 보고, 학습 단계를 일괄 지정한다.

## 배포 위치 (같은 `index.html`, 기록 저장소는 서로 다름)

| 위치 | 저장소 | 갱신 방법 |
|---|---|---|
| **Firebase Hosting** https://sudoku-617bb.web.app (계획서 `/plan`) | Firestore `(default)` @ asia-northeast3 | `npm run deploy` (Hosting + 보안 규칙) |
| **Claude 아티팩트** https://claude.ai/artifact/URSBNqAgU2PJwpMTaT2aaP | 아티팩트 `db` 캡서빌리티 | Artifact 도구로 `index.html`을 같은 경로/URL에 publish |

- 두 곳 모두 akrenddl7@gmail.com 소유다. Firebase 프로젝트는 `sudoku-617bb`이고 `.firebaserc`에 지정되어 있다.
- 학생 기록은 두 저장소 사이에 옮겨지지 않는다. 현재 주 운영은 Firebase다.
- 예전 학교 계정 아티팩트(`0d0a3090…`, 계획서 `d88ba062…`)는 이 계정으로 수정할 수 없다.
- 아티팩트 재배포 때 `capabilities`를 생략하면 기존 설정(`db`, `downloads`)이 유지된다. 명시하면 전체가 그 값으로 바뀐다.
- 아티팩트는 기본이 비공개다. 학생이 기록을 저장하려면 공유를 "링크가 있는 모든 사용자 — 편집 가능"으로 해야 한다. 보기 전용 권한으로는 db에 쓸 수 없다.

## 파일

- `index.html`: 앱 전체. 외부 라이브러리 없는 순수 JS 단일 파일이다.
  - 아티팩트 형식의 **조각 HTML**이라 doctype/head가 없다. 그대로 두어야 아티팩트로 publish할 수 있다.
- `plan.html`: 기획서(v0.2). 기능을 바꿀 때 먼저 확인하고 함께 고친다.
- `scripts/build-hosting.mjs`: 조각 HTML을 완전한 문서로 감싸 `public/`에 쓰고 `window.SUDOKU_FIREBASE_CONFIG`를 넣는다.
  - `firebase deploy`의 predeploy로 자동 실행된다.
  - `--emulator`를 주면 에뮬레이터용으로 빌드한다.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `firebase-config.json`: Firebase 설정.
  - `firebase-config.json`의 웹 앱 설정은 공개돼도 되는 값이다. 접근 제어는 보안 규칙이 한다.
- `tests/`
  - `app-flow.test.cjs`: jsdom 앱 흐름 59항목
  - `firestore-rules.test.mjs`: 규칙 22항목
  - `e2e.mjs`: 에뮬레이터 + Chrome 15항목
- `FIREBASE.md`: 처음부터 배포하는 절차(콘솔 설정, 로그인, 배포).
- `public/`, `.firebase/`, `node_modules/`는 빌드·캐시 결과물이라 커밋하지 않는다.

## 명령

```bash
npm install            # firebase-tools, firebase, puppeteer-core, jsdom
npm run test:app       # 앱 흐름 (Node만 있으면 됨)
npm run test:rules     # Firestore 보안 규칙 (에뮬레이터 → Java 11+ 필요)
npm run test:e2e       # 실제 앱을 Hosting 에뮬레이터 + Chrome으로 조작 (Java + Chrome)
npm run serve:emulator # http://127.0.0.1:5000 에서 직접 써 보기
npm run deploy         # 운영 배포
```

- Firebase CLI는 대화형 로그인이 필요하다. `!` 프롬프트에서는 입력을 받을 수 없어 중간에 끝나므로, 사용자에게 별도 PowerShell 창에서 `npx firebase login`을 실행해 달라고 한다.
- Chrome 경로가 다르면 `CHROME_PATH`로 지정한다.

## 아키텍처 (`index.html`)

**상태 머신:** `App` 전역 객체가 현재 화면과 세션 상태를 들고 있고, `view.innerHTML`을 화면마다 교체한다. 클릭은 `data-action` 이벤트 위임 하나로 처리한다(`closest('[data-action]')`에서 `switch`).

**화면 이동:** 화면 이동은 모두 `navigate()`를 거친다.
- 진행 중인 퍼즐(`s.moves>0`)을 버리는 동작(홈, 사용자 전환, 탭 전환)은 자체 모달 `confirmModal()`로 확인한다. `window.confirm`은 아티팩트 iframe에서 막힐 수 있다.
- 랭킹·교사 화면으로 갈 때는 `pauseSession()`으로 멈췄다가 `resumeSession()`으로 이어서 푼다.

**게임 화면(`renderPlay`):**
- 맨 위 모드 탭 `[연습 · 쉬움 · 보통 · 어려움 · 전문가]`: 모두 처음부터 열려 있고, `switchMode()`로 바꾼다.
- 난이도는 **판 크기**로 나눈다(대상이 초등학생이라 단서 수만 줄이면 갑자기 어려워짐). `DIFF_SIZE`/`DIFF_CLUES`/`DIFF_HINTS`:
  - 쉬움 4×4·8칸·힌트 2 → 보통 6×6·18칸·힌트 3 → 어려움 9×9·40칸·힌트 5 → 전문가 9×9·34칸·힌트 3
- 옆 패널(`renderSideRank`): 그 난이도의 반 TOP 5를 보여 준다. 연습 탭이면 학습 사다리 지도를 보여 준다.
- 재미 요소: 콤보, 별 1~3개, 색종이, 칸 애니메이션, 숫자별 남은 개수, 진행 막대. 효과음은 기본 꺼짐이다.

**학습 사다리 (연습 탭):**
- 단계: Lv.0 규칙(첫 입장 1회) → Lv.1 첫 완주(4/6/9 크기 선택) → Lv.2 가이드(힌트 무제한 + 후보 자동 표시) → Lv.3 홀로서기(힌트 3회) → Lv.4 완주
- 단계는 `Math.max`로만 올라가고 되돌아가지 않는다.
- 기본 탭은 `profile.lastMode`다.

**교사 일괄 지정:** `classConfig.isAssigned`가 켜져 있으면 `modeLocked()`가 탭을 잠근다.
- 연습 Lv.1~3을 지정하면 난이도 탭이 잠기고 지정된 크기·단계로 바로 시작한다.
- '난이도 도전'(Lv.4)을 지정하면 연습 탭만 잠긴다.
- 지정 모드에서는 완료 후 다음 단계로 넘어가지 않고 "다시 도전"만 준다.

**난이도별 랭킹:**
- 프로필 `bests[난이도] = {score, sec, mistakes, hints, size, at}`에 학생별 최고 기록 하나만 둔다.
- `bestOf()`는 `size`가 현재 `DIFF_SIZE`와 같은 기록만 인정한다. 그래서 v0.2(모두 9×9) 때 기록은 랭킹·최고 기록에서 빠진다. **난이도별 판 크기를 다시 바꾸면 기존 기록이 같은 방식으로 무효가 된다.**
- `score`(보정 기록) = 시간 + 실수×10초 + 힌트×30초이고, 낮을수록 순위가 높다.
- 계산 순서: `fetchClassRows()`(학급 profiles 한 번 조회, 20초 캐시, 내 최신 프로필로 덮어씀) → `sortForMode()` → 교사 공개 범위 `visibleSlice()`.
- 연습 기록은 종합(XP) 랭킹에만 반영된다.
- 힌트는 두 가지로 센다.
  - `hintsUsed`: 힌트 제한과 XP 감점용. 무제한 단계에서는 세지 않는다.
  - `hintsTaken`: 실제 사용 수. 별점, 보정 기록, 세션 기록에 쓴다.

**스도쿠 엔진 (파일 상단):** 4×4·6×6·9×9 백트래킹 생성기와 유일해 검증기(비트마스크 + MRV)다.
- 노드 예산(`nodeBudget`)을 넘기면 그 칸은 비우지 않는다.
- **`hitBudget`이면 반드시 제거를 되돌려야 한다.** 예전 버그에서는 9×9 단서 20칸 퍼즐의 약 40%가 해가 여러 개라 맞는 답이 오답 처리됐다.
- 현재 난이도 목표(8/18/40/34칸)는 항상 정확히 맞춰지고, 생성은 수 ms 안에 끝난다.

## 저장소 계층

**코드는 하나, 저장소는 둘:** `initCaps()`가 시작할 때 저장소를 고른다.
- `window.SUDOKU_FIREBASE_CONFIG`(Firebase 빌드만 주입)가 있으면 `initFirebase()`를 쓴다.
  - gstatic CDN에서 Firebase SDK 12.19.0을 동적 import하고 익명 로그인한다.
  - `window.SUDOKU_FIREBASE_EMULATOR`가 있으면 에뮬레이터에 연결한다.
- 없으면 Claude `db` 캡서빌리티를 쓴다.
- 두 저장소 모두 `doc(p).get/set/update`, `collection(p).add/where().get` 모양으로 감싸서, 앱의 나머지 코드는 저장소를 구분하지 않는다.
- 저장소별로 다르게 처리하는 곳은 세 군데뿐이다.
  - 교사 로그인
  - CSV 다운로드(Firebase는 브라우저 기본 다운로드)
  - 연결 실패 안내 문구(`offlineMsg()`)
- db가 없으면 `localStorage`로 조용히 폴백한다(`saveProfile`/`recordSession`).

**컬렉션:**

| 컬렉션 | 내용 |
|---|---|
| `profiles` | 학생당 1건 |
| `sessions` | 완료할 때마다 1건 |
| `classConfig` | 학급 설정 |
| `classSecrets` | 비밀번호 해시 (Firebase만) |
| `classUnlocks` | 교사 잠금 해제 (Firebase만) |

- 문서 ID는 `safeId()`(UTF-8 → URL-safe base64)로 만든다. 원본 이름·학급은 필드에 저장해 `where('classroom','==',…)` 조회에 쓴다.

**반드시 지킬 것:**
- **첫 화면은 db를 기다리지 않고 그린다**(`renderHome(); capsReady();`). 캡서빌리티 협상은 최대 10초 걸리고, 기다리게 했더니 "앱이 안 열린다"는 버그가 났었다.
- **db를 쓰는 동작(학생 입장, 교사 로그인)은 `await capsReady()`로 연결을 기다린다.** 안 기다리면 기본 프로필로 시작했다가, 나중에 db가 붙은 뒤 서버 기록을 빈 프로필로 덮어쓴다.
  - 타임아웃은 15초이고, 늦게 도착한 db는 쓰지 않는다.
- **db에서 읽은 문서는 깊은 복사 후 수정한다.** 아티팩트 db의 `data()`는 동결(frozen) 객체라 그대로 고치면 strict 모드에서 오류가 난다.
- **db에서 읽은 값은 학생이 쓸 수 있는 데이터다.** HTML에 넣을 때는 항상 `esc()`, 숫자는 `+x||0`, 아바타는 `avatarOf()` 화이트리스트를 거친다.
- **프로필·세션·classConfig에 필드를 추가하면 `firestore.rules`도 같이 고친다.** 규칙의 `keys().hasOnly([...])` 때문에 저장이 거부된다. 규칙 테스트에도 항목을 추가한다.

## 교사 인증

**Firebase (서버 검증):**
- 키 정의
  - secret = SHA-256('sudoku-classroom:'+학급+':'+비밀번호)
  - `classSecrets/{학급}.passHash` = SHA-256(secret). 아무도 읽을 수 없다.
- 로그인 = `classUnlocks/{uid}_{학급}`에 secret을 쓰는 것이다.
  - 규칙이 `hashing.sha256(secret)`을 passHash와 비교해 맞을 때만 허용한다.
- `classConfig` 수정은 잠금 해제 문서가 있는 uid만 할 수 있다.
- 새 학급은 세 문서를 batch 한 번으로 만든다(`existsAfter`/`getAfter`). 처음 비밀번호를 정한 사람이 학급을 갖는다.
- 비밀번호를 분실하면 콘솔에서 해당 `classSecrets`·`classConfig` 문서를 지운다.

**아티팩트:**
- `classConfig.passHash`에 클라이언트가 비교하는 해시를 둔다.
- 예전 평문 `passcode`는 다음 로그인 때 해시로 옮기고 평문은 지운다.
- 학생도 classConfig를 쓸 수 있어서 서버 검증은 불가능하다(알려진 한계).

**공통 한계:** 학생은 이름+학급으로만 구분한다. 그래서 다른 학생 이름으로 들어가 기록을 덮어쓰는 것은 막지 못한다.

## 수정 체크리스트

1. `plan.html`의 관련 섹션을 확인하고 함께 고친다.
2. `index.html`을 고친 뒤 `npm run test:app`을 돌린다.
   - 저장 형식이나 교사 기능을 건드렸으면 `npm run test:rules`와 `npm run test:e2e`도 돌린다.
   - 생성기 로직은 Node에서 직접 돌려 단서 수와 유일해를 검증하는 편이 빠르다.
3. 디자인은 헤드리스 Chrome 스크린샷으로 확인한다(`--headless=new --screenshot --virtual-time-budget`).
   - 헤드리스 창은 최소 폭이 500px라서, 모바일(390px)은 iframe에 넣어 찍는다.
   - CSS 애니메이션은 멈춘 프레임으로 찍힐 수 있다. 별이나 진행 막대가 비어 보이면 대개 이 때문이다.
4. 배포
   - Firebase: `npm run deploy`
   - 아티팩트: Artifact 도구로 같은 URL에 publish
   - 운영 DB에 테스트 데이터를 만들었다면 끝난 뒤 지운다.
     - Firestore REST API를 CLI 자격 증명으로 호출하면 된다(`firebase-tools/lib/apiv2`).
     - 보안 규칙상 클라이언트는 삭제가 불가능하다.
5. 커밋 메시지 끝에 `Co-Authored-By` 줄을 붙인다. 기본 브랜치는 `main`이다.

## 운영 이슈

- **작업 폴더는 `C:\Users\USER\projects\sdok`(OneDrive 밖)이다.** 2026-10-01에 OneDrive 폴더(`바탕 화면\claude-test`) 안의 파일이 한꺼번에 사라진 일이 있어, GitHub에서 이곳으로 복구했다. OneDrive 안에서 작업하지 않는다.
- Firestore 에뮬레이터용 Java는 시스템에 설치되어 있지 않다. 테스트할 때 휴대용 JRE를 받아 PATH에 넣었다.
- 학교 네트워크가 `claude.ai`를 막아 아티팩트가 안 열리는 경우가 있다. 이때는 Firebase 주소를 쓴다.
- "페이지를 찾을 수 없음"이 뜨면 대개 아티팩트 공유 설정이 안 됐거나 다른 계정으로 로그인한 경우다.
- Firebase Authentication은 콘솔에서 "시작하기"를 눌러야 초기화된다. API로 강제로 초기화하면 프로젝트가 Identity Platform(유료 요금제 있음)으로 전환되므로 하지 않는다.
- 익명 로그인은 이미 켜져 있다.
