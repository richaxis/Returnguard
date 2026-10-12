# Production status — ReturnGuard

**Status: implementation scaffold / not yet deployed.** The frontend supports a polished preview experience and browser-local demo cases. On-chain actions require a deployed contract address and a compatible wallet on GenLayer Studio Next.

## Before hackathon submission

- [ ] Deploy `chain-and-site/contracts/return_guard.py` to Studio Next (chain ID `61997`).
- [ ] Confirm the deployed contract passes a live create → challenge → resolve → withdraw walkthrough.
- [ ] Confirm every transaction uses `lib/fees.js`; phase timeouts remain clamped to 30–600, including retries.
- [ ] Record the exact full contract address in Vercel `VITE_CONTRACT_ADDRESS`, `public/deployment.json`, `docs/EVIDENCE.md`, and this file.
- [ ] Verify `footer-address` renders that same full address in the deployed site.
- [ ] Run `make -C chain-and-site test`, `npm test`, and `npm run build`.
- [ ] Test unreadable pages, malformed AI output, quote not found, exact-bond enforcement, self-challenge rejection, unknown IDs, cancellation and mutual refund requests.
- [ ] Confirm the user-facing copy explains that a bond is not the original purchase price and that the contract does not directly compel a merchant or card provider to issue a refund.

## Network

- Network: GenLayer Studio Next
- RPC: `https://studio-next.genlayer.com/api`
- Chain ID: `61997`
- Explorer: `https://explorer-studio-dev.genlayer.com/`
- Contract address: **NOT DEPLOYED — replace after deployment**

Do not describe this project as deployed or production-ready until the live walkthrough and checks above have passed.
