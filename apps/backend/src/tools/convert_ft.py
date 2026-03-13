import json, ast, pathlib, sys

src = r"data\finetune\marine_ft_v1.jsonl"
dst = r"data\finetune\marine_ft_v1.conv.jsonl"

def pick(d, keys, default=""):
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return default

def try_parse(line: str):
    s = line.strip()
    if not s or s.startswith("#") or s.startswith("//"):
        return None  # ignore comments/empties
    # strip a trailing comma (common copy/paste issue)
    if s.endswith(","):
        s = s[:-1]
    # first try JSON
    try:
        return json.loads(s)
    except Exception:
        pass
    # fallback: python-literal (single quotes, True/False/None, etc.)
    try:
        obj = ast.literal_eval(s)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    return "__BAD__"

n_in = n_ok = n_skip = 0
pathlib.Path(dst).parent.mkdir(parents=True, exist_ok=True)
with open(src, "r", encoding="utf-8") as fi, open(dst, "w", encoding="utf-8") as fo:
    for idx, line in enumerate(fi, start=1):
        n_in += 1
        obj = try_parse(line)
        if obj in (None, "__BAD__"):
            n_skip += 1
            if obj == "__BAD__":
                # print a short hint for the first few bad lines
                if n_skip <= 5:
                    print(f"Skipped non-JSON line {idx}: {line[:120]!r}")
            continue

        instr = pick(obj, ["instruction","question","prompt","user","input"]).strip()
        resp  = pick(obj, ["response","output","sql","answer","completion","text"]).strip()
        if not instr or not resp:
            n_skip += 1
            continue

        fo.write(json.dumps({"instruction": instr, "response": resp}, ensure_ascii=False) + "\n")
        n_ok += 1

print(f"Converted {n_ok}/{n_in} lines → {dst} (skipped {n_skip})")
