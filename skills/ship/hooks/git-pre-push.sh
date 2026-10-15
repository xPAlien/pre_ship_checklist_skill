#!/bin/sh
# pre-ship-checklist-skill:managed git pre-push hook
# Blocks a push when the Ship preflight finds secret-like values, client-exposed secret names,
# or tracked env files in the current tracked files. Offline and read-only. It does not scan Git history.
# SHIP_PREPUSH_STRICT=1 also blocks when Python is unavailable. SHIP_PREPUSH_SKIP=1 skips once, by choice.
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
if [ "${SHIP_PREPUSH_SKIP:-0}" = "1" ]; then
  echo "ship pre-push: skipped by SHIP_PREPUSH_SKIP=1" >&2
  exit 0
fi
script="$root/.claude/hooks/ship/preflight.py"
python_bin=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then python_bin="$candidate"; break; fi
done
if [ -z "$python_bin" ] || [ ! -f "$script" ]; then
  echo "ship pre-push: Python or $script missing. Secret floor not checked." >&2
  [ "${SHIP_PREPUSH_STRICT:-0}" = "1" ] && exit 1
  exit 0
fi
"$python_bin" "$script" --root "$root" --fail-on secret --format text --only-kinds secret,public_secret_name,tracked_env >&2
status=$?
if [ "$status" -eq 1 ]; then
  echo "ship pre-push: blocked. Remove the values above, rotate any real credential, then push again." >&2
  exit 1
fi
exit 0
