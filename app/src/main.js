import { makeConfig, connectWallet, disconnectWallet, makeClient, read, write, toWei, fromWei, short } from '../../lib/chain.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const cfg = makeConfig(import.meta.env);
let account = '';
let client = null;
let activeStatus = 'all';
let categoryFilter = 'all';
let cases = [
 {id:'RG-2048',title:'Wireless headphones arrived damaged',store:'SoundHouse',initial:'S',category:'electronics',claim:'The left earcup arrived cracked and the product cannot be used safely.',quote:'Damaged or defective items may be returned within 30 days of delivery.',url:'https://example.com/returns',bond:'0.01',status:'challenged',verdict:'',sample:true,amount:'€129.00',time:'12 min ago',author:'0x4a7…91d2',excerpt:'Damaged or defective items may be returned within 30 days of delivery. Please contact support with your order number and clear photographs of the damage.'},
 {id:'RG-2043',title:'Linen jacket differs from product listing',store:'North & Thread',initial:'N',category:'fashion',claim:'The received item color and fabric composition do not match the product description.',quote:'If an item is not as described, contact us within 14 days for a return or refund.',url:'https://example.com/returns',bond:'0.02',status:'open',verdict:'',sample:true,amount:'€84.50',time:'1 hr ago',author:'0x1e2…bd08',excerpt:'If an item is not as described, contact us within 14 days for a return or refund.'},
 {id:'RG-2037',title:'Desk lamp refund still pending',store:'Studio Objects',initial:'S',category:'home',claim:'The return was delivered to the merchant but the refund has not been issued.',quote:'Refunds are processed within 5 business days after the returned item is received.',url:'https://example.com/returns',bond:'0.01',status:'refund_supported',verdict:'refund',sample:true,amount:'€56.00',time:'Yesterday',author:'0x8bf…03ac',excerpt:'Refunds are processed within 5 business days after the returned item is received.'},
 {id:'RG-2029',title:'Website setup service not delivered',store:'PixelFoundry',initial:'P',category:'services',claim:'The agreed landing page was not delivered by the deadline stated in the order.',quote:'If the service provider misses the agreed delivery date, the buyer may request a refund.',url:'https://example.com/terms',bond:'0.015',status:'refund_denied',verdict:'deny',sample:true,amount:'€240.00',time:'2 days ago',author:'0x29a…f81c',excerpt:'If the service provider misses the agreed delivery date, the buyer may request a refund.'}
];
const localCases = JSON.parse(localStorage.getItem('rg-cases') || '[]');
cases = [...localCases, ...cases];
const categoryNames = {electronics:'Electronics',fashion:'Fashion',home:'Home & living',beauty:'Beauty',services:'Digital services'};
const statusInfo = {
 open:['Needs review','review'], challenged:['In resolution','disputed'], refund_supported:['Refund supported',''], refund_denied:['Refund denied','closed'], refunded_both:['Both bonds returned','closed'], cancelled:['Cancelled','closed'],
 inconclusive:['Inconclusive','closed']
};
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function statusTag(status){const [label,cls]=statusInfo[status]||['Open','review'];return `<span class="status ${cls}">${label}</span>`;}
function iconFor(c){return ({electronics:'⌁',fashion:'✳',home:'⌂',beauty:'✦',services:'▱'})[c]||'r✓';}
function caseCard(c){return `<article class="sample-card" data-case="${esc(c.id)}"><div class="sample-top"><span class="store-avatar">${esc(c.initial||iconFor(c.category))}</span>${statusTag(c.status)}</div><h3>${esc(c.title)}</h3><p>${esc(c.claim)}</p><div class="sample-foot"><div><small>${esc(c.store||'Community case')} · ${esc(c.time||'Just now')}</small></div><b>${esc(c.amount||'Evidence record')}</b></div></article>`;}
function rowCard(c){return `<article class="case-row" data-case="${esc(c.id)}"><span class="store-avatar">${esc(c.initial||iconFor(c.category))}</span><div><h3>${esc(c.title)}</h3><p>${esc(c.claim)}</p><div class="case-meta"><span>${esc(c.store||'Your case')}</span><span>${esc(categoryNames[c.category]||'General')}</span><span>${esc(c.time||'Just now')}</span></div></div><div class="case-value">${esc(c.amount||'—')}<small>${statusTag(c.status)}</small><button class="btn btn-outline" data-details="${esc(c.id)}">View case</button></div></article>`;}
function render(){
 const featured=$('#featured-cases'); if(featured) featured.innerHTML=cases.slice(0,3).map(caseCard).join('');
 const q=($('#search')?.value||'').toLowerCase();
 let filtered=cases.filter(c=>categoryFilter==='all'||c.category===categoryFilter).filter(c=>activeStatus==='all'||(activeStatus==='open'?c.status==='open':activeStatus==='challenged'?c.status==='challenged':['refund_supported','refund_denied','refunded_both','cancelled','inconclusive'].includes(c.status))).filter(c=>`${c.title} ${c.store} ${c.id} ${c.claim}`.toLowerCase().includes(q));
 if($('#sort')?.value==='value') filtered.sort((a,b)=>parseFloat(b.amount||'0')-parseFloat(a.amount||'0'));
 const list=$('#all-cases'); if(list) list.innerHTML=filtered.length?filtered.map(rowCard).join(''):'<div class="empty-state">No cases match those filters yet. Try another search or start a new case.</div>';
 const recent=$('#dashboard-cases'); if(recent) recent.innerHTML=cases.slice(0,4).map(c=>`<div class="dashboard-case"><span class="store-avatar">${esc(c.initial||iconFor(c.category))}</span><div><b>${esc(c.title)}</b><small>${esc(c.id)} · ${esc(c.time||'Just now')}</small></div>${statusTag(c.status)}</div>`).join('');
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
 if(c.sample||String(c.id).startsWith('local-')) html='<span class="form-note">Preview case · actions are illustrative until this case is published on Studio Next.</span>';
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
 const demos=cases.filter(c=>c.sample||String(c.id).startsWith('local-'));cases=[...onchain,...demos];render();}catch(e){console.warn('Could not load chain claims',e);}}
