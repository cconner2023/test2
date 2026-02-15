#!/usr/bin/env bash
# =============================================================================
# PackageBackEnd - Development Environment Setup
# =============================================================================
# This script installs dependencies and starts the development server.
# Run this script from the project root directory.
#
# Usage:
#   chmod +x init.sh
#   ./init.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} PackageBackEnd - Dev Environment Setup ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}ERROR: Node.js 18+ required. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js $(node -v) ✓${NC}"

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}ERROR: npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}npm $(npm -v) ✓${NC}"

# Check for .env.local file (Vite loads this automatically)
# Note: .env at project root may be a directory containing .env.example.
# We use .env.local which Vite loads with higher priority.
echo ""
echo -e "${YELLOW}Checking environment configuration...${NC}"
if [ -f ".env.local" ]; then
    echo -e "${GREEN}.env.local file found ✓${NC}"
elif [ -f ".env" ] && [ ! -d ".env" ]; then
    echo -e "${GREEN}.env file found ✓${NC}"
elif [ -f ".env/.env.example" ]; then
    echo -e "${YELLOW}No .env.local file found. Creating from .env/.env.example...${NC}"
    cp ".env/.env.example" ".env.local"
    echo -e "${GREEN}.env.local created from template ✓${NC}"
    echo -e "${YELLOW}NOTE: Review .env.local and update Supabase credentials if needed.${NC}"
else
    echo -e "${RED}WARNING: No environment file found.${NC}"
    echo -e "${RED}Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY${NC}"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}Dependencies installed ✓${NC}"

# Install @supabase/supabase-js if not present
if ! npm list @supabase/supabase-js &> /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}Installing Supabase client...${NC}"
    npm install @supabase/supabase-js
    echo -e "${GREEN}Supabase client installed ✓${NC}"
fi

# Install idb (IndexedDB wrapper) if not present
if ! npm list idb &> /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}Installing IndexedDB wrapper (idb)...${NC}"
    npm install idb
    echo -e "${GREEN}idb installed ✓${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Starting development server...${NC}"
echo -e "${BLUE}App will be available at: http://localhost:5173/test2/${NC}"
echo ""
echo -e "${YELLOW}Controls:${NC}"
echo -e "  Press ${GREEN}Ctrl+C${NC} to stop the server"
echo -e "  Run ${GREEN}./init.sh${NC} to restart"
echo ""

# Start the development server
npm run dev
