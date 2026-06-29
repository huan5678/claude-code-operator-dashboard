#!/bin/bash
# Fancy CODD Dashboard Startup Script

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$HOME/claude-code-operator-dashboard"

echo "[$(date)] Starting Fancy CODD on port 3210..."
npm run dev
