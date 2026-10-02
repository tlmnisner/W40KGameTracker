const $=s=>document.querySelector(s);
const MAX_ROUNDS=5;
let finKey=null,finVal=true;
const localDone=new Set((()=>{try{return JSON.parse(localStorage.getItem('gt_done')||'[]')}catch(e){return[]}})());
const saveDone=()=>{try{localStorage.setItem('gt_done',JSON.stringify([...localDone]))}catch(e){}};
function isDone(g){return finKey?(g[finKey]===finVal):localDone.has(g.id)}
const state={games:[],sel:null,editGame:null,editRound:null,results:false,finId:null};
const base=()=>{try{localStorage.setItem('gt_base',$('#base').value)}catch(e){};return $('#base').value.replace(/\/+$/,'')};
try{const b=localStorage.getItem('gt_base');if(b)$('#base').value=b}catch(e){}

function toast(m,err){const t=$('#toast');t.textContent=m;t.className=err?'err':'';t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3500)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function api(method,path,body){
  let r;
  try{r=await fetch(base()+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined})}
  catch(e){throw new Error("Can't reach the API at "+base()+". Check that the server is running and allows CORS from this page.")}
  if(r.status===204)return null;
  const txt=await r.text();let data=null;try{data=txt?JSON.parse(txt):null}catch(e){data=txt}
  if(!r.ok){
    const d=data&&data.detail;
    const msg=Array.isArray(d)?d.map(x=>(x.loc||[]).join('.')+': '+x.msg).join('; '):(d||r.statusText);
    throw new Error(`${r.status} ${msg}`)
  }
  return data
}
const guard=fn=>async(...a)=>{try{await fn(...a)}catch(e){toast(e.message,true)}};

const loadGames=guard(async()=>{await loadSchema();state.games=await api('GET','/games/');renderList();if(state.sel)await openGame(state.sel,true)});
const openGame=guard(async(id,quiet)=>{
  try{const g=await api('GET','/games/'+id);state.sel=id;const i=state.games.findIndex(x=>x.id===id);if(i>=0)state.games[i]=g;renderList();renderGame(g)}
  catch(e){if(quiet){state.sel=null;renderMain()}throw e}
});

function renderList(){
  const el=$('#list');
  if(!state.games.length){el.innerHTML='<p class="meta" style="padding:8px 12px">No games yet.</p>';return}
  el.innerHTML=state.games.map(g=>`<button class="game ${g.id===state.sel?'on':''}" data-id="${esc(g.id)}"><b>${esc(g.title)}</b><small>${esc(g.player_one_name)} vs ${esc(g.player_two_name)} &middot; ${(g.rounds||[]).length}/${MAX_ROUNDS} rounds${isDone(g)?' &middot; finished':''}</small></button>`).join('');
}
function renderMain(){
  $('#main').innerHTML=`<div class="empty"><h2>${state.games.length?'Pick a game':'Start your first game'}</h2><p>${state.games.length?'Choose a game on the left to see its rounds.':'Create a game with two players, then add rounds as you play.'}</p></div>`;
}
const roundKey=(r,i)=>r.id??r.round_id??r.round??r.round_number??r.number??(i+1);
const HIDE=['id','game_id','created_at'];
const nice=k=>k.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const side=k=>/(player_?one|\bp1\b|_1$|_one\b)/i.test(k)?1:/(player_?two|\bp2\b|_2$|_two\b)/i.test(k)?2:0;
function label(k,g){const sd=side(k);let t=nice(k);if(sd){t=t.replace(/player ?(one|two)|\bp[12]\b|\b(one|two)\b|\s*[12]$/ig,'').trim()||t;t=t[0].toUpperCase()+t.slice(1);return (sd===1?g.player_one_name:g.player_two_name)+': '+t}return t}
function totals(g){
  const T={1:{p:0,s:0},2:{p:0,s:0}};let found=false;
  (g.rounds||[]).forEach(r=>Object.entries(r).forEach(([k,v])=>{const sd=side(k);if(!sd||typeof v!=='number')return;
    if(/primary/i.test(k)){T[sd].p+=v;found=true}else if(/secondary/i.test(k)){T[sd].s+=v;found=true}}));
  return found?T:null}
