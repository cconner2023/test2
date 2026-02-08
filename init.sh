#!/bin/bash
# init.sh - Development environment setup for ADTMC (ProjectOne)
# Usage: bash init.sh

set -e

echo "========================================="
echo "  ADTMC - Development Environment Setup"
echo "========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js LTS first."
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo ""

# Verify build works
echo "Verifying build..."
npm run build
echo ""
echo "Build successful!"
echo ""

# Start dev server
echo "Starting Vite development server..."
echo ""
echo "========================================="
echo "  App will be available at:"
echo "  http://localhost:5173/ADTMC/"
echo "========================================="
echo ""
npm run dev
