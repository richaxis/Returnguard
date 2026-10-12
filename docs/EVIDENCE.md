# Evidence handling

1. At publication, ReturnGuard normalizes the policy quote and stores its SHA-256 hash (`quote_hash`). The original quote text is stored with the claim.
2. Evidence URLs must be public HTTPS URLs. During resolution, validators attempt to read the page and locate the normalized policy quote.
3. Validators agree on a short excerpt around the quote. The excerpt and its SHA-256 hash are saved on-chain as `evidence_excerpt` and `evidence_hash`.
4. If the page is unreadable or the exact quote cannot be located, the result is inconclusive and both bonds are credited back. Unclear or unparsable model verdicts are also treated as inconclusive.
5. The UI labels preview data as illustrative/local. It must not imply that a demo case or an off-chain browser record has been verified by GenLayer.

## Deployment address record

- Studio Next contract address: **NOT DEPLOYED — record the full address here after deployment**
- The exact same address must be configured as Vercel `VITE_CONTRACT_ADDRESS`, stored in `public/deployment.json`, and shown in the site's footer.

A policy quote hash proves which text was recorded; it does not prove that a merchant's policy is lawful, that a purchase occurred, or that submitted photos are authentic. Users should redact personal data before publishing evidence.