const pts=(r,sd,kind)=>Object.entries(r).reduce((a,[k,v])=>a+(side(k)===sd&&typeof v==='number'&&new RegExp(kind,'i').test(k)?v:0),0);
function renderGame(g){
  if(state.results&&isDone(g))return renderResults(g);
  state.results=false;
  const rounds=g.rounds||[],done=isDone(g),full=rounds.length>=MAX_ROUNDS;
  const cols=[...new Set(rounds.flatMap(r=>Object.keys(r)))].filter(c=>!HIDE.includes(c));
  const fmt=v=>typeof v==='object'&&v!==null?JSON.stringify(v):v;
  const T=totals(g);
  const sc=n=>T?`<span class="score"><b>${T[n].p+T[n].s}</b><small>Primary ${T[n].p} / Secondary ${T[n].s}</small></span>`:'';
  const acts=done?'<button class="primary" id="viewRes">View results</button>':`<button id="finish">Finish game</button> <button class="primary" id="addRound" ${full?'disabled':''}>${full?'Round limit reached':'Add round'}</button>`;
  $('#main').innerHTML=`
  <div class="head"><div><h2>${esc(g.title)}</h2>${g.game_description?`<p>${esc(g.game_description)}</p>`:''}</div>
    <div><button id="editGame">Edit game</button> <button class="danger" id="delGame">Delete</button></div></div>
  <div class="vs"><span class="a">${esc(g.player_one_name)}${sc(1)}</span><i>vs</i><span class="b">${esc(g.player_two_name)}${sc(2)}</span></div>
  <div class="meta">Created ${g.created_at?new Date(g.created_at).toLocaleString():''}${done?' &middot; Finished':''}</div>
  <div class="sec"><h3>Rounds ${rounds.length}/${MAX_ROUNDS}</h3><div class="acts">${acts}</div></div>
  ${rounds.length?`<div class="tbl"><table><thead><tr>${cols.map(c=>`<th>${esc(label(c,g))}</th>`).join('')}${done?'':'<th></th>'}</tr></thead><tbody>
    ${rounds.map((r,i)=>`<tr>${cols.map(c=>`<td>${esc(fmt(r[c]))}</td>`).join('')}${done?'':`<td class="act"><button class="link" data-edit="${i}">Edit</button><button class="link" data-del="${i}">Delete</button></td>`}</tr>`).join('')}
  </tbody></table></div>`:'<p class="meta">No rounds yet. Add the first one to start scoring.</p>'}`;
}
function renderResults(g){
  const T=totals(g),rounds=g.rounds||[],n1=g.player_one_name,n2=g.player_two_name;
  const t=n=>T?T[n].p+T[n].s:0;
  const win=t(1)>t(2)?n1:t(2)>t(1)?n2:null;
  const card=(n,cls,name)=>`<div class="rc ${cls}"><h3>${esc(name)}</h3><div class="big">${t(n)}</div><div>Primary ${T[n].p} / Secondary ${T[n].s}</div></div>`;
  const reopen=(!finKey||finVal===true)?'<button id="reopen">Reopen game</button>':'';
  $('#main').innerHTML=`
  <div class="head"><div><h2>Results</h2><p>${esc(g.title)} &middot; ${rounds.length} of ${MAX_ROUNDS} rounds played</p></div>
    <div><button id="backGame">Back to game</button> ${reopen}</div></div>
  ${T?`<div class="win" style="margin-top:24px"><small>${win?'Winner':'Result'}</small><h2>${win?esc(win):'Draw'}</h2></div>
  <div class="rcs">${card(1,'a',n1)}${card(2,'b',n2)}</div>`:'<p class="meta" style="margin-top:24px">Scores could not be totaled because the point fields were not recognized.</p>'}
  <div class="sec"><h3>Round by round</h3></div>
  ${rounds.length?`<div class="tbl"><table><thead><tr><th>Round</th><th>${esc(n1)}: Primary</th><th>${esc(n1)}: Secondary</th><th>${esc(n2)}: Primary</th><th>${esc(n2)}: Secondary</th></tr></thead><tbody>
  ${rounds.map((r,i)=>`<tr><td>${i+1}</td><td>${pts(r,1,'primary')}</td><td>${pts(r,1,'secondary')}</td><td>${pts(r,2,'primary')}</td><td>${pts(r,2,'secondary')}</td></tr>`).join('')}
  </tbody></table></div>`:'<p class="meta">No rounds were played.</p>'}`;
}
const finishGame=guard(async g=>{
  if(finKey)await api('PATCH','/games/'+g.id,{title:g.title,game_description:g.game_description,player_one_name:g.player_one_name,player_two_name:g.player_two_name,[finKey]:finVal});
  else{localDone.add(g.id);saveDone()}
  state.results=true;await openGame(g.id);
});
function openFinish(g){
  const n=(g.rounds||[]).length;
  if(n>=MAX_ROUNDS)return finishGame(g);
  $('#finMsg').textContent=`Only ${n} of ${MAX_ROUNDS} rounds have been played. Finish the game anyway and show the results?`;
  state.finId=g.id;$('#finDlg').showModal();
}

