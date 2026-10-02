// 실행: npm run test:e2e  (Java + Chrome 필요, CHROME_PATH로 Chrome 경로 변경 가능)
// 실제 앱(public/index.html, 에뮬레이터 빌드)을 Hosting 에뮬레이터에 띄우고 Chrome으로 조작한다.
import puppeteer from 'puppeteer-core';
const BASE = 'http://127.0.0.1:5000/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage() {
  const ctx = await browser.createBrowserContext();   // 기기마다 다른 익명 사용자
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  return page;
}
const click = (p, sel) => p.$eval(sel, el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const text = (p, sel) => p.$eval(sel, el => el.textContent).catch(() => '');
async function studentEnter(p, name, cls) {
  await click(p, '[data-action=go-student]');
  await p.$eval('#in-name', (el, v) => el.value = v, name);
  await p.$eval('#in-class', (el, v) => el.value = v, cls);
  await p.$eval('#entry-form', f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function solveBoard(p) {
  await p.evaluate(() => {
    const cells = [...document.querySelectorAll('#board .cell')]; const n = Math.round(Math.sqrt(cells.length));
    const g = []; for (let r = 0; r < n; r++) { g.push([]); for (let c = 0; c < n; c++) { const el = cells[r * n + c]; g[r].push(el.classList.contains('given') ? +el.textContent : 0); } }
    const g0 = g.map(r => r.slice()), bw = n === 4 ? 2 : 3, bh = n === 9 ? 3 : 2;
    const okv = (r, c, v) => { for (let i = 0; i < n; i++) if (g[r][i] === v || g[i][c] === v) return false; const r0 = Math.floor(r / bh) * bh, c0 = Math.floor(c / bw) * bw; for (let i = 0; i < bh; i++) for (let j = 0; j < bw; j++) if (g[r0 + i][c0 + j] === v) return false; return true; };
    const rec = () => { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g[r][c]) { for (let v = 1; v <= n; v++) if (okv(r, c, v)) { g[r][c] = v; if (rec()) return true; g[r][c] = 0; } return false; } return true; };
    rec();
    const fire = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g0[r][c]) {
      fire(document.querySelector(`#board .cell[data-r="${r}"][data-c="${c}"]`));
      fire(document.querySelector(`#pad button[data-val="${g[r][c]}"]`));
    }
  });
}

// 1) 학생 A: 입장 → 규칙 → 쉬움 바로 도전 → 완료
const a = await newPage();
ok(await a.evaluate(() => !!window.SUDOKU_FIREBASE_CONFIG), 'Firebase 설정이 주입된 빌드');
await studentEnter(a, '김하늘', '3-2');
await a.waitForSelector('[data-action=rules-next]', { timeout: 20000 });
ok(await a.evaluate(() => document.compatMode==='CSS1Compat') , '정식 HTML 문서(doctype)로 서빙');
await click(a, '[data-action=rules-next]');
await a.waitForSelector('[data-action=switch-mode][data-mode=easy]');
await click(a, '[data-action=switch-mode][data-mode=easy]');
await a.waitForSelector('#board .cell');
await sleep(300);
await solveBoard(a);
await a.waitForSelector('.result-card');
await a.waitForFunction(() => /위/.test((document.getElementById('result-rank') || {}).textContent || ''), { timeout: 10000 }).catch(() => {});
ok(/1위/.test(await text(a, '#result-rank')), 'Firestore에 저장된 기록으로 반 순위 표시: ' + await text(a, '#result-rank'));

// 2) 학생 B (다른 기기): 랭킹에 A가 보이는지
const b = await newPage();
await studentEnter(b, '박하은', '3-2');
await b.waitForSelector('[data-action=rules-next]', { timeout: 20000 });
await click(b, '[data-action=rules-next]');
await b.waitForSelector('[data-action=switch-mode][data-mode=easy]');
await click(b, '[data-action=switch-mode][data-mode=easy]');
await b.waitForSelector('#side-rank .mini-rank', { timeout: 10000 }).catch(() => {});
ok((await text(b, '#side-rank')).includes('김하늘'), '다른 기기 학생의 TOP 5에 기록이 보임');
// 학생이 직접 학급 설정을 바꾸려 하면 거부되는지(콘솔 조작 시뮬레이션: 같은 SDK로 직접 쓰기)
const tamper = await b.evaluate(async () => {
  const fs = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const { getApp } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
  try { await fs.setDoc(fs.doc(fs.getFirestore(getApp()), 'classConfig/My0y'), { classroom: '3-2', isAssigned: true, assignedBoardSize: 4, assignedLevel: 1, rankingVisibility: 'top3' }); return 'allowed'; }
  catch (e) { return e.code; }
});
ok(tamper === 'permission-denied', '학생이 학급 설정 직접 쓰기 → 거부 (' + tamper + ')');

// 3) 교사: 새 학급 비밀번호 설정 → 대시보드
const t = await newPage();
await click(t, '#nav-teacher');
await t.$eval('#t-class', el => el.value = '3-2');
await t.$eval('#t-pass', el => el.value = 'pw1234');
await t.$eval('#teacher-login-form', f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
await t.waitForSelector('#dash-body .teacher-grid', { timeout: 20000 });
ok((await text(t, '#dash-body')).includes('김하늘'), '교사 대시보드에 학생 기록 표시');
// 일괄 지정: 연습 Lv.2 · 6×6
await t.$eval('#a-on', el => el.value = 'true'); await t.$eval('#a-size', el => el.value = '6'); await t.$eval('#a-level', el => el.value = 'p2');
await click(t, '[data-action=assign-save]');
await t.waitForFunction(() => !document.getElementById('toast').hidden && document.getElementById('toast').textContent.includes('저장'), { timeout: 10000 }).catch(() => {});
ok((await text(t, '#toast')).includes('저장했어요'), '교사 일괄 지정 저장 성공');

// 4) 다른 기기에서 틀린 비밀번호 / 맞는 비밀번호
const t2 = await newPage();
await click(t2, '#nav-teacher');
await t2.$eval('#t-class', el => el.value = '3-2');
await t2.$eval('#t-pass', el => el.value = 'wrong');
await t2.$eval('#teacher-login-form', f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
await t2.waitForFunction(() => !document.getElementById('teacher-err').hidden, { timeout: 20000 });
ok((await text(t2, '#teacher-err')).includes('올바르지'), '틀린 비밀번호 → "비밀번호가 올바르지 않습니다"');
await t2.$eval('#t-pass', el => el.value = 'pw1234');
await t2.$eval('#teacher-login-form', f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
await t2.waitForSelector('#dash-body .teacher-grid', { timeout: 20000 }).then(() => ok(true, '다른 기기에서 맞는 비밀번호로 로그인'), () => ok(false, '다른 기기에서 맞는 비밀번호로 로그인'));

// 5) 학생 A 재입장 → 지정된 연습 Lv.2 6×6
await a.goto(BASE, { waitUntil: 'networkidle0' });
await click(a, '[data-action=quick-continue]');
await a.waitForSelector('#board .cell', { timeout: 20000 });
await sleep(300);
ok((await a.$$('#board .cell')).length === 36 && (await a.$$('.mode-tab:disabled')).length === 4, '학생 재입장 시 교사 지정(연습 Lv.2 6×6, 난이도 탭 잠금) 적용');

// 6) 접속해 있는 학생 A에게, 교사가 '보통+어려움'을 열면 다시 들어오지 않아도 30초 안에 반영
const setDiffs = (p, list) => p.evaluate(list => {
  const sel = document.getElementById('a-level'); sel.value = 'diff'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelectorAll('#a-diffs input').forEach(cb => { cb.checked = list.includes(cb.value); });
}, list);
await setDiffs(t, ['medium', 'hard']);
await t.$eval('#toast', el => { el.hidden = true; el.textContent = ''; });
await click(t, '[data-action=assign-save]');
await t.waitForFunction(() => document.getElementById('toast').textContent.includes('저장했어요'), { timeout: 10000 }).catch(() => {});
const live = await a.waitForFunction(() => {
  const act = document.querySelector('.mode-tab.active');
  return act && act.dataset.mode === 'medium' && document.querySelectorAll('.mode-tab:disabled').length === 3;
}, { timeout: 45000 }).then(() => true, () => false);
ok(live && (await a.$$('#board .cell')).length === 36, '접속 중인 학생에게 지정 변경(보통+어려움) 자동 반영');

// 7) 교사가 난이도 '어려움'만 지정 → 학생은 9×9 어려움 탭만
await setDiffs(t, ['hard']);
await t.$eval('#toast', el => { el.hidden = true; el.textContent = ''; });
await click(t, '[data-action=assign-save]');
await t.waitForFunction(() => document.getElementById('toast').textContent.includes('저장했어요'), { timeout: 10000 }).catch(() => {});
await a.goto(BASE, { waitUntil: 'networkidle0' });
await click(a, '[data-action=quick-continue]');
await a.waitForSelector('#board .cell', { timeout: 20000 });
await sleep(300);
ok((await a.$$('#board .cell')).length === 81 && await a.$eval('.mode-tab.active', el => el.dataset.mode) === 'hard'
   && (await a.$$('.mode-tab:disabled')).length === 4, '교사가 어려움만 지정 → 학생은 9×9 어려움 탭만 열림');

for (const [n, p] of [['A', a], ['B', b], ['T', t], ['T2', t2]]) {
  const errs = p.errors.filter(e => !/Failed to load resource.*(favicon|403)/.test(e) && !/permission/i.test(e));
  ok(!errs.length, `페이지 ${n} 오류 없음 ${errs.join(' | ')}`);
}
await browser.close();
console.log(failed ? `\n${failed}개 실패` : '\n모든 E2E 테스트 통과');
process.exit(failed ? 1 : 0);
