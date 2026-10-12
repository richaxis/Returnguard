import fs from 'node:fs';
import { createClient, createAccount } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { makeConfig, makeChain } from '../lib/chain.js';
import { quoteFees } from '../lib/fees.js';

const key = process.env.DEPLOYER_PRIVATE_KEY;
if (!key) throw new Error('Set DEPLOYER_PRIVATE_KEY to a funded Studio Next test account.');
const cfg = makeConfig({ VITE_RPC_URL: process.env.VITE_RPC_URL, VITE_CHAIN_ID: process.env.VITE_CHAIN_ID, VITE_EXPLORER_URL: process.env.VITE_EXPLORER_URL });
const client = createClient({ chain: makeChain(cfg), account: createAccount(key) });
const code = fs.readFileSync(new URL('../chain-and-site/contracts/return_guard.py', import.meta.url), 'utf8');
const fees = await quoteFees(client, 'deploy');
const hash = await client.deployContract({ code, args: [], leaderOnly: false, fees });
fs.mkdirSync('runs', { recursive: true });
fs.appendFileSync('runs/transactions.jsonl', JSON.stringify({ kind: 'deploy', hash, at: new Date().toISOString() }) + '\n');
console.log('Deploy transaction:', hash);
const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 5000 });
const address = receipt?.data?.contract_address ?? receipt?.txDataDecoded?.contractAddress;
if (address) {
  console.log('Contract address:', address);
  const file = new URL('../public/deployment.json', import.meta.url);
  const deployment = JSON.parse(fs.readFileSync(file, 'utf8'));
  deployment.address = address;
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2) + '\n');
} else console.log('Address not found in receipt. Open the transaction in the explorer and copy the deployed address.');
console.log('Verify execution status in the explorer; transaction acceptance alone does not prove successful execution.');