/* game dialog */
function openGameDlg(g){
  state.editGame=g||null;
  $('#gameTitle').textContent=g?'Edit game':'New game';
  $('#g_title').value=g?.title||'';$('#g_desc').value=g?.game_description||'';
  $('#g_p1').value=g?.player_one_name||'';$('#g_p2').value=g?.player_two_name||'';
  $('#gameDlg').showModal();
}
$('#gameForm').addEventListener('submit',guard(async e=>{
  const body={title:$('#g_title').value.trim(),game_description:$('#g_desc').value.trim(),player_one_name:$('#g_p1').value.trim(),player_two_name:$('#g_p2').value.trim()};
  if(state.editGame){await api('PATCH','/games/'+state.editGame.id,body);toast('Game saved')}
  else{const g=await api('POST','/games/',body);state.sel=g.id;toast('Game created')}
  await loadGames();
}));

/* round dialog */
let schema=null,schemaU=null;
const ptype=p=>p.type||(p.anyOf||[]).map(x=>x.type).find(t=>t&&t!=='null');
const loadSchema=async()=>{try{
  const o=await api('GET','/openapi.json'),c=o.components?.schemas||{};
  schema=c.RoundCreate||null;schemaU=c.RoundUpdate&&c.RoundUpdate.properties?c.RoundUpdate:null;
  finKey=null;finVal=true;
  for(const[k,p]of Object.entries(c.GameUpdate?.properties||{})){
    if(!/finish|complet|ended|closed|done|status/i.test(k))continue;
    if(ptype(p)==='boolean'){finKey=k;finVal=true;break}
    const e=(p.enum||[]).find(x=>/finish|complet|done|end|closed/i.test(x));if(e){finKey=k;finVal=e;break}}
}catch(e){schema=null;schemaU=null}};
const fields=()=>{const sc=state.editRound!=null&&schemaU?schemaU:schema;return sc&&sc.properties?Object.entries(sc.properties).filter(([k])=>!HIDE.includes(k)):[]};
const short=k=>{const t=nice(k).replace(/player ?(one|two)|\bp[12]\b|\b(one|two)\b|\s*[12]$/ig,'').trim()||nice(k);return t[0].toUpperCase()+t.slice(1)};
function mk([k,p],cur,lab){
  const t=ptype(p),num=t==='integer'||t==='number';
  const v=cur[k]??p.default??(num?0:'');
  if(t==='boolean')return `<label class="chk"><input type="checkbox" data-k="${k}" ${v?'checked':''}> ${esc(lab)}</label>`;
  const long=!num&&/desc|note|comment|detail/i.test(k);
  const inp=long?`<textarea id="f_${k}" data-k="${k}" data-t="${t}" rows="3">${esc(v)}</textarea>`:`<input id="f_${k}" data-k="${k}" data-t="${t}" type="${num?'number':'text'}" ${t==='integer'?'step="1" inputmode="numeric"':''} value="${esc(v)}">`;
  return `<div class="fld${num?'':' wide'}"><label for="f_${k}">${esc(lab)}</label>${inp}</div>`}
