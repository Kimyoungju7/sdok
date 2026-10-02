// Claude 아티팩트 저장소(가짜 window.claude db)로 앱 전체 흐름을 jsdom에서 시뮬레이션한다: npm run test:app
const {JSDOM}=require('jsdom'); const fs=require('fs'); const {webcrypto}=require('crypto');
function deepFreeze(o){ if(o&&typeof o==='object'){ Object.values(o).forEach(deepFreeze); Object.freeze(o);} return o; }
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','index.html'),'utf8');
const store={}; const failGet=new Set(); let csvSaved=null;
const clone=x=>JSON.parse(JSON.stringify(x));
function mkdb(){
  const doc=p=>({get:async()=>{ if(failGet.has(p)) throw new Error('offline'); return {exists:p in store,data:()=>deepFreeze(clone(store[p]))}; },
    set:async d=>{store[p]=clone(d);}, update:async d=>{store[p]=Object.assign(store[p]||{},clone(d));}});
  const coll=n=>({add:async d=>{store[n+'/'+Math.random().toString(36).slice(2)]=clone(d);},
    where:(f,op,v)=>({get:async()=>({docs:Object.keys(store).filter(k=>k.split('/')[0]===n&&k.split('/').length===2&&store[k][f]===v).map(k=>({id:k,data:()=>deepFreeze(clone(store[k]))}))})})});
  return {doc,collection:coll};
}
const b64=s=>Buffer.from(s).toString('base64').replace(/\//g,'_').replace(/=+$/,'');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://claude.ai/x',
  beforeParse(w){ w.claude={use:n=>new Promise(r=>setTimeout(()=>r(n==='db'?mkdb():n==='downloads'?{save:async x=>{csvSaved=x;}}:null),300))};
    Object.defineProperty(w,'crypto',{value:webcrypto}); w.TextEncoder=TextEncoder; w.Element.prototype.scrollIntoView=()=>{}; }});
