// Minimal Studio Next smoke test. Needs two funded test accounts and a deployed ReturnGuard contract.
// VITE_CONTRACT_ADDRESS=0x... KEY_A=0x... KEY_B=0x... npm run e2e
import fs from 'node:fs';
import { createClient, createAccount } from 'genlayer-js';
import { makeConfig, makeChain, read, write, toWei } from '../lib/chain.js';
const cfg = makeConfig(process.env), { KEY_A, KEY_B } = process.env;
if (!cfg.address || !KEY_A || !KEY_B) throw new Error('Set VITE_CONTRACT_ADDRESS, KEY_A and KEY_B.');
const A=createAccount(KEY_A), B=createAccount(KEY_B);
const a=createClient({chain:makeChain(cfg),account:A}), b=createClient({chain:makeChain(cfg),account:B});
const bond=toWei(process.env.E2E_BOND||'0.01');
const rows=[];
async function step(name,client,fn,args=[],value=0n){const r=await write(client,cfg,fn,args,value);rows.push({name,hash:r.hash});console.log('ok',name,r.hash);}
async function expectFail(name,client,fn,args=[],value=0n){try{await write(client,cfg,fn,args,value);}catch{rows.push({name,hash:'rejected as expected'});console.log('ok',name,'rejected');return;}throw new Error(`${name} should have reverted`);}
const quote='Refunds are processed within 5 business days after the returned item is received.';
const url=process.env.E2E_URL||'https://www.example.com/returns';
const claim='The returned item was delivered but the promised refund has not arrived.';
const count=()=>read(a,cfg,'get_claim_count');
const record=async id=>JSON.parse(await read(a,cfg,'get_claim',[id]));
// Input validation
await expectFail('reject non-HTTPS evidence URL',a,'create_claim',['Test claim',claim,quote,'http://example.com'],bond);
// Uncontested cancellation returns the author's bond.
let id=Number(await count());
await step(`create claim ${id}`,a,'create_claim',['E2E cancellation',claim,quote,url],bond);
await expectFail('reject author self-challenge',a,'challenge',[id],bond);
await step(`cancel claim ${id}`,a,'cancel',[id]);
if((await record(id)).status!=='cancelled')throw new Error('cancel status mismatch');
// Contested case: exact bond, then mutual refund recovery.
id=Number(await count());
await step(`create challenged claim ${id}`,a,'create_claim',['E2E mutual refund',claim,quote,url],bond);
await expectFail('reject mismatched challenge bond',b,'challenge',[id],bond+1n);
await step(`challenge ${id}`,b,'challenge',[id],bond);
await step(`author requests mutual refund ${id}`,a,'request_refund',[id]);
await step(`challenger requests mutual refund ${id}`,b,'request_refund',[id]);
if((await record(id)).status!=='refunded_both')throw new Error('mutual refund status mismatch');
await step('withdraw author credit',a,'withdraw');
await step('withdraw challenger credit',b,'withdraw');
fs.mkdirSync('runs',{recursive:true});
const md=`# ReturnGuard Studio Next smoke test\n\nContract: ${cfg.address}\n\n| Step | Transaction / result |\n|---|---|\n${rows.map(r=>`| ${r.name} | ${r.hash} |`).join('\n')}\n`;
fs.writeFileSync('runs/e2e-report.md',md);console.log(md);console.log('Smoke test complete. Confirm execution results in the Studio Next explorer.');