const sumPanels=()=>document.querySelectorAll('#r_fields .pl').forEach(pl=>{pl.querySelector('.sub b').textContent=[...pl.querySelectorAll('input[type=number]')].reduce((a,el)=>a+(parseFloat(el.value)||0),0)});
const ROUND_MAX=15,GAME_MAX=45;
const capped=k=>side(k)&&/primary|secondary/i.test(k);
const usedPts=(g,k,i)=>(g.rounds||[]).reduce((a,r,j)=>a+(j===i||typeof r[k]!=='number'?0:r[k]),0);
const allow=(g,k,i)=>Math.max(0,Math.min(ROUND_MAX,GAME_MAX-usedPts(g,k,i)));
$('#r_fields').addEventListener('input',e=>{
  const el=e.target;if(el.dataset.max===undefined||el.value==='')return;
  const mx=+el.dataset.max;let v=Math.floor(parseFloat(el.value));
  if(isNaN(v)||v<0)v=0;
  if(v>mx){v=mx;const n=el.parentElement.querySelector('.cap');n.classList.add('hit');
    n.textContent=`Capped at ${mx}: ${mx<ROUND_MAX?GAME_MAX+'-point game limit':ROUND_MAX+'-point round limit'}`;
    clearTimeout(n.h);n.h=setTimeout(()=>{n.classList.remove('hit');n.textContent=n.dataset.def},2500)}
  el.value=v});
