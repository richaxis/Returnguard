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
  createClient({
    chain: makeChain(cfg),
    ...(account ? { account, provider: window.ethereum } : {}),
  });

export const read = (client, cfg, functionName, args = []) =>
  client.readContract({ address: cfg.address, functionName, args }).then(plain);


export async function write(client, cfg, functionName, args = [], value = 0n, onProgress = () => {}) {
  if (!cfg.address) throw new Error("ReturnGuard contract address is missing. Set VITE_CONTRACT_ADDRESS in Vercel.");
  if (!window.ethereum) throw new Error("No browser wallet found. Install or unlock MetaMask or another EIP-1193 wallet.");
  const [activeAccount] = await window.ethereum.request({ method: "eth_accounts" });
  if (!activeAccount) throw new Error("Your wallet is not connected. Click Connect wallet first.");

  onProgress("Checking wallet network…");
  await ensureChain(cfg);
  // Rebuild a provider-backed client after the wallet/network check. This is the
  // documented GenLayerJS browser-wallet path and triggers the wallet signing UI.
  const walletClient = createClient({ chain: makeChain(cfg), account: activeAccount, provider: window.ethereum });
  const call = {
    address: cfg.address,
    functionName,
    args,
    ...(BigInt(value) > 0n ? { value: BigInt(value) } : {}),
  };
  onProgress("Estimating GenLayer network fees…");
  const estimate = await walletClient.estimateTransactionFeesForWrite(call);
  if (!estimate?.distribution || estimate?.feeValue === undefined) {
    throw new Error("GenLayer did not return a valid fee estimate. Please try again.");
  }
  onProgress("Approve the transaction in your wallet…");
  const hash = await walletClient.writeContract({
    ...call,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  if (!hash) throw new Error("The wallet did not return a transaction ID.");
  onProgress("Transaction submitted. Waiting for GenLayer…");
  // A submission ID means the write has been sent. Wait for consensus finalization;
  // surface the ID on any tracking error so users can inspect it in the explorer.
  try {
    const receipt = await walletClient.waitForFinalization({ hash });
    const resultText = JSON.stringify(receipt ?? {});
    if (/FINISHED_WITH_ERROR|executionResultName[^,}]*ERROR|statusName[^,}]*FAILED/i.test(resultText)) {
      const err = new Error(`GenLayer execution failed${receipt?.statusName ? ` (${receipt.statusName})` : ""}.`);
      err.hash = hash;
      err.receipt = receipt;
      throw err;
    }
    return { hash, receipt };
  } catch (err) {
    if (!err.hash) err.hash = hash;
    throw err;
  }
}

export async function loadClaims(client, cfg) {
  const count = Number(await read(client, cfg, "get_claim_count"));
  const ids = Array.from({ length: count }, (_, i) => i);
  return Promise.all(ids.map(async (id) => ({ id, ...JSON.parse(await read(client, cfg, "get_claim", [id])) })));
}
