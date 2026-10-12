# ReturnGuard protocol

## Case lifecycle

`open` → `challenged` → `refund_supported | refund_denied | refunded_both`

An uncontested `open` case can be cancelled by its author, crediting the original bond back. A challenged case can be exited by mutual consent: each party calls `request_refund(id)` and when both have requested, each bond is credited back. Resolution captures a policy excerpt, evaluates the claim with GenLayer consensus and stores the verdict and evidence snapshot.

## Safety rules

- IDs must refer to an existing claim.
- Title, claim, quote and URL are length-checked.
- URLs must be HTTPS and contain no spaces.
- The quote hash is recorded at publication.
- A challenger cannot be the author and must send a bond exactly equal to the original bond.
- Verdict parsing accepts only `refund`, `deny` or `inconclusive`; malformed output is inconclusive.
- If the evidence page cannot be read or the quote is not found, both parties' bonds are credited back.
- Withdrawals use pull-payment credits and zero the credit before emitting the transfer.

## Scope boundary

This is a case-bond and evidence-resolution protocol, not a payment-card network or merchant integration. A supported refund verdict does not itself debit a merchant or return the original purchase price. A production extension would require explicit merchant escrow/authorization and a legally appropriate dispute process.