async function connect(){try{account=await connectWallet(cfg);client=makeClient(cfg,account);$('#connect').textContent=short(account);$('#dashboard-connect').textContent=short(account);$('#wallet-short').textContent=short(account);toast('Wallet connected to Studio Next');await refreshChain();await refreshCredit();}catch(e){toast(e.message||'Wallet connection failed');}}
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
$('#case-form').addEventListener('submit',async e=>{e.preventDefault();const title=$('#case-title').value.trim(),claim=$('#case-claim').value.trim(),quote=$('#case-quote').value.trim(),url=$('#case-url').value.trim(),bond=$('#case-bond').value.trim();if(!url.startsWith('https://')){toast('Use a public HTTPS policy or evidence URL.');return;}if(claim.length<20||quote.length<8){toast('Add a little more detail and the exact policy quote.');return;}const submit=e.submitter;submit.disabled=true;submit.textContent='Creating case…';try{
 if(cfg.address&&account&&client){const tx=await write(client,cfg,'create_claim',[title,claim,quote,url],toWei(bond));toast(`Case submitted · ${tx.hash.slice(0,10)}…`);closeModal();e.target.reset();await refreshChain();page('claims');}
 else {const id=`local-${Date.now()}`;const rec={id,title,claim,quote,url,bond,status:'open',category:'electronics',initial:title[0].toUpperCase(),store:'Your purchase',amount:`${bond} GEN bond`,time:'Just now',sample:false,excerpt:'Evidence snapshot is captured by the Intelligent Contract during resolution.',evidenceHash:'Created locally — not yet on-chain'};const stored=JSON.parse(localStorage.getItem('rg-cases')||'[]');stored.unshift(rec);localStorage.setItem('rg-cases',JSON.stringify(stored));cases.unshift(rec);closeModal();e.target.reset();render();page('claims');toast(cfg.address?'Connect wallet to publish on-chain. Saved locally for now.':'Preview case saved in this browser. Connect a wallet and configure the contract to publish on-chain.');}
 }catch(err){toast(err.message||'Could not create case');}finally{submit.disabled=false;submit.innerHTML='Create refund case <span>↗</span>';}});
$('#footer-address').textContent=cfg.address||'Not deployed';$('#contract-short').textContent=cfg.address?short(cfg.address):'Not deployed';
if(cfg.address){$('#footer-address').textContent=cfg.address;$('#contract-short').textContent=short(cfg.address);}
render();if(location.hash==='#claims')page('claims');if(location.hash==='#dashboard')page('dashboard');
