---
name: behavior-learning-log
description: Capture and persist assistant behavior-level learnings when a first approach fails, when the user rejects the assistant's approach/style, or when workflow guidance clarifies how the assistant should operate. Use when feedback is about process, communication, sequencing, or decision-making behavior rather than product code defects.
---

# Behavior Learning Log

## Goal

Persist reusable behavior learnings in `learning.md` at the current repository root so future runs follow the user's preferred collaboration style.

## Workflow

1. Detect a behavior-learning event.
2. Distill the event into an abstract rule.
3. Append a structured entry to `learning.md`.
4. Apply the rule immediately in the ongoing task.

## Detect Behavior-Learning Events

Treat an interaction as a behavior-learning event when at least one condition is true:
- The assistant tried an approach and it did not work, then discovered the correct process.
- The user said they dislike how the assistant handled process/style (not the business code outcome itself).
- The user clarified a preferred working method that should shape future behavior.

Do not log entries for normal code bug fixes unless the user feedback is explicitly about assistant behavior (for example: sequencing, communication style, scope control, testing discipline).

## Entry Requirements

Each entry must include:
- `Date`: Current date in ISO format (`YYYY-MM-DD`).
- `Trigger`: Short factual description of what happened.
- `Pattern`: Abstract behavior rule that generalizes beyond the single incident.
- `Action`: Concrete instruction for future assistant behavior.

Keep entries concise and reusable. Avoid task-specific implementation details.

## Write Entries

Use the helper script for deterministic formatting:

```bash
python3 skills/behavior-learning-log/scripts/add_learning_entry.py \
  --repo-root "$(pwd)" \
  --trigger "User rejected my initial process" \
  --pattern "When process feedback appears, extract the underlying collaboration rule" \
  --action "Write a learning entry immediately and adapt behavior in the same turn"
```

If `learning.md` does not exist, create it with a top-level title.
If it exists, append the new entry without rewriting prior content.
