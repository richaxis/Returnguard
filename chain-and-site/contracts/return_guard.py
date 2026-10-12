# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import json
import genlayer as gl
from genlayer.types import *

MAX_TITLE, MAX_CLAIM, MAX_QUOTE, MAX_URL = 120, 1000, 500, 500
MIN_CLAIM, MIN_QUOTE = 20, 8
VERDICTS = ("refund", "deny", "inconclusive")

_K = [
    0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
    0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
    0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
    0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
    0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
    0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
    0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
    0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
]


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _ror(x: int, n: int) -> int:
    return ((x >> n) | (x << (32 - n))) & 0xFFFFFFFF


def _sha256_hex(text: str) -> str:
    """Pure-Python SHA-256 so the contract does not depend on any extra stdlib module."""
    data = text.encode("utf-8")
    h = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19]
    bits = len(data) * 8
    data += b"\x80"
    data += b"\x00" * ((56 - len(data) % 64) % 64)
    data += bits.to_bytes(8, "big")
    for i in range(0, len(data), 64):
        w = [int.from_bytes(data[i + j * 4: i + j * 4 + 4], "big") for j in range(16)]
        for j in range(16, 64):
            s0 = _ror(w[j - 15], 7) ^ _ror(w[j - 15], 18) ^ (w[j - 15] >> 3)
            s1 = _ror(w[j - 2], 17) ^ _ror(w[j - 2], 19) ^ (w[j - 2] >> 10)
            w.append((w[j - 16] + s0 + w[j - 7] + s1) & 0xFFFFFFFF)
        a, b, c, d, e, f, g, k = h
        for j in range(64):
            t1 = (k + (_ror(e, 6) ^ _ror(e, 11) ^ _ror(e, 25)) + ((e & f) ^ ((~e) & g)) + _K[j] + w[j]) & 0xFFFFFFFF
            t2 = ((_ror(a, 2) ^ _ror(a, 13) ^ _ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) & 0xFFFFFFFF
            k, g, f, e, d, c, b, a = g, f, e, (d + t1) & 0xFFFFFFFF, c, b, a, (t1 + t2) & 0xFFFFFFFF
        h = [(x + y) & 0xFFFFFFFF for x, y in zip(h, [a, b, c, d, e, f, g, k])]
    return "".join(f"{x:08x}" for x in h)



def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _parse_verdict(raw: str) -> str:
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        obj = json.loads(cleaned)
        word = str(obj.get("verdict", "")).strip().lower() if isinstance(obj, dict) else ""
    except Exception:
        word = cleaned.lower().strip(" \n\t\"'.")
    return word if word in VERDICTS else "inconclusive"


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass


class ReturnGuard(gl.contract.Contract):
    claims: gl.storage.TreeMap[u256, str]
    credits: gl.storage.TreeMap[Address, u256]
    next_id: u256

    def __init__(self):
        self.next_id = 0

    @gl.public.write.payable
    def create_claim(self, title: str, claim: str, quote: str, url: str) -> None:
        amount = gl.message.value
        title, claim, quote, url = title.strip(), claim.strip(), quote.strip(), url.strip()
        if amount <= 0:
            raise gl.vm.UserError("send a bond greater than zero")
        if not title or len(title) > MAX_TITLE:
            raise gl.vm.UserError("title must be 1-120 characters")
        if len(claim) < MIN_CLAIM or len(claim) > MAX_CLAIM:
            raise gl.vm.UserError("claim must be 20-1000 characters")
        if len(quote) < MIN_QUOTE or len(quote) > MAX_QUOTE:
            raise gl.vm.UserError("policy quote must be 8-500 characters")
        if not url.startswith("https://") or len(url) > MAX_URL or " " in url:
            raise gl.vm.UserError("evidence URL must be https:// and at most 500 characters")
        rec = {"author": gl.message.sender_address.as_hex, "title": title, "claim": claim,
               "quote": quote, "quote_hash": _sha256_hex(_norm(quote)), "url": url,
               "bond": str(amount), "challenger": "", "challenge_bond": "0",
               "status": "open", "author_requested_refund": False, "challenger_requested_refund": False,
               "evidence_excerpt": "", "evidence_hash": "", "verdict": ""}
        self.claims[self.next_id] = json.dumps(rec)
        self.next_id = self.next_id + 1

    @gl.public.write.payable
    def challenge(self, claim_id: int) -> None:
        rec = self._load(claim_id)
        sender = gl.message.sender_address.as_hex
        if rec["status"] != "open": raise gl.vm.UserError("claim is not open for challenge")
        if sender == rec["author"]: raise gl.vm.UserError("authors cannot challenge their own claim")
        if int(gl.message.value) != int(rec["bond"]): raise gl.vm.UserError("challenge bond must exactly match the claim bond")
        rec["challenger"], rec["challenge_bond"], rec["status"] = sender, str(gl.message.value), "challenged"
        self._save(claim_id, rec)

    @gl.public.write
    def cancel(self, claim_id: int) -> None:
        rec = self._load(claim_id)
        if gl.message.sender_address.as_hex != rec["author"]: raise gl.vm.UserError("only the author can cancel")
        if rec["status"] != "open": raise gl.vm.UserError("only uncontested claims can be cancelled")
        self._credit(Address(rec["author"]), int(rec["bond"]))
        rec["status"] = "cancelled"
        self._save(claim_id, rec)

    @gl.public.write
    def request_refund(self, claim_id: int) -> None:
        rec = self._load(claim_id)
        sender = gl.message.sender_address.as_hex
        if rec["status"] != "challenged": raise gl.vm.UserError("refund request requires a challenged claim")
        if sender == rec["author"]: rec["author_requested_refund"] = True
        elif sender == rec["challenger"]: rec["challenger_requested_refund"] = True
        else: raise gl.vm.UserError("only either party can request a refund")
        if rec["author_requested_refund"] and rec["challenger_requested_refund"]:
            self._credit(Address(rec["author"]), int(rec["bond"]))
            self._credit(Address(rec["challenger"]), int(rec["challenge_bond"]))
            rec["status"], rec["verdict"] = "refunded_both", "inconclusive"
        self._save(claim_id, rec)

    @gl.public.write
    def resolve(self, claim_id: int) -> str:
        rec = self._load(claim_id)
        if rec["status"] != "challenged": raise gl.vm.UserError("claim must be challenged before resolution")
        url, quote, claim, title, quote_hash = rec["url"], rec["quote"], rec["claim"], rec["title"], rec["quote_hash"]
        def capture() -> str:
            try:
                page = gl.nondet.web.render(url, mode="text")
                normalized, q = _norm(page), _norm(quote)
                pos = normalized.find(q)
                if len(normalized) < 20 or pos < 0:
                    return json.dumps({"ok": False, "excerpt": "", "note": "quote not found or page unreadable"}, sort_keys=True)
                start, end = max(0, pos - 180), min(len(normalized), pos + len(q) + 220)
                return json.dumps({"ok": True, "excerpt": normalized[start:end]}, sort_keys=True)
            except Exception:
                return json.dumps({"ok": False, "excerpt": ""}, sort_keys=True)
        snap = json.loads(gl.eq_principle.strict_eq(capture))
        if not snap.get("ok"):
            self._credit(Address(rec["author"]), int(rec["bond"]))
            self._credit(Address(rec["challenger"]), int(rec["challenge_bond"]))
            rec.update({"status": "refunded_both", "verdict": "inconclusive", "evidence_excerpt": "", "evidence_hash": _sha256_hex("")})
            self._save(claim_id, rec)
            return "inconclusive"
        excerpt = snap["excerpt"]
        def judge() -> str:
            prompt = f"""Evaluate this online-shopping refund dispute conservatively using only the evidence.
Claim title: {title}
Customer claim: {claim}
Original policy quote (published hash {quote_hash}): {quote}
Evidence excerpt captured during resolution: {excerpt}
Return 'refund' only if evidence clearly supports the customer under the quote; 'deny' only if clearly unsupported; otherwise 'inconclusive'. Respond only JSON {{"verdict":"refund|deny|inconclusive"}}"""
            try: return json.dumps({"verdict": _parse_verdict(gl.nondet.exec_prompt(prompt))}, sort_keys=True)
            except Exception: return json.dumps({"verdict": "inconclusive"}, sort_keys=True)
        verdict = json.loads(gl.eq_principle.strict_eq(judge)).get("verdict", "inconclusive")
        if verdict not in VERDICTS: verdict = "inconclusive"
        if verdict == "inconclusive":
            self._credit(Address(rec["author"]), int(rec["bond"]))
            self._credit(Address(rec["challenger"]), int(rec["challenge_bond"]))
            rec["status"] = "refunded_both"
        elif verdict == "refund":
            self._credit(Address(rec["author"]), int(rec["bond"]) + int(rec["challenge_bond"]))
            rec["status"] = "refund_supported"
        else:
            self._credit(Address(rec["author"]), int(rec["bond"]))
            self._credit(Address(rec["challenger"]), int(rec["challenge_bond"]))
            rec["status"] = "refund_denied"
        rec["verdict"], rec["evidence_excerpt"], rec["evidence_hash"] = verdict, excerpt, _sha256_hex(excerpt)
        self._save(claim_id, rec)
        return verdict

    @gl.public.write
    def withdraw(self) -> None:
        who = gl.message.sender_address
        amount = self.credits.get(who, 0)
        if amount == 0: raise gl.vm.UserError("nothing to withdraw")
        self.credits[who] = 0
        _Recipient(who).emit_transfer(value=amount)

    @gl.public.view
    def get_claim(self, claim_id: int) -> str:
        return json.dumps(self._load(claim_id))

    @gl.public.view
    def get_claim_count(self) -> int:
        return self.next_id

    @gl.public.view
    def get_credit(self, account: str) -> str:
        return str(self.credits.get(Address(account), 0))

    def _load(self, claim_id: int) -> dict:
        if claim_id < 0 or claim_id >= self.next_id: raise gl.vm.UserError("unknown claim id")
        return json.loads(self.claims[claim_id])
    def _save(self, claim_id: int, rec: dict) -> None: self.claims[claim_id] = json.dumps(rec)
    def _credit(self, who: Address, amount: int) -> None: self.credits[who] = self.credits.get(who, 0) + amount
