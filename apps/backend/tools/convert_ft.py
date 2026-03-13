import json, sys, pathlib

src = r"data\finetune\marine_ft_v1.jsonl"
dst = r"data\finetune\marine_ft_v1.conv.jsonl"

def pick(d, candidates, default=""):
    for k in candidates:
        if k in d and d[k]:
            return d[k]
    return default

n_in = n_out = 0
with open(src, "r", encoding="utf-8") as fi, open(dst, "w", encoding="utf-8") as fo:
    for line in fi:
        if not line.strip():
            continue
        n_in += 1
        ex = json.loads(line)
        instr = pick(ex, ["instruction","question","prompt","user","input"]).strip()
        # Prefer SQL as the supervised target if present; otherwise any completion/answer
        resp  = pick(ex, ["response","output","sql","answer","completion","text"]).strip()

        if not instr or not resp:
            continue
        fo.write(json.dumps({"instruction": instr, "response": resp}, ensure_ascii=False) + "\n")
        n_out += 1

print(f"Converted {n_out}/{n_in} examples -> {dst}")
