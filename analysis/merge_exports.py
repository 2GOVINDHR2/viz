#!/usr/bin/env python3
"""Merge Study Mode exports from several lab machines into one export.

Each bundle is a Study Mode export: the ZIP the researcher downloads, or a
folder with its CSV files. The merge
  * checks every file's columns against docs/DATA-DICTIONARY.md (names and order);
  * checks that participant codes are unique across bundles, and that every
    row of every file belongs to a participant listed in its own bundle;
  * refuses to mix simulated and real exports;
  * and only if all checks pass, writes the concatenated CSV files plus
    manifest.csv, which records for every output row the bundle and row it
    came from.
Problems are reported, never resolved silently; nothing is written if any check fails.

Usage: python3 analysis/merge_exports.py <bundles_dir> <out_dir>
Exit status: 0 merged, 1 problems found (report on stderr), 2 usage error.
"""
from __future__ import annotations

import csv
import io
import re
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ["participants", "responses_long", "sus", "tlx", "telemetry", "telemetry_events", "feedback"]


def dictionary_columns(md: str) -> dict[str, list[str]]:
    """Column names per file, in order, from the data dictionary's tables (a `a` … `b` cell expands a numbered range)."""
    out = {}
    for name in FILES:
        sec = md.split(f"## {name}.csv")[1].split("\n## ")[0]
        cols: list[str] = []
        for m in re.finditer(r"^\| ((?:`[^`]+`(?:, | … )?)+) \|", sec, re.M):
            names = re.findall(r"`([^`]+)`", m.group(1))
            if "…" in m.group(1):
                a, b = (int(x[-2:]) for x in names)
                cols += [f"{names[0][:-2]}{k:02d}" for k in range(a, b + 1)]
            else:
                cols += names
        out[name] = cols
    return out


COLUMNS = dictionary_columns((ROOT / "docs/DATA-DICTIONARY.md").read_text())


@dataclass
class Bundle:
    name: str
    simulated: bool
    tables: dict[str, tuple[list[str], list[list[str]]]] = field(default_factory=dict)


def read_bundle(path: Path) -> Bundle:
    if path.is_dir():
        files = {p.name: p.read_text(encoding="utf-8") for p in path.iterdir() if p.is_file()}
    else:
        with zipfile.ZipFile(path) as z:
            files = {Path(n).name: z.read(n).decode("utf-8") for n in z.namelist() if not n.endswith("/")}
    b = Bundle(path.name, "SIMULATED" in files)
    for name in FILES:
        text = files.get(f"{name}.csv")
        if text is None:
            continue
        rows = list(csv.reader(io.StringIO(text)))
        b.tables[name] = (rows[0] if rows else [], rows[1:])
    return b


def check(bundles: list[Bundle]) -> list[str]:
    problems: list[str] = []
    if len({b.simulated for b in bundles}) > 1:
        sims = [b.name for b in bundles if b.simulated]
        problems.append(f"mixed simulated and real exports (simulated: {', '.join(sims)})")
    owner: dict[str, str] = {}
    for b in bundles:
        for name in FILES:
            if name not in b.tables:
                problems.append(f"{b.name}: {name}.csv is missing")
                continue
            header, _ = b.tables[name]
            if header != COLUMNS[name]:
                missing = [c for c in COLUMNS[name] if c not in header]
                extra = [c for c in header if c not in COLUMNS[name]]
                detail = "; ".join(x for x in (
                    f"missing {missing}" if missing else "",
                    f"unexpected {extra}" if extra else "",
                    "same columns in a different order" if not missing and not extra else "",
                ) if x)
                problems.append(f"{b.name}: {name}.csv columns do not match the data dictionary ({detail})")
        if "participants" not in b.tables or b.tables["participants"][0] != COLUMNS["participants"]:
            continue
        ids = [r[0] for r in b.tables["participants"][1]]
        for pid in sorted({p for p in ids if ids.count(p) > 1}):
            problems.append(f"{b.name}: participant code {pid} appears more than once in participants.csv")
        for pid in ids:
            if pid in owner and owner[pid] != b.name:
                problems.append(f"participant code collision: {pid} is in both {owner[pid]} and {b.name}")
            owner.setdefault(pid, b.name)
        known = set(ids)
        for name in FILES[1:]:
            if name in b.tables and b.tables[name][0] == COLUMNS[name]:
                strays = sorted({r[0] for r in b.tables[name][1]} - known)
                if strays:
                    problems.append(f"{b.name}: {name}.csv has rows for participants not in its participants.csv: {strays[:5]}")
    return problems


def merge(bundles: list[Bundle], out: Path) -> dict[str, int]:
    out.mkdir(parents=True, exist_ok=True)
    counts = {}
    with open(out / "manifest.csv", "w", newline="", encoding="utf-8") as mf:
        man = csv.writer(mf)
        man.writerow(["output_file", "output_row", "source_bundle", "source_row"])
        for name in FILES:
            with open(out / f"{name}.csv", "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f, lineterminator="\r\n")
                w.writerow(COLUMNS[name])
                k = 0
                for b in bundles:
                    for i, row in enumerate(b.tables[name][1], start=1):
                        k += 1
                        w.writerow(row)
                        man.writerow([f"{name}.csv", k, b.name, i])
                counts[name] = k
    if bundles[0].simulated:
        (out / "SIMULATED").write_text("Merged from simulated exports (analysis/merge_exports.py).\n")
    return counts


def bundles_in(d: Path) -> list[Path]:
    return sorted(p for p in d.iterdir() if p.suffix == ".zip" or (p.is_dir() and any(p.glob("*.csv"))))


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    src, out = Path(argv[0]), Path(argv[1])
    paths = bundles_in(src)
    if not paths:
        print(f"no export bundles (.zip files or folders of CSV files) in {src}", file=sys.stderr)
        return 1
    bundles = [read_bundle(p) for p in paths]
    problems = check(bundles)
    if problems:
        print(f"NOT merged — {len(problems)} problem(s) in {len(bundles)} bundle(s):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    counts = merge(bundles, out)
    print(f"merged {len(bundles)} bundles into {out}: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
