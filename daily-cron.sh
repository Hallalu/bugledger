#!/bin/zsh
# Twice-daily Bug Ledger routine (launchd: midnight + dawn).
# Always: incremental heuristic harvest of new conversation content (bugs) + deploy if changed.
# Optional deep AI pass: create ~/.bugledger-auto-daily to enable a headless `/dailyledger` run
# (reads the day's conversations in full + deep-researches + updates bugs/optimisers/security).
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
cd "$HOME/BugLedger" || exit 0
LOG="$HOME/BugLedger/daily.log"
echo "==== $(date '+%Y-%m-%d %H:%M:%S') daily routine ====" >> "$LOG"

# 1) heuristic harvest (safe, append-only) — always
/usr/local/bin/node "$HOME/BugLedger/harvest.mjs" --deploy --quiet >> "$LOG" 2>&1
echo "harvest exit: $?" >> "$LOG"

# 2) deep AI pass — opt-in only (guards against burning quota / unattended edits)
if [ -f "$HOME/.bugledger-auto-daily" ] && command -v claude >/dev/null 2>&1; then
  echo "deep pass: running /dailyledger headless…" >> "$LOG"
  timeout 1800 claude -p "Run the dailyledger routine: $(cat "$HOME/.claude/commands/dailyledger.md")" >> "$LOG" 2>&1
  echo "deep pass exit: $?" >> "$LOG"
else
  echo "deep pass: skipped (create ~/.bugledger-auto-daily + install claude CLI to enable; otherwise run /dailyledger yourself)" >> "$LOG"
fi