const w=dom.window,d=w.document; const errs=[];
w.addEventListener('error',e=>errs.push(e.message)); w.addEventListener('unhandledrejection',e=>errs.push('UR '+(e.reason&&e.reason.stack)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const $=s=>d.querySelector(s), $$=s=>[...d.querySelectorAll(s)];
const click=sel=>{const el=typeof sel==='string'?$(sel):sel; if(!el) throw new Error('missing '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const key=k=>d.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++;};
const submit=id=>$('#'+id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
function readBoard(){ const cells=$$('#board .cell'); const n=Math.round(Math.sqrt(cells.length));
  const g=[]; for(let r=0;r<n;r++){ g.push([]); for(let c=0;c<n;c++){ const el=cells[r*n+c]; g[r].push(el.classList.contains('given')?+el.textContent:0);} } return g; }
function solve(g){ const n=g.length, bw=n===4?2:3, bh=n===9?3:2;
  const okv=(r,c,v)=>{ for(let i=0;i<n;i++) if(g[r][i]===v||g[i][c]===v) return false; const r0=Math.floor(r/bh)*bh,c0=Math.floor(c/bw)*bw; for(let i=0;i<bh;i++)for(let j=0;j<bw;j++) if(g[r0+i][c0+j]===v) return false; return true; };
  const rec=()=>{ for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(!g[r][c]){ for(let v=1;v<=n;v++) if(okv(r,c,v)){ g[r][c]=v; if(rec()) return true; g[r][c]=0;} return false;} return true; };
  rec(); return g; }
function solveOnScreen(){ const g0=readBoard(); const sol=solve(g0.map(r=>r.slice())); const n=g0.length;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(!g0[r][c]){ click(`#board .cell[data-r="${r}"][data-c="${c}"]`); click(`#pad button[data-val="${sol[r][c]}"]`); } return sol; }
function wrongMove(){ const g0=readBoard(); const sol=solve(g0.map(r=>r.slice())); const n=g0.length;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(!g0[r][c]){ click(`#board .cell[data-r="${r}"][data-c="${c}"]`); click(`#pad button[data-val="${sol[r][c]%n+1}"]`); return; } }
(async()=>{
  const myId=b64('3-2__김하늘');
  store['profiles/'+myId]={studentName:'김하늘',classroom:'3-2',totalXP:500,level:2,tutorialLevel:2,boardSizePref:4,totalCompleted:5,streakDays:1,badges:['새싹']};
  store['profiles/'+b64('3-2__빠른이')]={studentName:'빠른이',classroom:'3-2',totalXP:900,level:3,avatar:'🐼',bests:{easy:{score:5,sec:5,mistakes:0,hints:0,size:4,at:'2026-09-30T00:00:00Z'}}};
  store['profiles/'+b64('3-2__느린이')]={studentName:'느린이',classroom:'3-2',totalXP:100,level:1,avatar:'🐯',bests:{easy:{score:99999,sec:99999,mistakes:0,hints:0,size:4,at:'2026-09-30T00:00:00Z'}}};
  store['profiles/'+b64('3-2__예전이')]={studentName:'예전이',classroom:'3-2',totalXP:10,level:1,avatar:'🐨',bests:{easy:{score:1,sec:1,mistakes:0,hints:0,at:'2026-09-01T00:00:00Z'}}};
  store['profiles/'+b64('3-2__x')]={studentName:'<img src=x onerror=alert(1)>',classroom:'3-2',totalXP:50,avatar:'<b>bad</b>',bests:{easy:{score:'<i>1</i>',sec:5,size:4,at:'<script>'}}};
  store['classConfig/'+b64('3-2')]={classroom:'3-2',passcode:'old',isAssigned:false,assignedBoardSize:9,assignedLevel:4,rankingVisibility:'all'};

  ok(!$('.home-card') && $('#nav-teacher') && !$('#nav-teacher').hidden,'teacher entry moved to top menu (not on home)');
  ok($('.hero') && $('[data-action=go-student]'),'home hero with start button');
  click('[data-action=go-student]');
  ok($$('.av-btn').length===12,'avatar picker shown');
  click($$('.av-btn').find(b=>b.dataset.av==='🐧'));
  $('#in-name').value='김하늘'; $('#in-class').value='3-2'; submit('entry-form');
  await wait(600);
  ok($$('.mode-tab').length===5,'play screen has 5 mode tabs');
  ok($('.mode-tab.active') && $('.mode-tab.active').dataset.mode==='practice','default tab practice for ladder-in-progress student');
  ok($$('#board .cell').length===16,'resumed practice at saved 4x4 size');
  ok($('.play-head .stage-tag').textContent.includes('LV.2'),'resumed server Lv.2');
  ok(store['profiles/'+myId].avatar==='🐧' && store['profiles/'+myId].totalXP===500,'avatar saved without clobbering progress');
  ok($('#side-rank').textContent.includes('학습 사다리'),'practice side panel shows ladder map');
  ok(!$('#nav-rank').hidden,'ranking menu visible after entry');
  click('.mode-tab[data-mode="easy"]'); await wait(200);
  ok($$('#board .cell').length===16 && $('.mode-tab.active').dataset.mode==='easy','switch to easy (4x4) without confirm when no moves');
  await wait(50);
  ok($('#side-rank').textContent.includes('TOP 5') && $('#side-rank').textContent.includes('빠른이'),'side panel shows easy TOP 5');
  ok(!$('#side-rank').textContent.includes('<img'),'record with non-numeric score excluded from difficulty ranking');
  for(const [m,n] of [['medium',36],['hard',81],['expert',81],['easy',16]]){
    click(`.mode-tab[data-mode="${m}"]`); await wait(200);
    ok($$('#board .cell').length===n && $('.mode-tab.active').dataset.mode===m, `${m} uses ${Math.sqrt(n)}x${Math.sqrt(n)} board`);
  }
  ok($$('#board .cell.given').length===8,'easy 4x4 starts with 8 given numbers');
  ok($('.mode-tab[data-mode="medium"] .tab-size').textContent==='6×6','tab shows board size');
  await wait(50);
  wrongMove();
  ok($('#stat-mistakes').textContent==='1' && $('.cell.error'),'wrong input counted and marked');
  click('.mode-tab[data-mode="medium"]'); await wait(20);
  ok(!$('#modal').hidden,'confirm modal on switch with progress');
  click('#modal-cancel'); await wait(50);
  ok($('.mode-tab.active').dataset.mode==='easy' && $('#stat-mistakes').textContent==='1','cancel keeps current puzzle');
  click('#nav-rank'); await wait(80);
  ok($('[data-action=resume-game]') && $('.mode-tab.active[data-tab="easy"]'),'ranking opens on current difficulty tab with resume button');
  click('.mode-tab[data-tab="overall"]'); await wait(80);
  ok(!$('#rank-body img') && !$('#rank-body b:not(.mono) b') && $('#rank-body').textContent.includes('<img'),'ranking (overall) escapes injected name/avatar');
  ok(!$$('#rank-body tbody tr').some(tr=>tr.textContent.includes('bad')) || $('#rank-body').textContent.includes('🙂'),'unknown avatar replaced');
  click('[data-action=resume-game]'); await wait(50);
  ok($('#stat-mistakes').textContent==='1' && $$('#board .cell').length===16,'resume keeps puzzle state');
  solveOnScreen(); await wait(100);
  ok($('.result-card'),'completion → result screen');
  ok($('.record-box') && $('.newbest') && $('.newbest').textContent.includes('첫 기록'),'record box with first-record message');
  ok($$('.star.on').length===2,'stars computed (1 mistake → 2 stars)');
  await wait(100);
  ok(/2위/.test($('#result-rank').textContent),'result shows class rank: '+$('#result-rank').textContent);
  const saved=store['profiles/'+myId];
  ok(saved.bests && saved.bests.easy && saved.bests.easy.mistakes===1 && saved.lastMode==='easy' && saved.totalXP>500,'best record, lastMode, XP saved');
  ok(saved.bests.easy.size===4,'record stores board size');
  const sess=Object.keys(store).filter(k=>k.startsWith('sessions/')).map(k=>store[k]);
  ok(sess.length===1 && sess[0].stars===2 && sess[0].recordScore===saved.bests.easy.score,'session doc has stars/recordScore');
  click('[data-action=show-ranking]'); await wait(80);
  const names=$$('#rank-body tbody tr').map(tr=>tr.children[1].textContent.trim());
  ok(!names.some(n=>n.includes('예전이')),'old-rule (9x9 easy) record excluded from easy ranking');
  ok(names[0].includes('빠른이') && names[1].includes('김하늘') && names.length===3,'easy ranking order by record: '+names.join(' | '));
  ok($('.podium') && $('#rank-body tr.me'),'podium + my row highlighted');
  click('.mode-tab[data-tab="overall"]'); await wait(80);
  ok($$('#rank-body tbody tr')[0].textContent.includes('빠른이'),'overall tab sorts by XP');
  click('.mode-tab[data-tab="expert"]'); await wait(80);
  ok($('#rank-body').textContent.includes('첫 번째 주인공'),'empty difficulty shows encouragement');
  click('[data-action=play-now]'); await wait(200);
  ok($('.mode-tab.active') && $('.mode-tab.active').dataset.mode==='easy','play-now uses lastMode');
  wrongMove(); click('#btn-home'); await wait(20);
  ok(!$('#modal').hidden,'home with progress asks confirm'); click('#modal-ok'); await wait(30);
  ok($('.hero') && $('[data-action=play-now]'),'home shows continue button for logged-in student');
  click('#nav-teacher'); await wait(30);
  ok($('#teacher-login-form'),'teacher login via top menu');
  $('#t-class').value='3-2'; $('#t-pass').value='old'; submit('teacher-login-form'); await wait(150);
  const cfgKey='classConfig/'+b64('3-2');
  ok(store[cfgKey].passHash && store[cfgKey].passcode==null,'legacy password migrated to hash');
  ok($('#t-rank') && $$('#t-rank-tabs .mode-tab').length===5,'teacher ranking has difficulty tabs');
  click('#t-rank-tabs .mode-tab[data-tab="easy"]');
  ok($$('#t-rank tbody tr').length===3 && !$('#dash-body img') && !$('#dash-body i'),'teacher easy ranking + escaping');
  ok($('#nav-teacher').classList.contains('active'),'teacher menu active on dashboard');
  $('#v-select').value='top3'; click('[data-action=visibility-save]'); await wait(30);
  const lvlOpts=$$('#a-level option').map(o=>o.value);
  ok(lvlOpts.join(',')==='p0,p1,p2,p3,diff' && $$('#a-diffs input[type=checkbox]').length===4,'assignment options: practice Lv.0-3 + difficulty checkboxes');
  const setLevel=v=>{ $('#a-level').value=v; $('#a-level').dispatchEvent(new w.Event('change',{bubbles:true})); };
  const setDiffs=list=>$$('#a-diffs input').forEach(cb=>{ cb.checked=list.includes(cb.value); });
  const checkedDiffs=()=>$$('#a-diffs input').filter(cb=>cb.checked).map(cb=>cb.value).join(',');
  setLevel('diff'); ok($('#a-size').disabled && !$('#a-diffs input').disabled,'difficulty: size disabled, checkboxes enabled');
  setLevel('p2'); ok(!$('#a-size').disabled && $('#a-diffs input').disabled,'practice: size enabled, checkboxes disabled');
  $('#a-on').value='true'; $('#a-size').value='6'; click('[data-action=assign-save]'); await wait(80);
  ok(store[cfgKey].isAssigned===true && store[cfgKey].assignedLevel===2 && store[cfgKey].assignedDifficulties===null,'practice assignment saved');
  click('#btn-switch'); await wait(30);
  click('[data-action=quick-continue]'); await wait(400);
  ok($$('#board .cell').length===36 && $('.play-head .stage-tag').textContent.includes('LV.2'),'assigned Lv.2 6x6 via quick continue');
  ok($$('.mode-tab:disabled').length===4 && !$('.mode-tab[data-mode="practice"]').disabled,'difficulty tabs locked in assigned practice');
  ok($('.assign-note') && $('.assign-note').textContent.includes('연습 Lv.2'),'assigned note names the level');
  // 이미 접속한 학생: 교사가 다른 기기에서 보통+어려움을 열면, 다시 들어오지 않아도 잠긴 탭을 누를 때 확인해 열린다
  Object.assign(store[cfgKey],{assignedLevel:4,assignedDifficulties:['medium','hard']});
  click('.mode-tab[data-mode="hard"]'); await wait(300);
  ok($('.mode-tab.active').dataset.mode==='hard' && $$('#board .cell').length===81 && $$('.mode-tab:disabled').length===3,'assignment change picked up without re-entry (medium+hard open)');
  ok(/보통.*어려움/.test($('.assign-note').textContent),'assigned note lists both difficulties');
  // 사용자 전환 뒤에는 교사도 다시 로그인해야 한다(공용 PC)
  click('#nav-teacher'); await wait(50);
  ok($('#teacher-login-form'),'teacher must log in again after user switch');
  ok($('[data-action=resume-game]'),'teacher login screen offers back-to-game while a puzzle is paused');
  $('#t-class').value='3-2'; $('#t-pass').value='old'; submit('teacher-login-form'); await wait(150);
  ok($('#a-level').value==='diff' && checkedDiffs()==='medium,hard','dashboard shows saved multi-difficulty assignment');
  ok($('#dash-body') && $('[data-action=resume-game]'),'dashboard offers back-to-game');
  setDiffs([]); click('[data-action=assign-save]'); await wait(80);
  ok(store[cfgKey].assignedDifficulties.join()==='medium,hard' && $('#toast').textContent.includes('하나 이상'),'empty difficulty selection rejected');
  setDiffs(['medium']); click('[data-action=assign-save]'); await wait(80);
  ok(store[cfgKey].assignedDifficulties.join()==='medium' && store[cfgKey].assignedDifficulty===null,'single difficulty saved as list');
  store['sessions/inj']={studentName:'=1+1',classroom:'3-2',kind:'free',difficulty:'easy',boardSize:4,durationSec:9,completed:true,finishedAt:'2026-10-02T00:00:00Z'};
  click('[data-action=refresh-dashboard]'); await wait(80);
  click('[data-action=export-csv]'); await wait(50);
  ok(csvSaved && csvSaved.data.includes(`"'=1+1"`) && !csvSaved.data.includes('"=1+1"'),'CSV neutralizes formula-like names');
  click('[data-action=teacher-logout]'); await wait(20);
  ok($('#teacher-login-form'),'logout returns to login form');
  click('#nav-teacher'); await wait(20);
  ok($('#teacher-login-form'),'after logout teacher menu asks for password again');
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  ok($('.mode-tab.active').dataset.mode==='medium' && $$('#board .cell').length===36,'assigned medium → starts 6x6 medium');
  ok($$('.mode-tab:disabled').length===4 && !$('.mode-tab[data-mode="medium"]').disabled,'only the assigned difficulty tab is open');
  ok($('.assign-note').textContent.includes('보통'),'assigned note names the difficulty');
  click('.mode-tab[data-mode="hard"]'); await wait(100);
  ok($('.mode-tab.active').dataset.mode==='medium','locked tab cannot be opened');
  // v0.3 형식(난이도 하나)과 v0.2 형식(assignedLevel 4, 난이도 없음)도 읽는다
  store[cfgKey].assignedDifficulty='expert'; delete store[cfgKey].assignedDifficulties;
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  ok($('.mode-tab.active').dataset.mode==='expert' && $$('.mode-tab:disabled').length===4,'v0.3 single-difficulty config still works');
  delete store[cfgKey].assignedDifficulty;
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  ok($('.mode-tab[data-mode="practice"]').disabled && $$('.mode-tab:disabled').length===1,'legacy Lv.4 config → only practice locked');
  click('#nav-rank'); await wait(100);
  click('.mode-tab[data-tab="overall"]'); await wait(80);
  ok($$('#rank-body tbody tr').length===3,'top3 visibility applied to student ranking');
  click('[data-action=resume-game]'); await wait(50);
  key('ArrowDown'); ok($('.cell.selected'),'arrow key selects a cell when nothing selected');
  // 힌트 무제한 단계(지정된 연습 Lv.1)에서 힌트만으로 채우면 XP가 없다
  Object.assign(store[cfgKey],{assignedLevel:1,assignedBoardSize:4,assignedDifficulties:null});
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  ok($('.play-head .stage-tag').textContent.includes('LV.1') && $$('#board .cell').length===16,'assigned practice Lv.1 4x4');
  const xp0=store['profiles/'+myId].totalXP;
  { const g0=readBoard(); let first=true;
    for(let r=0;r<4;r++)for(let c=0;c<4;c++) if(!g0[r][c]){
      const sel=`#board .cell[data-r="${r}"][data-c="${c}"]`;
      click(sel); click('#btn-hint');
      if(first){ first=false; const v=$(sel).textContent;
        click('[data-action=erase]'); const afterErase=$(sel).textContent;
        click(`#pad button[data-val="${(+v)%4+1}"]`);
        ok(v && afterErase===v && $(sel).textContent===v && $(sel).classList.contains('hinted') && $('#stat-mistakes').textContent==='0','hinted cell cannot be erased or overwritten'); }
    } }
  await wait(100);
  ok($('.result-card') && $('.xp-burst').textContent.trim()==='+0 XP' && store['profiles/'+myId].totalXP===xp0,'hint-only practice earns no XP: '+($('.xp-burst')||{}).textContent);
  store[cfgKey].isAssigned=false;
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  click('.mode-tab[data-mode="practice"]'); await wait(200);
  ok($$('#board .cell').length===16 && $$('.size-switch button').length===3,'practice tab back to 4x4 with size switch');
  click('.size-switch button[data-size="9"]'); await wait(300);
  ok($$('#board .cell').length===81 && store['profiles/'+myId].boardSizePref===9,'practice size switch to 9x9 saved');
  solveOnScreen(); await wait(100);
  ok($('.result-card') && !$('.record-box') && $('[data-action=result-next]'),'practice Lv.2 result: no record box, next-step button');
  click('[data-action=result-next]'); await wait(300);
  ok($('.play-head .stage-tag').textContent.includes('LV.3'),'next step goes to Lv.3');
  solveOnScreen(); await wait(100);
  ok($('.grad') && store['profiles/'+myId].tutorialLevel===4 && $('[data-action=switch-mode][data-mode=easy]'),'Lv.3 completion graduates ladder');
  // 서버 기록을 못 읽으면 입장하지 않는다(빈 프로필로 서버 기록을 덮어쓰지 않게)
  const before=JSON.stringify(store['profiles/'+myId]);
  failGet.add('profiles/'+myId);
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  ok($('#entry-form') && !$('#entry-err').hidden && $('#in-name').value==='김하늘' && !$('#board'),'profile read failure → stays on entry form with error');
  ok(JSON.stringify(store['profiles/'+myId])===before,'profile not overwritten on read failure');
  failGet.delete('profiles/'+myId);
  submit('entry-form'); await wait(400);
  ok($('#board') || $('.result-card') || $('[data-action=rules-next]'),'retry after recovery enters the game');
  store['profiles/'+b64('3-2__공격')]={studentName:'공격',classroom:'3-2',totalXP:'<img src=x onerror=alert(1)>',level:'<img src=x onerror=alert(2)>',streakDays:'<b>9</b>',totalCompleted:'<i>1</i>',tutorialLevel:'2',boardSizePref:'4<x>',avatar:'🐸'};
  click('#btn-switch'); await wait(30); click('[data-action=go-student]');
  $('#in-name').value='공격'; $('#in-class').value='3-2'; submit('entry-form'); await wait(400);
  ok(!$('#topbar img') && /Lv\.1 /.test($('#topbar-info').textContent),'non-numeric profile fields are not rendered as HTML: '+$('#topbar-info').textContent);
  ok($$('#board .cell').length===16 || $('.choice-grid'),'tampered profile still playable (tutorialLevel "2" → 2)');
  ok(!errs.length,'no runtime errors '+errs.join('; '));
  console.log(fails?`${fails} FAILED`:'ALL PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.log('CRASH',e, errs);process.exit(1);});
