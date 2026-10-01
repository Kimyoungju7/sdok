# Firebase로 배포하기

같은 `index.html`이 두 곳에서 동작한다.

| 배포 위치 | 기록 저장소 | 비고 |
|---|---|---|
| Firebase Hosting | Firestore | 이 문서 |
| Claude 아티팩트 | Claude 아티팩트 db | 기존 링크, 그대로 유지 |

두 저장소는 서로 연결되지 않는다. 학생 기록은 배포 위치마다 따로 쌓인다.

## 1. Firebase 콘솔 준비 (처음 한 번)

1. **Authentication** → 시작하기 → 로그인 방법 → **익명** 사용 설정
   - 학생은 로그인 없이 쓰지만, 보안 규칙이 요청자를 구분할 수 있도록 익명 로그인이 필요하다.
2. **Firestore Database** → 데이터베이스 만들기 → 프로덕션 모드 → 위치 `asia-northeast3 (서울)` 권장
   - 보안 규칙은 3단계에서 이 저장소의 `firestore.rules`로 덮어쓴다.
3. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱 추가(</>)** → 표시되는 `firebaseConfig` 값을 [`firebase-config.json`](firebase-config.json)에 붙여 넣는다.
   - 이 값은 공개되어도 되는 식별자다. 접근 제어는 보안 규칙이 한다.

## 2. 도구 설치 (처음 한 번)

```bash
npm install
npx firebase login
```

프로젝트는 `.firebaserc`에 `sudoku-617bb`로 지정되어 있다. 다른 프로젝트에 배포하려면 `npx firebase use --add`.

## 3. 배포

```bash
npm run deploy
```

- 배포 전에 `scripts/build-hosting.mjs`가 자동으로 실행된다.
  - `index.html`·`plan.html`을 완전한 HTML 문서로 감싸 `public/`에 쓴다.
  - Firebase 설정을 페이지에 넣는다.
- Hosting과 Firestore 보안 규칙이 함께 배포된다.
- 완료되면 `https://<프로젝트ID>.web.app` 주소가 나온다. 계획서는 `/plan`에 있다.

## 교사 비밀번호는 어떻게 지켜지나

교사 로그인은 지금처럼 **학급 코드 + 비밀번호**다. Firebase에서는 비밀번호 확인을 **보안 규칙이 서버에서** 한다.

| 컬렉션 | 내용 | 접근 |
|---|---|---|
| `classSecrets/{학급}` | 비밀번호 해시 | 아무도 읽을 수 없음, 처음 만든 사람만 생성 |
| `classUnlocks/{기기uid}_{학급}` | 로그인 기록 | 비밀번호가 맞아야만 쓸 수 있음 (읽기 불가) |
| `classConfig/{학급}` | 단계 지정, 공개 범위 | 위 로그인 기록이 있는 기기만 수정 가능 |

- 학생이 개발자 도구로 직접 써도 학급 설정은 바꿀 수 없다. `tests/`에서 검증했다.
- 비밀번호를 잊으면 콘솔에서 해당 학급의 `classSecrets`, `classConfig` 문서를 지운 뒤 다시 설정한다.
- **남아 있는 한계:** 학생 프로필은 로그인 없이 이름+학급으로 구분한다. 그래서 다른 학생 이름으로 들어가 기록을 덮어쓰는 것까지는 막지 않는다. 기존 아티팩트 버전과 같은 수준이다.

## 로컬 테스트 (선택, Java 11+ 필요)

```bash
npm run test:rules       # 보안 규칙 25개 항목
npm run test:e2e         # 실제 앱을 에뮬레이터 + Chrome으로 조작 (학생 2명·교사 2기기)
npm run serve:emulator   # http://127.0.0.1:5000 에서 직접 써 보기
```
