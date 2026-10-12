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

Without a deployed address, the site runs in preview mode: case creation is saved to local browser storage and sample cases are illustrative, not on-chain records.

## Deploy the Intelligent Contract

Network: **GenLayer Studio Next**  
RPC: `https://studio-next.genlayer.com/api`  
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

The fee helper in `lib/fees.js` clamps every phase-time allocation to the valid `30..600` range, including scaled retries. The method profile in `lib/fee-profile.js` is a starting budget, not a promise of measured production fees. Transactions retry on `BudgetTooLow`; execution status is checked after acceptance.

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
