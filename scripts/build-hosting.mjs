// Firebase Hosting용 빌드: index.html·plan.html(아티팩트용 조각 HTML)을 완전한 HTML 문서로 감싸
// public/에 쓰고, firebase-config.json의 설정을 window.SUDOKU_FIREBASE_CONFIG로 넣는다.
// `firebase deploy` 전에 자동 실행된다(firebase.json의 predeploy).
//
//   node scripts/build-hosting.mjs              실제 배포용
//   node scripts/build-hosting.mjs --emulator   로컬 에뮬레이터용(가짜 프로젝트 + 에뮬레이터 연결)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');
const emulator = process.argv.includes('--emulator');

let config;
if (emulator) {
  config = { apiKey: 'demo-key', authDomain: 'demo-sudoku.firebaseapp.com', projectId: 'demo-sudoku', appId: 'demo' };
} else {
  config = JSON.parse(readFileSync(join(root, 'firebase-config.json'), 'utf8'));
  const missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter(k => !config[k] || String(config[k]).includes('PASTE_'));
  if (missing.length) {
    console.error(`firebase-config.json에 Firebase 웹 앱 설정값을 넣어 주세요 (비어 있음: ${missing.join(', ')}).\n` +
      'Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱 → SDK 설정 및 구성(firebaseConfig)');
    process.exit(1);
  }
}

// 조각 HTML을 split 위치에서 나눠 앞부분(<title>·<link>·<style>)은 <head>로, 나머지는 <body>로
function wrap(fragment, split, inject) {
  const head = split > 0 ? fragment.slice(0, split) : '';
  const body = split > 0 ? fragment.slice(split) : fragment;
  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%A7%A9%3C/text%3E%3C/svg%3E">',
    inject + head,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    ''
  ].join('\n');
}
const afterFirstStyle = html => { const i = html.indexOf('</style>'); return i < 0 ? -1 : i + '</style>'.length; };

const cfgScript = `<script>window.SUDOKU_FIREBASE_CONFIG = ${JSON.stringify(config)};` +
  (emulator ? ` window.SUDOKU_FIREBASE_EMULATOR = {host: location.hostname, authPort: 9099, firestorePort: 8080};` : '') +
  `</script>\n`;

mkdirSync(out, { recursive: true });
const app = readFileSync(join(root, 'index.html'), 'utf8');
writeFileSync(join(out, 'index.html'), wrap(app, afterFirstStyle(app), cfgScript));
const plan = readFileSync(join(root, 'plan.html'), 'utf8');
writeFileSync(join(out, 'plan.html'), wrap(plan, afterFirstStyle(plan), ''));
console.log(`public/ 빌드 완료 (${emulator ? '에뮬레이터' : config.projectId})`);
