#!/usr/bin/env python3
"""Append behavior-learning entries to learning.md in a repository root."""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path


def build_entry(trigger: str, pattern: str, action: str) -> str:
    today = date.today().isoformat()
    lines = [
        f"## Learning Entry - {today}",
        f"- Date: {today}",
        f"- Trigger: {trigger.strip()}",
        f"- Pattern: {pattern.strip()}",
        f"- Action: {action.strip()}",
        "",
    ]
    return "\n".join(lines)


def append_learning(repo_root: Path, trigger: str, pattern: str, action: str) -> Path:
    learning_path = repo_root / "learning.md"
    entry = build_entry(trigger=trigger, pattern=pattern, action=action)

    if learning_path.exists():
        content = learning_path.read_text(encoding="utf-8")
        prefix = "" if content.endswith("\n\n") else "\n" if content.endswith("\n") else "\n\n"
        learning_path.write_text(content + prefix + entry, encoding="utf-8")
    else:
        header = "# Behavior Learning Log\n\n"
        learning_path.write_text(header + entry, encoding="utf-8")

    return learning_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Append a behavior-learning entry to learning.md in the repository root."
    )
    parser.add_argument("--repo-root", required=True, help="Absolute or relative repository root path")
    parser.add_argument("--trigger", required=True, help="Short factual trigger description")
    parser.add_argument("--pattern", required=True, help="Abstract reusable behavior rule")
    parser.add_argument("--action", required=True, help="Concrete future action")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).expanduser().resolve()

    if not repo_root.exists() or not repo_root.is_dir():
        raise SystemExit(f"Invalid --repo-root directory: {repo_root}")

    learning_path = append_learning(
        repo_root=repo_root,
        trigger=args.trigger,
        pattern=args.pattern,
        action=args.action,
    )
    print(str(learning_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
