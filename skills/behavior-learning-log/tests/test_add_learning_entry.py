from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path


class AddLearningEntryTests(unittest.TestCase):
    def run_script(self, repo_root: Path, trigger: str, pattern: str, action: str) -> subprocess.CompletedProcess[str]:
        script = Path(__file__).resolve().parents[1] / "scripts" / "add_learning_entry.py"
        return subprocess.run(
            [
                sys.executable,
                str(script),
                "--repo-root",
                str(repo_root),
                "--trigger",
                trigger,
                "--pattern",
                pattern,
                "--action",
                action,
            ],
            capture_output=True,
            text=True,
            check=True,
        )

    def test_creates_learning_file_with_header(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            self.run_script(
                tmp_path,
                trigger="First workflow attempt failed",
                pattern="Extract behavioral rule after process corrections",
                action="Write learning entry immediately",
            )

            learning = (tmp_path / "learning.md").read_text(encoding="utf-8")
            today = date.today().isoformat()

            self.assertTrue(learning.startswith("# Behavior Learning Log\n\n"))
            self.assertIn(f"## Learning Entry - {today}", learning)
            self.assertIn("- Trigger: First workflow attempt failed", learning)

    def test_appends_second_entry_without_overwriting(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            self.run_script(
                tmp_path,
                trigger="User rejected communication style",
                pattern="Generalize style feedback into explicit protocol",
                action="Adapt style in-turn and record rule",
            )
            self.run_script(
                tmp_path,
                trigger="Second event",
                pattern="Keep abstractions concise",
                action="Keep entries reusable",
            )

            learning = (tmp_path / "learning.md").read_text(encoding="utf-8")

            self.assertEqual(learning.count("## Learning Entry -"), 2)
            self.assertIn("- Trigger: User rejected communication style", learning)
            self.assertIn("- Trigger: Second event", learning)


if __name__ == "__main__":
    unittest.main()
