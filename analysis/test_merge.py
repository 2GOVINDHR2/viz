"""Tests for analysis/merge_exports.py on simulated exports from three lab machines
(run: python3 -m unittest analysis/test_merge.py)."""
from __future__ import annotations

import csv
import importlib.util
import io
import sys
import tempfile
import unittest
import zipfile
from contextlib import redirect_stderr
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import merge_exports as M  # noqa: E402
import simulate  # noqa: E402

_spec = importlib.util.spec_from_file_location("dlv_analysis_m", HERE / "analysis.py")
A = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(A)


def write_bundle(root: Path, name: str, seed: int, as_zip: bool, n: int = 12) -> Path:
    tables = simulate.simulate(n, seed)
    files = {f"{k}.csv": v.to_csv(index=False) for k, v in tables.items()}
    files["SIMULATED"] = "synthetic\n"
    if as_zip:
        p = root / f"{name}.zip"
        with zipfile.ZipFile(p, "w") as z:
            for fn, text in files.items():
                z.writestr(fn, text)
    else:
        p = root / name
        p.mkdir()
        for fn, text in files.items():
            (p / fn).write_text(text)
    return p


def rows(path: Path) -> list[list[str]]:
    return list(csv.reader(path.read_text().splitlines()))


class Merge(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src = self.tmp / "bundles"
        self.src.mkdir()
        self.b = [
            write_bundle(self.src, "lab-pc-01", 101, True),
            write_bundle(self.src, "lab-pc-02", 102, True),
            write_bundle(self.src, "lab-pc-03", 103, False),
        ]

    def run_merge(self) -> tuple[int, str]:
        err = io.StringIO()
        with redirect_stderr(err):
            code = M.main([str(self.src), str(self.tmp / "out")])
        return code, err.getvalue()

    def test_columns_come_from_the_data_dictionary_and_match_the_simulator(self):
        tables = simulate.simulate(6, 1)
        for name in M.FILES:
            self.assertEqual(list(tables[name].columns), M.COLUMNS[name], name)

    def test_three_machines_merge_with_a_complete_manifest_and_the_pipeline_runs(self):
        code, err = self.run_merge()
        self.assertEqual(code, 0, err)
        out = self.tmp / "out"
        for name in M.FILES:
            merged = rows(out / f"{name}.csv")
            self.assertEqual(merged[0], M.COLUMNS[name])
            parts = [M.read_bundle(p).tables[name][1] for p in sorted(self.b, key=lambda p: p.name)]
            self.assertEqual(merged[1:], [r for part in parts for r in part], name)
        man = rows(out / "manifest.csv")
        total = sum(len(rows(out / f"{n}.csv")) - 1 for n in M.FILES)
        self.assertEqual(len(man) - 1, total)
        self.assertEqual({r[2] for r in man[1:]}, {"lab-pc-01.zip", "lab-pc-02.zip", "lab-pc-03"})
        self.assertTrue((out / "SIMULATED").exists())
        res = A.run(out, self.tmp / "analysis")
        self.assertEqual(res["design"]["n_analysed"], sum(1 for r in rows(out / "participants.csv")[1:] if r[8] == "1" and r[7] == "0"))

    def test_a_participant_code_collision_is_reported_and_nothing_is_written(self):
        p3 = self.src / "lab-pc-03" / "participants.csv"
        lines = p3.read_text().splitlines()
        other = M.read_bundle(self.b[0]).tables["participants"][1][0][0]
        lines[1] = other + lines[1][lines[1].index(","):]
        p3.write_text("\n".join(lines) + "\n")
        code, err = self.run_merge()
        self.assertEqual(code, 1)
        self.assertIn(f"participant code collision: {other} is in both lab-pc-01.zip and lab-pc-03", err)
        self.assertFalse((self.tmp / "out").exists())

    def test_a_column_mismatch_is_reported_and_nothing_is_written(self):
        t = self.src / "lab-pc-03" / "tlx.csv"
        lines = [l.rsplit(",", 1)[0] for l in t.read_text().splitlines()]  # drop the last column (frustration)
        t.write_text("\n".join(lines) + "\n")
        code, err = self.run_merge()
        self.assertEqual(code, 1)
        self.assertIn("lab-pc-03: tlx.csv columns do not match the data dictionary (missing ['frustration'])", err)
        self.assertFalse((self.tmp / "out").exists())

    def test_simulated_and_real_exports_are_never_mixed(self):
        (self.src / "lab-pc-03" / "SIMULATED").unlink()
        code, err = self.run_merge()
        self.assertEqual(code, 1)
        self.assertIn("mixed simulated and real exports", err)


if __name__ == "__main__":
    unittest.main()
