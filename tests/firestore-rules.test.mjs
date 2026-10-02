// Firestore 보안 규칙 테스트 — 에뮬레이터에서 실행한다 (Java 필요):
//   npm run test:rules
// 앱과 똑같이 익명 로그인한 클라이언트 두 개(교사 기기, 학생 기기)로 허용/거부를 확인한다.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, addDoc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { createHash } from 'node:crypto';

const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
const secretOf = (classroom, pass) => sha('sudoku-classroom:' + classroom + ':' + pass);   // 앱의 hashPass와 동일
const classId = 'My0y';  // safeId('3-2')

async function client(name) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-sudoku', appId: 'demo' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await signInAnonymously(auth);
  return { db, uid: auth.currentUser.uid };
}

let failed = 0;
async function expect(label, shouldPass, fn) {
  let ok, err;
  try { await fn(); ok = true; } catch (e) { ok = false; err = e.code || e.message; }
  const good = ok === shouldPass;
  if (!good) failed++;
  console.log(`${good ? 'PASS' : 'FAIL'} ${label}${!good ? `  (기대: ${shouldPass ? '허용' : '거부'}, 실제: ${ok ? '허용' : err})` : ''}`);
}

const teacher = await client('teacher');
const student = await client('student');
const cfg = { classroom: '3-2', isAssigned: false, assignedBoardSize: 9, assignedLevel: 4, assignedDifficulty: null, assignedDifficulties: ['easy', 'medium', 'hard', 'expert'], rankingVisibility: 'all', createdAt: new Date().toISOString() };
const secret = secretOf('3-2', 'pw1234');
const unlockOf = c => [`classUnlocks/${c.uid}_${classId}`, { classId, secret, uid: c.uid, at: 'x' }];

// --- 새 학급 만들기 (앱과 같은 batch) ---
await expect('학급 생성 batch: classSecrets+classConfig+unlock', true, async () => {
  const b = writeBatch(teacher.db);
  b.set(doc(teacher.db, 'classSecrets/' + classId), { passHash: sha(secret) });
  b.set(doc(teacher.db, 'classConfig/' + classId), cfg);
  const [p, d] = unlockOf(teacher); b.set(doc(teacher.db, p), d);
  await b.commit();
});
await expect('잠금 해제 없이 classConfig 생성 거부', false, () => setDoc(doc(student.db, 'classConfig/OTHER'), cfg));
await expect('classSecrets 덮어쓰기 거부', false, () => setDoc(doc(student.db, 'classSecrets/' + classId), { passHash: sha('x') }));

// --- 읽기 ---
await expect('학생이 classConfig 읽기 허용', true, () => getDoc(doc(student.db, 'classConfig/' + classId)));
await expect('학생이 classSecrets 읽기 거부', false, () => getDoc(doc(student.db, 'classSecrets/' + classId)));
await expect('학생이 classUnlocks 읽기 거부', false, () => getDoc(doc(student.db, `classUnlocks/${teacher.uid}_${classId}`)));

// --- 교사 비밀번호 검증 ---
await expect('틀린 비밀번호로 잠금 해제 거부', false, () =>
  setDoc(doc(student.db, `classUnlocks/${student.uid}_${classId}`), { classId, secret: secretOf('3-2', 'wrong'), uid: student.uid, at: 'x' }));
await expect('학생이 classConfig 수정 거부 (잠금 해제 없음)', false, () => updateDoc(doc(student.db, 'classConfig/' + classId), { isAssigned: true }));
await expect('다른 사람 uid로 잠금 해제 문서 쓰기 거부', false, () =>
  setDoc(doc(student.db, `classUnlocks/${teacher.uid}_${classId}`), { classId, secret, uid: teacher.uid, at: 'x' }));
await expect('교사가 classConfig 수정 허용', true, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { isAssigned: true, assignedBoardSize: 6, assignedLevel: 2, assignedAt: 'x' }));
await expect('교사가 난이도(보통) 지정 허용', true, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedLevel: 4, assignedDifficulty: 'medium' }));
await expect('교사가 연습 지정으로 되돌리기(난이도 null) 허용', true, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedLevel: 2, assignedDifficulty: null }));
await expect('교사가 난이도 여러 개(쉬움+어려움) 지정 허용', true, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedLevel: 4, assignedDifficulty: null, assignedDifficulties: ['easy', 'hard'] }));
await expect('난이도 목록에 없는 값 거부', false, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedDifficulties: ['easy', 'insane'] }));
await expect('빈 난이도 목록 거부', false, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedDifficulties: [] }));
await expect('난이도 목록 null(연습 지정) 허용', true, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedLevel: 2, assignedDifficulties: null }));
await expect('없는 난이도 지정 거부', false, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedDifficulty: 'insane' }));
await expect('교사도 잘못된 값은 거부 (assignedLevel 7)', false, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { assignedLevel: 7 }));
await expect('교사도 모르는 필드 추가 거부', false, () => updateDoc(doc(teacher.db, 'classConfig/' + classId), { passcode: 'x' }));
await expect('같은 기기 재로그인(맞는 비밀번호) 허용', true, () => { const [p, d] = unlockOf(teacher); return setDoc(doc(teacher.db, p), d); });
await expect('다른 기기에서 맞는 비밀번호로 잠금 해제 허용', true, () => { const [p, d] = unlockOf(student); return setDoc(doc(student.db, p), d); });

// --- 학생 데이터 ---
const prof = { studentName: '김하늘', classroom: '3-2', totalXP: 120, level: 2, badges: ['새싹'], totalCompleted: 3, streakDays: 1,
  lastPlayedDate: new Date().toDateString(), tutorialLevel: 2, boardSizePref: 6, bestDifficulty: null, avatar: '🦊',
  bests: { easy: { score: 300, sec: 280, mistakes: 2, hints: 0, at: 'x' } }, lastMode: 'easy' };
await expect('프로필 저장 허용', true, () => setDoc(doc(student.db, 'profiles/a'), prof));
await expect('프로필: 모르는 필드 거부', false, () => setDoc(doc(student.db, 'profiles/b'), { ...prof, isTeacher: true }));
await expect('프로필: 이름 21자 거부', false, () => setDoc(doc(student.db, 'profiles/c'), { ...prof, studentName: 'x'.repeat(21) }));
await expect('프로필: 음수 XP 거부', false, () => setDoc(doc(student.db, 'profiles/d'), { ...prof, totalXP: -5 }));
await expect('학급 프로필 조회 허용', true, async () => { const q = await getDocs(query(collection(student.db, 'profiles'), where('classroom', '==', '3-2'))); if (q.size !== 1) throw new Error('size ' + q.size); });
const sess = { studentKeyId: 'a', studentName: '김하늘', classroom: '3-2', kind: 'free', level: null, difficulty: 'easy', boardSize: 9,
  durationSec: 280, mistakeCount: 2, hintCount: 0, completed: true, xpEarned: 40, stars: 2, maxCombo: 5, recordScore: 300,
  startedAt: 'x', finishedAt: 'y' };
let sessRef;
await expect('풀이 기록 추가 허용', true, async () => { sessRef = await addDoc(collection(student.db, 'sessions'), sess); });
await expect('풀이 기록 수정 거부', false, () => updateDoc(sessRef, { xpEarned: 9999 }));
await expect('교사가 학급 풀이 기록 조회 허용', true, () => getDocs(query(collection(teacher.db, 'sessions'), where('classroom', '==', '3-2'))));

console.log(failed ? `\n${failed}개 실패` : '\n모든 규칙 테스트 통과');
process.exit(failed ? 1 : 0);
