#!/bin/bash
# =============================================================================
# PackageBackEnd - Development Environment Setup Script
# =============================================================================
# This script sets up and starts the development environment for the
# ADTMC MEDCOM PAM 40-7-21 medical triage PWA with Supabase backend.
# =============================================================================

set -e

PROJECT_DIR="$(dirname "$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")")"
APP_DIR="$PROJECT_DIR/my-project"
PORT="${PORT:-5173}"

echo "============================================"
echo " PackageBackEnd - Dev Environment Setup"
echo "============================================"
echo ""

# ---------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------
echo "[1/5] Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+."
    echo "  Download: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi
echo "  Node.js $(node -v) .............. OK"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    exit 1
fi
echo "  npm $(npm -v) ................... OK"

# ---------------------------------------------------------
# 2. Check environment variables
# ---------------------------------------------------------
echo ""
echo "[2/5] Checking environment configuration..."

if [ ! -f "$APP_DIR/.env" ]; then
    if [ -f "$APP_DIR/.env.example" ]; then
        echo "  WARNING: .env file not found. Copying from .env.example..."
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        echo "  Please update $APP_DIR/.env with your Supabase credentials."
    else
        echo "  WARNING: No .env file found. Creating template..."
        cat > "$APP_DIR/.env" << 'ENVEOF'
# Supabase Configuration
# Get these values from your Supabase project dashboard:
# https://app.supabase.com/project/<your-project>/settings/api
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
ENVEOF
        echo "  Created $APP_DIR/.env - Please update with your Supabase credentials."
    fi
else
    echo "  .env file found ............... OK"
fi

# Validate env vars are set (not placeholder values)
if [ -f "$APP_DIR/.env" ]; then
    source "$APP_DIR/.env" 2>/dev/null || true
    if [ -z "$VITE_SUPABASE_URL" ] || [ "$VITE_SUPABASE_URL" = "https://your-project-ref.supabase.co" ]; then
        echo "  WARNING: VITE_SUPABASE_URL is not configured. Supabase features will not work."
    else
        echo "  VITE_SUPABASE_URL ............. OK"
    fi
    if [ -z "$VITE_SUPABASE_ANON_KEY" ] || [ "$VITE_SUPABASE_ANON_KEY" = "your-anon-key-here" ]; then
        echo "  WARNING: VITE_SUPABASE_ANON_KEY is not configured. Supabase features will not work."
    else
        echo "  VITE_SUPABASE_ANON_KEY ........ OK"
    fi
fi

# ---------------------------------------------------------
# 3. Install dependencies
# ---------------------------------------------------------
echo ""
echo "[3/5] Installing dependencies..."

if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "  Installing npm packages (this may take a minute)..."
    npm --prefix "$APP_DIR" install
else
    echo "  node_modules exists, running npm install to ensure up to date..."
    npm --prefix "$APP_DIR" install
fi
echo "  Dependencies installed ......... OK"

# ---------------------------------------------------------
# 4. Kill any existing dev server on the port
# ---------------------------------------------------------
echo ""
echo "[4/5] Preparing to start dev server..."

# Kill existing process on PORT if any
if command -v lsof &> /dev/null; then
    EXISTING_PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$EXISTING_PID" ]; then
        echo "  Killing existing process on port $PORT (PID: $EXISTING_PID)..."
        kill -9 $EXISTING_PID 2>/dev/null || true
        sleep 2
    fi
elif command -v netstat &> /dev/null; then
    # Windows / systems without lsof
    echo "  Checking port $PORT availability..."
fi

# ---------------------------------------------------------
# 5. Start the development server
# ---------------------------------------------------------
echo ""
echo "[5/5] Starting Vite development server..."
echo ""
echo "============================================"
echo " Starting on http://localhost:$PORT"
echo "============================================"
echo ""
echo " Tech Stack:"
echo "   Frontend: React + TypeScript + Vite"
echo "   Styling:  Tailwind CSS"
echo "   Backend:  Supabase (PostgreSQL)"
echo "   PWA:      Service Worker + Cache API"
echo ""
echo " Useful commands:"
echo "   npm --prefix $APP_DIR run build    # Production build"
echo "   npm --prefix $APP_DIR run preview  # Preview production build"
echo "   npm --prefix $APP_DIR run lint     # Run ESLint"
echo ""
echo " Press Ctrl+C to stop the server."
echo "============================================"
echo ""

npm --prefix "$APP_DIR" run dev -- --port "$PORT" --host