$('#r_fields').addEventListener('input',sumPanels);
function openRoundDlg(i){
  const g=state.games.find(x=>x.id===state.sel);
  if(i==null&&(g.rounds||[]).length>=MAX_ROUNDS){toast('A game has at most '+MAX_ROUNDS+' rounds',true);return}
  state.editRound=i==null?null:i;
  $('#roundTitle').textContent=i==null?'Add round':'Edit round';
  const cur=i==null?{}:g.rounds[i];
  const f=fields().sort((a,b)=>side(a[0])-side(b[0]));
  $('#r_fields').style.display=f.length?'block':'none';
  $('#r_jsonwrap').style.display=f.length?'none':'block';
  if(f.length){
    const byP=(x,y)=>(/primary/i.test(y[0])?1:0)-(/primary/i.test(x[0])?1:0);
    const top=f.filter(x=>!side(x[0])),p1=f.filter(x=>side(x[0])===1).sort(byP),p2=f.filter(x=>side(x[0])===2).sort(byP);
    const panel=(n,cls,arr)=>arr.length?`<section class="pl ${cls}"><h4>${esc(n)}</h4>${arr.map(x=>mk(x,cur,short(x[0]))).join('')}<div class="sub">Round total <b>0</b></div></section>`:'';
    $('#r_fields').innerHTML=(top.length?`<div class="r-top">${top.map(x=>mk(x,cur,label(x[0],g))).join('')}</div>`:'')+`<div class="r-sides">${panel(g.player_one_name,'a',p1)}${panel(g.player_two_name,'b',p2)}</div>`;
    document.querySelectorAll('#r_fields input[type=number]').forEach(el=>{
      const k=el.dataset.k;if(!capped(k))return;
      const idx=i==null?-1:i,mx=allow(g,k,idx),used=usedPts(g,k,idx);
      el.dataset.max=mx;el.min=0;el.max=mx;
      const def=`0 to ${mx} (game total ${used}/${GAME_MAX})`;
      el.insertAdjacentHTML('afterend',`<small class="cap" data-def="${def}">${def}</small>`);
      if(+el.value>mx)el.value=mx});
    sumPanels();
  }else{
    let seed={};
    if(i!=null){seed={...cur};['id','game_id','created_at'].forEach(k=>delete seed[k])}
    $('#r_json').value=JSON.stringify(seed,null,2);
  }
  $('#roundDlg').showModal();
}
$('#roundForm').addEventListener('submit',e=>{
  let body;
  if(fields().length){
    body={};
    document.querySelectorAll('#r_fields [data-k]').forEach(el=>{const k=el.dataset.k,t=el.dataset.t;
      if(el.type==='checkbox')body[k]=el.checked;
      else if(t==='integer')body[k]=parseInt(el.value||0,10);
      else if(t==='number')body[k]=parseFloat(el.value||0);
      else body[k]=el.value});
  }else{try{body=JSON.parse($('#r_json').value)}catch(x){e.preventDefault();toast('Round data is not valid JSON',true);return}}
  guard(async()=>{
    const g=state.games.find(x=>x.id===state.sel);
    if(state.editRound==null&&(g.rounds||[]).length>=MAX_ROUNDS)throw new Error('A game has at most '+MAX_ROUNDS+' rounds');
    for(const k in body){if(capped(k)&&typeof body[k]==='number')body[k]=Math.max(0,Math.min(Math.floor(body[k]),allow(g,k,state.editRound==null?-1:state.editRound)))}
    if(state.editRound==null){await api('POST',`/rounds/${g.id}/`,body);toast('Round added')}
    else{const key=roundKey(g.rounds[state.editRound],state.editRound);await api('PATCH',`/rounds/${g.id}/${key}`,body);toast('Round saved')}
    await openGame(g.id);
  })();
});

/* events */
$('#list').addEventListener('click',e=>{const b=e.target.closest('.game');if(b)openGame(b.dataset.id)});
$('#main').addEventListener('click',guard(async e=>{
  const g=state.games.find(x=>x.id===state.sel);if(!g)return;
  const t=e.target.closest('button');if(!t)return;
  if(t.id==='finish')openFinish(g);
  else if(t.id==='viewRes'){state.results=true;renderGame(g)}
  else if(t.id==='backGame'){state.results=false;renderGame(g)}
  else if(t.id==='reopen'){if(finKey)await api('PATCH','/games/'+g.id,{title:g.title,game_description:g.game_description,player_one_name:g.player_one_name,player_two_name:g.player_two_name,[finKey]:false});else{localDone.delete(g.id);saveDone()}state.results=false;await openGame(g.id)}
  else if(t.id==='editGame')openGameDlg(g);
  else if(t.id==='addRound')openRoundDlg();
  else if(t.id==='delGame'){if(confirm(`Delete "${g.title}" and all its rounds?`)){await api('DELETE','/games/'+g.id);state.sel=null;toast('Game deleted');await loadGames();renderMain()}}
  else if(t.dataset.edit!=null)openRoundDlg(+t.dataset.edit);
  else if(t.dataset.del!=null){const i=+t.dataset.del;if(confirm('Delete this round?')){await api('DELETE',`/rounds/${g.id}/${roundKey(g.rounds[i],i)}`);toast('Round deleted');await openGame(g.id)}}
}));
$('#finDlg form').addEventListener('submit',()=>{const g=state.games.find(x=>x.id===state.finId);if(g)finishGame(g)});
$('#newGame').onclick=()=>openGameDlg();
$('#reload').onclick=loadGames;
$('#base').addEventListener('keydown',e=>{if(e.key==='Enter')loadGames()});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

renderMain();loadGames();