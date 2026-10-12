"""Verify ReturnGuard's pure SHA-256 and verdict parser helpers."""
import ast, hashlib, pathlib, random
src = (pathlib.Path(__file__).parent.parent / "contracts" / "return_guard.py").read_text()
tree = ast.parse(src)
keep = {"_norm", "_ror", "_sha256_hex", "_parse_verdict"}
nodes = [n for n in tree.body if (isinstance(n, ast.FunctionDef) and n.name in keep) or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in ("_K", "VERDICTS"))]
ns = {"json": __import__("json")}; exec(compile(ast.Module(body=nodes, type_ignores=[]), "helpers", "exec"), ns)
random.seed(1)
for n in list(range(0, 130)) + [500, 1000]:
    s = "".join(random.choice("abc é中 ") for _ in range(n))
    assert ns["_sha256_hex"](s) == hashlib.sha256(s.encode()).hexdigest(), f"sha256 mismatch at {n}"
p = ns["_parse_verdict"]
assert p('{"verdict":"refund"}') == "refund"
assert p('```json\n{"verdict":"deny"}\n```') == "deny"
assert p('"inconclusive"') == "inconclusive"
assert p("refund and deny") == "inconclusive"
assert p('{"verdict":"something else"}') == "inconclusive"
assert ns["_norm"](" A  B\nC ") == "a b c"
print("helper checks passed (sha256, normalization, strict verdict parsing)")
