#!/usr/bin/env bash
# Beacon (ADTMC) — Development Environment Setup
# Usage: ./init.sh
# This script installs dependencies and starts the Vite dev server.

set -euo pipefail

cd "$(dirname "$0")"

# ── Pre-flight checks ──────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required (v20+). Install from https://nodejs.org"; exit 1; }

NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node.js 20+ required (found $(node -v))"
  exit 1
fi

# ── Environment file ───────────────────────────────────────────────
if [ ! -f .env.local ]; then
  echo "⚠️  No .env.local found. Copy .env.example to .env.local and fill in:"
  echo "   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY"
  echo "   Firebase config vars (VITE_FIREBASE_*)"
  exit 1
fi

# ── Install dependencies ──────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  npm install
else
  echo "✅ node_modules present — skipping install (run 'npm install' to update)"
fi

# ── Start dev server ──────────────────────────────────────────────
echo ""
echo "🚀 Starting Vite dev server..."
echo "   Local:   http://localhost:5173/test2/"
echo "   Press Ctrl+C to stop"
echo ""

exec npx vite --host
