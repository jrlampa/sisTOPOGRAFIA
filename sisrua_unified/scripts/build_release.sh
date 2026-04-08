#!/bin/bash

# sisRUA Unified - Release Build Script (Bash)
# Cross-platform equivalent to build_release.ps1
# Works on Linux, macOS, and Windows (via WSL/Git Bash)

set -e  # Exit on error

# Colors for output (works on most terminals)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Track build start time
BUILD_START=$(date +%s)

echo ""
echo "========================================"
echo -e "${YELLOW}   ⚠️  LEGACY BUILD (Deprecated)${NC}"
echo -e "${YELLOW}   Use 'npm run docker:build' instead${NC}"
echo "========================================"
echo ""

ROOT_DIR="$(pwd)"
DIST_DIR="${ROOT_DIR}/dist"

# 1. Clean Dist Folder
echo -e "${CYAN}[1/4] Cleaning dist folder...${NC}"
if [ -d "$DIST_DIR" ]; then
    rm -rf "$DIST_DIR"
fi
mkdir -p "$DIST_DIR"
mkdir -p "$DIST_DIR/server"
mkdir -p "$DIST_DIR/engine"

# 2. Frontend Build (Vite)
echo -e "${CYAN}[2/4] Compiling Frontend (Vite)...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Frontend build failed${NC}"
    exit 1
fi

# 3. Backend Build (TypeScript)
echo -e "${CYAN}[3/4] Compiling Backend (Node.js)...${NC}"
npx tsc -p tsconfig.server.json
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Backend compilation failed${NC}"
    exit 1
fi

# 4. Python Engine (PyInstaller) - OPTIONAL
echo -e "${CYAN}[4/4] Bundling Python Engine (PyInstaller)...${NC}"
cd py_engine

# Check if PyInstaller is available
if command -v pyinstaller &> /dev/null; then
    PYCMD="pyinstaller"
elif python -m PyInstaller --version &> /dev/null 2>&1; then
    PYCMD="python -m PyInstaller"
else
    echo -e "${YELLOW}WARNING: PyInstaller not found. Skipping engine bundling.${NC}"
    PYCMD=""
fi

if [ -n "$PYCMD" ]; then
    echo -e "${CYAN}Using $PYCMD for bundling...${NC}"
    $PYCMD --noconfirm engine.spec
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Engine bundling failed${NC}"
        cd ..
        exit 1
    fi
    
    # Move compiled engine to dist
    if [ -f "dist/sisrua_engine" ]; then
        mv "dist/sisrua_engine" "$DIST_DIR/engine/"
    elif [ -f "dist/sisrua_engine.exe" ]; then
        mv "dist/sisrua_engine.exe" "$DIST_DIR/engine/"
    else
        echo -e "${RED}ERROR: Engine binary not found after build${NC}"
        cd ..
        exit 1
    fi
fi

cd ..

# Calculate duration
BUILD_END=$(date +%s)
DURATION=$((BUILD_END - BUILD_START))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "========================================"
echo -e "${GREEN}   BUILD COMPLETE! Artifacts in /dist${NC}"
echo -e "${CYAN}   Duration: ${MINUTES}m ${SECONDS}s${NC}"
echo "========================================"
echo ""
