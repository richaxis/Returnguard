import { createTransactionKit } from "@genlayer/transaction-kit";
import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { plain } from "./units.js";
export * from "./units.js";

export function makeConfig(env = {}) {
  return {
    address: env.VITE_CONTRACT_ADDRESS || "",
    rpc: env.VITE_RPC_URL || "https://studio-dev.genlayer.com/api",
    chainId: Number(env.VITE_CHAIN_ID || 61997),
    explorer: env.VITE_EXPLORER_URL || "https://explorer-studio-dev.genlayer.com/",
  };
}

// Use the chain definition shipped with the v2 RC: chain id and consensus contract addresses
// must stay together, so we only override the RPC and explorer, never the id or addresses.
export function makeChain(cfg) {
  const base = chains.studioDevnet ?? chains.studioNext;
  if (!base) throw new Error("This GenLayerJS version does not include the Studio development-preview chain definition. Use genlayer-js 2.0.0-rc.1.");
  if (Number(base.id) !== cfg.chainId) throw new Error(`GenLayer chain definition mismatch: expected ${cfg.chainId}, SDK provides ${base.id}.`);
  return {
    ...base,
    name: "GenLayer Studio Next",
    rpcUrls: { default: { http: [cfg.rpc] } },
    blockExplorers: { default: { name: "Explorer", url: cfg.explorer } },
  };
}

const chainHex = (cfg) => "0x" + cfg.chainId.toString(16);

// Makes sure the wallet is on Studio Next; asks the wallet to ADD the network if it doesn't know it.
export async function ensureChain(cfg) {
  const eth = window.ethereum;
  if (!eth) throw new Error("No browser wallet found. Install MetaMask or Rabby.");
  if ((await eth.request({ method: "eth_chainId" })).toLowerCase() === chainHex(cfg)) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex(cfg) }] });
  } catch (e) {
    if (e.code === 4001) throw new Error("You rejected the network switch.");
    // 4902 = unknown chain; some wallets use -32603 or a message instead
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: chainHex(cfg), chainName: "GenLayer Studio Next", rpcUrls: [cfg.rpc],
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 }, blockExplorerUrls: [cfg.explorer] }],
    });
  }
}

// fresh = true forces the wallet's account picker, so you can choose a different account.
export async function connectWallet(cfg, fresh = false) {
  const eth = window.ethereum;
  if (!eth) throw new Error("No browser wallet found. Install MetaMask or Rabby.");
  if (fresh) {
    try { await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] }); }
    catch (e) { if (e.code === 4001) throw new Error("Connection rejected."); }
  }
  const [account] = await eth.request({ method: "eth_requestAccounts" });
  await ensureChain(cfg);
  return account;
}

// Sites cannot force-disconnect a wallet, but we can revoke this site's permission where supported.
export async function disconnectWallet() {
  try { await window.ethereum?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }); } catch {}
}

// Account is optional: reads work without a wallet, writes are signed by the wallet.
export const makeClient = (cfg, account) =>
  createClient({ chain: makeChain(cfg), ...(account ? { account } : {}) });

export const read = (client, cfg, functionName, args = []) =>
  client.readContract({ address: cfg.address, functionName, args }).then(plain);


export async function write(client, cfg, functionName, args = [], value = 0n) {
  if (!cfg.address) throw new Error("ReturnGuard contract address is missing.");
  if (!window.ethereum) throw new Error("Install or unlock MetaMask or another EIP-1193 wallet.");
  const [activeAccount] = await window.ethereum.request({ method: "eth_accounts" });
  if (!activeAccount) throw new Error("Connect your wallet before signing a transaction.");
  await ensureChain(cfg);

  // Transaction Kit uses the injected wallet provider for fee approval and signing.
  const kit = createTransactionKit({
    chain: makeChain(cfg),
    provider: window.ethereum,
    account: activeAccount,
  });
  const tx = {
    kind: "write",
    address: cfg.address,
    method: functionName,
    args,
    ...(BigInt(value) > 0n ? { value: BigInt(value) } : {}),
  };
  const quote = await kit.estimate({ preset: "standard" }, tx);
  if (quote?.verification?.status === "mismatch") {
    throw new Error("The live GenLayer fee policy changed. Please retry to get a fresh fee quote.");
  }
  const submitted = await kit.submit(quote, tx);
  const id = submitted?.genlayerTxId;
  if (!id) throw new Error("The wallet submission did not return a GenLayer transaction ID.");
  let lastStatus = null;
  const final = await kit.track(id, (status) => { lastStatus = status; });
  const resultText = JSON.stringify(final ?? lastStatus ?? {});
  if (/FINISHED_WITH_ERROR|executionResultName[^,}]*ERROR|statusName[^,}]*FAILED/i.test(resultText)) {
    const message = final?.error?.message || final?.message || `The ${functionName} transaction failed during GenLayer execution.`;
    const err = new Error(message);
    err.hash = id;
    err.receipt = final;
    throw err;
  }
  return { hash: id, receipt: final ?? lastStatus };
}

export async function loadClaims(client, cfg) {
  const count = Number(await read(client, cfg, "get_claim_count"));
  const ids = Array.from({ length: count }, (_, i) => i);
  return Promise.all(ids.map(async (id) => ({ id, ...JSON.parse(await read(client, cfg, "get_claim", [id])) })));
}
