// Claude 아티팩트 저장소(가짜 window.claude db)로 앱 전체 흐름을 jsdom에서 시뮬레이션한다: npm run test:app
const {JSDOM}=require('jsdom'); const fs=require('fs'); const {webcrypto}=require('crypto');
function deepFreeze(o){ if(o&&typeof o==='object'){ Object.values(o).forEach(deepFreeze); Object.freeze(o);} return o; }
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','index.html'),'utf8');
const store={};
const clone=x=>JSON.parse(JSON.stringify(x));
function mkdb(){
  const doc=p=>({get:async()=>({exists:p in store,data:()=>deepFreeze(clone(store[p]))}),
    set:async d=>{store[p]=clone(d);}, update:async d=>{store[p]=Object.assign(store[p]||{},clone(d));}});
  const coll=n=>({add:async d=>{store[n+'/'+Math.random().toString(36).slice(2)]=clone(d);},
    where:(f,op,v)=>({get:async()=>({docs:Object.keys(store).filter(k=>k.split('/')[0]===n&&k.split('/').length===2&&store[k][f]===v).map(k=>({id:k,data:()=>deepFreeze(clone(store[k]))}))})})});
  return {doc,collection:coll};
}
const b64=s=>Buffer.from(s).toString('base64').replace(/\//g,'_').replace(/=+$/,'');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://claude.ai/x',
  beforeParse(w){ w.claude={use:n=>new Promise(r=>setTimeout(()=>r(n==='db'?mkdb():null),300))};
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
  store['profiles/'+b64('3-2__빠른이')]={studentName:'빠른이',classroom:'3-2',totalXP:900,level:3,avatar:'🐼',bests:{easy:{score:5,sec:5,mistakes:0,hints:0,at:'2026-09-30T00:00:00Z'}}};
  store['profiles/'+b64('3-2__느린이')]={studentName:'느린이',classroom:'3-2',totalXP:100,level:1,avatar:'🐯',bests:{easy:{score:99999,sec:99999,mistakes:0,hints:0,at:'2026-09-30T00:00:00Z'}}};
  store['profiles/'+b64('3-2__x')]={studentName:'<img src=x onerror=alert(1)>',classroom:'3-2',totalXP:50,avatar:'<b>bad</b>',bests:{easy:{score:'<i>1</i>',sec:5,at:'<script>'}}};
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
  ok($$('#board .cell').length===81 && $('.mode-tab.active').dataset.mode==='easy','switch to easy without confirm when no moves');
  await wait(50);
  ok($('#side-rank').textContent.includes('TOP 5') && $('#side-rank').textContent.includes('빠른이'),'side panel shows easy TOP 5');
  ok(!$('#side-rank').textContent.includes('<img'),'record with non-numeric score excluded from difficulty ranking');
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
  ok($('#stat-mistakes').textContent==='1' && $$('#board .cell').length===81,'resume keeps puzzle state');
  solveOnScreen(); await wait(100);
  ok($('.result-card'),'completion → result screen');
  ok($('.record-box') && $('.newbest') && $('.newbest').textContent.includes('첫 기록'),'record box with first-record message');
  ok($$('.star.on').length===2,'stars computed (1 mistake → 2 stars)');
  await wait(100);
  ok(/2위/.test($('#result-rank').textContent),'result shows class rank: '+$('#result-rank').textContent);
  const saved=store['profiles/'+myId];
  ok(saved.bests && saved.bests.easy && saved.bests.easy.mistakes===1 && saved.lastMode==='easy' && saved.totalXP>500,'best record, lastMode, XP saved');
  const sess=Object.keys(store).filter(k=>k.startsWith('sessions/')).map(k=>store[k]);
  ok(sess.length===1 && sess[0].stars===2 && sess[0].recordScore===saved.bests.easy.score,'session doc has stars/recordScore');
  click('[data-action=show-ranking]'); await wait(80);
  const names=$$('#rank-body tbody tr').map(tr=>tr.children[1].textContent.trim());
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
  $('#a-on').value='true'; $('#a-size').value='6'; $('#a-level').value='2'; click('[data-action=assign-save]'); await wait(80);
  ok(store[cfgKey].isAssigned===true && store[cfgKey].assignedLevel===2,'assignment saved');
  click('#btn-switch'); await wait(30);
  click('[data-action=quick-continue]'); await wait(400);
  ok($$('#board .cell').length===36 && $('.play-head .stage-tag').textContent.includes('LV.2'),'assigned Lv.2 6x6 via quick continue');
  ok($$('.mode-tab:disabled').length===4 && !$('.mode-tab[data-mode="practice"]').disabled,'difficulty tabs locked in assigned practice');
  ok($('.assign-note'),'assigned note shown');
  store[cfgKey].assignedLevel=4;
  click('#btn-switch'); await wait(30); click('[data-action=quick-continue]'); await wait(400);
  ok($('.mode-tab[data-mode="practice"]').disabled && $$('.mode-tab:disabled').length===1 && $$('#board .cell').length===81,'assigned Lv.4 → only practice locked, starts 9x9');
  click('#nav-rank'); await wait(100);
  click('.mode-tab[data-tab="overall"]'); await wait(80);
  ok($$('#rank-body tbody tr').length===3,'top3 visibility applied to student ranking');
  click('[data-action=resume-game]'); await wait(50);
  key('ArrowDown'); ok($('.cell.selected'),'arrow key selects a cell when nothing selected');
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
  ok(!errs.length,'no runtime errors '+errs.join('; '));
  console.log(fails?`${fails} FAILED`:'ALL PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.log('CRASH',e, errs);process.exit(1);});
