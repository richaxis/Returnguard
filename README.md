# ReturnGuard

ReturnGuard is an evidence-led refund-dispute workflow for online shopping. It helps a customer organize a claim, preserve the exact policy quote used at publication, and resolve a challenged case through GenLayer Intelligent Contract consensus. The marketplace-inspired storefront is original and uses familiar shopping discovery patterns without copying Fiverr's branding or assets.

**Important scope:** the contract manages case bonds and records evidence-based outcomes. It does not hold the original purchase price or autonomously issue a merchant/card refund. Users may still need to contact the seller or payment provider.

## Project structure

- `app/` — responsive storefront, case explorer, create-case modal and dashboard
- `chain-and-site/contracts/return_guard.py` — GenLayer Intelligent Contract
- `chain-and-site/tests/` — static contract and helper checks
- `design/brand/` — brand tokens
- `docs/` — protocol, evidence handling and deployment notes
- `lib/` — GenLayer client, fees and unit helpers
- `public/deployment.json` — network and contract metadata
- `scripts/` — deployment and network helpers
- `tests/` — frontend helper tests

## Run locally

```bash
npm ci
cp .env.example .env
# Set VITE_CONTRACT_ADDRESS after deploying the contract
npm run dev
```

Without a deployed contract address, the site displays an empty state and blocks case creation. It does not create local placeholder cases.

## Deploy the Intelligent Contract

Network: **GenLayer Studio Next**  
RPC: `https://studio-dev.genlayer.com/api`  
Chain ID: `61997`  
Explorer: `https://explorer-studio-dev.genlayer.com/`

Use the official [GenLayer project boilerplate v2-dev](https://github.com/genlayerlabs/genlayer-project-boilerplate/tree/v2-dev) and the [consensus v0.6 migration notes](https://docs.genlayer.com/developers/consensus-v06-migration#test-on-studio-dev-first) to validate runtime compatibility.

For Studio deployment, paste `chain-and-site/contracts/return_guard.py`; its constructor has no arguments. Or deploy with a funded Studio Next key:

```bash
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:contract
```

After deployment, record the **same full contract address** in all three places:

1. `.env` / Vercel environment variable `VITE_CONTRACT_ADDRESS`
2. `public/deployment.json`
3. `docs/EVIDENCE.md` and `PRODUCTION_STATUS.md`

Never put `DEPLOYER_PRIVATE_KEY` in Vercel or commit it. The footer shows the full address supplied by the frontend build configuration.

## Fee handling

Frontend writes use `@genlayer/transaction-kit@0.1.0-rc.2` for live fee quoting, fee-policy verification, wallet approval/signing and lifecycle tracking. `lib/fees.js` remains a legacy helper and is not the active browser write path. The app must still be tested with the actual deployed contract and current Studio Next fee policy.

## Contract safeguards

- Claim, quote and URL inputs are length-checked; evidence URLs must use `https://`.
- The policy quote hash is saved at publication.
- Challenges must match the claim bond exactly; authors cannot challenge themselves.
- Unknown claim IDs are rejected.
- `cancel(id)` returns the author's bond while a claim is uncontested.
- `request_refund(id)` returns both bonds after both parties request an exit.
- Validators agree on a short excerpt around the quoted policy at resolution; the excerpt and its hash are stored on-chain.
- Unreadable pages and unclear verdicts become inconclusive and return both bonds rather than trapping the case.

## Checks

```bash
make -C chain-and-site test
npm test
npm run build
```

Deploy to Studio Next and verify the complete wallet → create claim → challenge → resolve → withdraw flow before submitting to the hackathon.


## Live wallet and case data

The UI does not seed fictional cases and does not save new cases locally. It reads claim records from the configured ReturnGuard contract. Connect an injected EIP-1193 wallet (for example MetaMask), switch to Studio Next (chain ID `61997`), and use GEN for both the claim bond and network fees. Writes use Transaction Kit RC2 to quote fees, request wallet approval/signature, submit, and track the GenLayer transaction. Disconnect clears the app's selected account; wallet providers may not support revoking the site's underlying permission.

The contract address must be set as `VITE_CONTRACT_ADDRESS` in Vercel after deploying `chain-and-site/contracts/return_guard.py`. The contract must be tested on the target network before this application is treated as ready for real users.
