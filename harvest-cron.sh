#!/bin/zsh
# Hourly Bug Ledger harvester wrapper (invoked by launchd).
# Mines new conversation content for bug fixes, rebuilds, and deploys+pushes only if something changed.
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
cd "$HOME/BugLedger" || exit 0
LOG="$HOME/BugLedger/harvest.log"
echo "==== $(date '+%Y-%m-%d %H:%M:%S') harvest run ====" >> "$LOG"
/usr/local/bin/node "$HOME/BugLedger/harvest.mjs" --deploy --quiet >> "$LOG" 2>&1
echo "exit: $?" >> "$LOG"
