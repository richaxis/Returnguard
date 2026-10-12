import { makeConfig, connectWallet, disconnectWallet, makeClient, read, write, toWei, fromWei, short } from '../../lib/chain.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const cfg = makeConfig(import.meta.env);
let account = '';
let client = null;
let activeStatus = 'all';
let categoryFilter = 'all';
let cases = [];
const categoryNames = {electronics:'Electronics',fashion:'Fashion',home:'Home & living',beauty:'Beauty',services:'Digital services'};
const statusInfo = {
 open:['Needs review','review'], challenged:['In resolution','disputed'], refund_supported:['Refund supported',''], refund_denied:['Refund denied','closed'], refunded_both:['Both bonds returned','closed'], cancelled:['Cancelled','closed'],
 inconclusive:['Inconclusive','closed']
};
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function statusTag(status){const [label,cls]=statusInfo[status]||['Open','review'];return `<span class="status ${cls}">${label}</span>`;}
function iconFor(c){return ({electronics:'⌁',fashion:'✳',home:'⌂',beauty:'✦',services:'▱'})[c]||'r✓';}
function caseCard(c){return `<article class="live-case-card" data-case="${esc(c.id)}"><div class="sample-top"><span class="store-avatar">${esc(c.initial||iconFor(c.category))}</span>${statusTag(c.status)}</div><h3>${esc(c.title)}</h3><p>${esc(c.claim)}</p><div class="sample-foot"><div><small>${esc(c.store||'On-chain case')} · ${esc(c.time||'Just now')}</small></div><b>${esc(c.amount||'Evidence record')}</b></div></article>`;}
function rowCard(c){return `<article class="case-row" data-case="${esc(c.id)}"><span class="store-avatar">${esc(c.initial||iconFor(c.category))}</span><div><h3>${esc(c.title)}</h3><p>${esc(c.claim)}</p><div class="case-meta"><span>${esc(c.store||'Your case')}</span><span>${esc(categoryNames[c.category]||'General')}</span><span>${esc(c.time||'Just now')}</span></div></div><div class="case-value">${esc(c.amount||'—')}<small>${statusTag(c.status)}</small><button class="btn btn-outline" data-details="${esc(c.id)}">View case</button></div></article>`;}
function render(){
 const featured=$('#featured-cases'); if(featured) featured.innerHTML=cases.length
  ? cases.slice(0,3).map(caseCard).join('')
  : '<div class="empty-state full-width"><strong>No live refund cases yet</strong><p>Connect your wallet and publish the first case on GenLayer Studio Next.</p></div>';
 const q=($('#search')?.value||'').toLowerCase();
 let filtered=cases.filter(c=>categoryFilter==='all'||c.category===categoryFilter).filter(c=>activeStatus==='all'||(activeStatus==='open'?c.status==='open':activeStatus==='challenged'?c.status==='challenged':['refund_supported','refund_denied','refunded_both','cancelled','inconclusive'].includes(c.status))).filter(c=>`${c.title} ${c.store} ${c.id} ${c.claim}`.toLowerCase().includes(q));
 if($('#sort')?.value==='value') filtered.sort((a,b)=>parseFloat(b.amount||'0')-parseFloat(a.amount||'0'));
 const list=$('#all-cases'); if(list) list.innerHTML=filtered.length?filtered.map(rowCard).join(''):'<div class="empty-state">No cases match those filters yet. Try another search or start a new case.</div>';
 const recent=$('#dashboard-cases'); if(recent) recent.innerHTML=cases.length
  ? cases.slice(0,4).map(c=>`<div class="dashboard-case"><span class="store-avatar">${esc(c.initial||iconFor(c.category))}</span><div><b>${esc(c.title)}</b><small>On-chain claim #${esc(c.id)}</small></div>${statusTag(c.status)}</div>`).join('')
  : '<div class="empty-state"><strong>No on-chain cases yet</strong><p>Cases appear here after a successful Studio Next transaction.</p></div>';
 const countOpen=cases.filter(c=>['open','challenged'].includes(c.status)).length;
 $('#stat-total') && ($('#stat-total').textContent=String(cases.length).padStart(2,'0'));
 $('#stat-open') && ($('#stat-open').textContent=String(countOpen).padStart(2,'0'));
 $('#stat-resolved') && ($('#stat-resolved').textContent=String(cases.length-countOpen).padStart(2,'0'));
}
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3500);}
function page(name){const known=['home','claims','dashboard','how'];if(!known.includes(name))name='home';$$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));$$('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===name));window.scrollTo({top:0,behavior:'smooth'});if(name==='claims')render();}
function openModal(){ $('#modal').hidden=false; document.body.style.overflow='hidden'; setTimeout(()=>$('#case-title').focus(),40); }
function closeModal(){ $('#modal').hidden=true;document.body.style.overflow=''; }
function detail(id){
 const c=cases.find(x=>String(x.id)===String(id));if(!c)return;window.activeCase=c;
 $('#detail-id').textContent=`· ${c.id}`;$('#detail-title').textContent=c.title;$('#detail-status').innerHTML=statusTag(c.status);
 $('#detail-claim').textContent=c.claim||'No claim details provided.';$('#detail-quote').textContent=c.quote?`“${c.quote}”`:'No policy quote is available in this preview.';
 $('#detail-quote-hash').textContent=c.quoteHash||'Stored on-chain when published';$('#detail-excerpt').textContent=c.excerpt||'Evidence snapshot will appear after a successful on-chain resolution.';
 $('#detail-evidence-hash').textContent=c.evidenceHash||'Not yet recorded';$('#detail-url').href=c.url||'#';$('#detail-url').style.display=c.url?'inline-block':'none';
 const actions=$('#detail-actions');let html='';
 if(!/^\d+$/.test(String(c.id))) html='<span class="form-note">Only claims published on-chain can be acted on.</span>';
 else if(!cfg.address||!client||!account) html='<button class="btn btn-primary" data-detail-connect>Connect wallet to take action</button>';
 else {
  const mine=String(account).toLowerCase()===String(c.author||'').toLowerCase();
  if(c.status==='open'&&mine)html+='<button class="btn btn-outline" data-case-action="cancel">Cancel & return bond</button>';
  if(c.status==='open'&&!mine)html+='<button class="btn btn-primary" data-case-action="challenge">Challenge with matching bond</button>';
  if(c.status==='challenged')html+='<button class="btn btn-primary" data-case-action="resolve">Resolve with GenLayer</button><button class="btn btn-outline" data-case-action="request_refund">Request mutual bond return</button>';
  if(!html)html='<span class="form-note">No further actions are available for this case.</span>';
 }
 actions.innerHTML=html;$('#detail-modal').hidden=false;document.body.style.overflow='hidden';
}
async function refreshChain(){if(!cfg.address||!client)return;try{const count=Number(await read(client,cfg,'get_claim_count'));const onchain=[];for(let id=0;id<count;id++){try{const rec=JSON.parse(await read(client,cfg,'get_claim',[id]));onchain.push({id:`${id}`,title:rec.title,claim:rec.claim,quote:rec.quote,quoteHash:rec.quote_hash,url:rec.url,bond:fromWei(rec.bond),status:rec.status,verdict:rec.verdict,excerpt:rec.evidence_excerpt,evidenceHash:rec.evidence_hash,category:'electronics',initial:'R',store:'On-chain case',time:'On-chain',amount:`${fromWei(rec.bond)} GEN`,sample:false,author:rec.author});}catch{}}
 cases=onchain;render();}catch(e){console.warn('Could not load chain claims',e);}}
function updateWalletUI(){
 const label=account?`${short(account)} · Disconnect`:'Connect wallet';
 $('#connect').textContent=label;
 $('#dashboard-connect').textContent=account?'Disconnect wallet':'Connect wallet';
 $('#wallet-short').textContent=account?short(account):'Not connected';
 $('#wallet-short').title=account||'';
}
async function disconnect(){
 try { await disconnectWallet(); } finally {
  account=''; client=cfg.address?makeClient(cfg):null; updateWalletUI();
  $('#stat-balance').innerHTML='0 <i>GEN</i>';
  $('#withdraw-bond').disabled=true;
  render(); if(client) await refreshChain();
  toast('Disconnected from ReturnGuard. Your wallet may still remember this site.');
 }
}
async function connect(){
 if(account){await disconnect();return;}
 try{
  account=await connectWallet(cfg);
  client=makeClient(cfg,account);
  updateWalletUI();
  toast('Wallet connected to Studio Next');
  await refreshChain(); await refreshCredit();
 }catch(e){account='';client=null;updateWalletUI();toast(e.message||'Wallet connection failed');}
}
if(window.ethereum?.on){
 window.ethereum.on('accountsChanged', async (accounts)=>{
  if(!accounts?.length){account='';client=cfg.address?makeClient(cfg):null;updateWalletUI();render();$('#withdraw-bond').disabled=true;if(client)await refreshChain();return;}
  account=accounts[0];client=makeClient(cfg,account);updateWalletUI();await refreshChain();await refreshCredit();
 });
 window.ethereum.on('chainChanged', async ()=>{
  try{const chain=await window.ethereum.request({method:'eth_chainId'});if(Number(chain)!==cfg.chainId){toast('Please switch your wallet back to GenLayer Studio Next.');}}
  catch{}
 });
}
async function refreshCredit(){if(!cfg.address||!client||!account)return;try{const credit=await read(client,cfg,'get_credit',[account]);$('#stat-balance').innerHTML=`${fromWei(credit,4)} <i>GEN</i>`;$('#withdraw-bond').disabled=BigInt(credit)===0n;}catch(e){console.warn('Could not read credit',e);}}
$('#withdraw-bond').addEventListener('click',async()=>{if(!client||!account||!cfg.address){toast('Connect a wallet and configure the deployed contract first.');return;}const btn=$('#withdraw-bond');btn.disabled=true;btn.textContent='Waiting for transaction…';try{const result=await write(client,cfg,'withdraw');toast(`Withdrawal submitted · ${result.hash.slice(0,10)}…`);await refreshCredit();}catch(e){toast(e.message||'Withdrawal failed');}finally{btn.textContent='Withdraw available bond';await refreshCredit();}});
$('#connect').addEventListener('click',connect);$('#dashboard-connect').addEventListener('click',connect);
$('#notifications').addEventListener('click',()=>toast('You’re all caught up.'));
$$('[data-page]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();page(el.dataset.page);history.replaceState(null,'',`#${el.dataset.page}`);}));
$$('[data-go]').forEach(el=>el.addEventListener('click',()=>page(el.dataset.go)));
$$('[data-open="newcase"]').forEach(el=>el.addEventListener('click',openModal));
$('#modal-close').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal();});
function closeDetail(){ $('#detail-modal').hidden=true;document.body.style.overflow=''; }
$('#detail-close').addEventListener('click',closeDetail);$('#detail-modal').addEventListener('click',e=>{if(e.target===$('#detail-modal'))closeDetail();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeDetail();}});
$$('[data-category]').forEach(el=>el.addEventListener('click',()=>{categoryFilter=el.dataset.category;page('claims');render();}));
$$('[data-filter]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();categoryFilter=el.dataset.filter;page('claims');$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===el));render();}));
$$('[data-status]').forEach(el=>el.addEventListener('click',()=>{activeStatus=el.dataset.status;$$('[data-status]').forEach(x=>x.classList.toggle('active',x===el));render();}));
$('#search').addEventListener('input',render);$('#sort').addEventListener('change',render);
document.addEventListener('click',e=>{const det=e.target.closest('[data-details]');if(det){e.stopPropagation();detail(det.dataset.details);return;}const card=e.target.closest('[data-case]');if(card)detail(card.dataset.case);});
$('#detail-actions').addEventListener('click',async e=>{
 const connectBtn=e.target.closest('[data-detail-connect]');if(connectBtn){await connect();if(window.activeCase)detail(window.activeCase.id);return;}
 const btn=e.target.closest('[data-case-action]');if(!btn||!window.activeCase)return;const c=window.activeCase,act=btn.dataset.caseAction;btn.disabled=true;const old=btn.textContent;btn.textContent='Waiting for transaction…';
 const method=act==='request_refund'?'request_refund':act;const args=[Number(c.id)];let value=0n;
 try{if(act==='challenge')value=toWei(c.bond);const result=await write(client,cfg,method,args,value);toast(`${act.replace('_',' ')} submitted · ${result.hash.slice(0,10)}…`);closeDetail();await refreshChain();}
 catch(err){toast(err.message||'Transaction failed');}finally{btn.disabled=false;btn.textContent=old;}
});
$('#case-form').addEventListener('submit',async e=>{e.preventDefault();const title=$('#case-title').value.trim(),claim=$('#case-claim').value.trim(),quote=$('#case-quote').value.trim(),url=$('#case-url').value.trim(),bond=$('#case-bond').value.trim();if(!url.startsWith('https://')){toast('Use a public HTTPS policy or evidence URL.');return;}if(claim.length<20||quote.length<8){toast('Add a little more detail and the exact policy quote.');return;}const submit=e.submitter;submit.disabled=true;submit.textContent='Waiting for wallet…';try{
 if(!cfg.address) throw new Error('The contract address is not configured. Set VITE_CONTRACT_ADDRESS in Vercel after deploying ReturnGuard.');
 if(!account||!client) throw new Error('Connect your wallet first. Your wallet will ask you to approve and sign the GEN transaction.');
 if(cfg.address&&account&&client){const tx=await write(client,cfg,'create_claim',[title,claim,quote,url],toWei(bond));toast(`Case submitted · ${tx.hash.slice(0,10)}…`);closeModal();e.target.reset();await refreshChain();page('claims');}
 else {throw new Error('Connect a wallet and configure the deployed ReturnGuard contract before creating a case. No local cases are saved.');}
 }catch(err){toast(err.message||'Could not create case');}finally{submit.disabled=false;submit.innerHTML='Create refund case <span>↗</span>';}});
client=cfg.address?makeClient(cfg):null;updateWalletUI();$('#footer-address').textContent=cfg.address||'Not deployed';$('#contract-short').textContent=cfg.address?short(cfg.address):'Not deployed';
if(cfg.address){$('#footer-address').textContent=cfg.address;$('#contract-short').textContent=short(cfg.address);}
render();if(client)refreshChain();if(location.hash==='#claims')page('claims');if(location.hash==='#dashboard')page('dashboard');
