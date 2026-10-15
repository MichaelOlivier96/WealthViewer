#!/bin/bash
# Script to start the WealthViewer Electron application
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../electron"
npx electron . --no-sandbox
