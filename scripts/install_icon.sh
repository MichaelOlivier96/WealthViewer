#!/bin/bash
# Install the desktop icon for WealthViewer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

APPLICATIONS_DIR="$HOME/.local/share/applications"
DESKTOP_DIR="$HOME/Desktop"
TARGET_DESKTOP_FILE="$APPLICATIONS_DIR/wealthviewer.desktop"

# Ensure directories exist
mkdir -p "$APPLICATIONS_DIR"

# Generate desktop entry with absolute paths for the current machine
cat <<EOF > "$TARGET_DESKTOP_FILE"
[Desktop Entry]
Name=WealthViewer
Comment=100% Offline Personal Finance Tracker
Exec=$PROJECT_DIR/scripts/start-app.sh
Icon=$PROJECT_DIR/electron/assets/appIcon.png
Terminal=false
Type=Application
Categories=Finance;Office;
Keywords=Budget;Money;Finance;Wealth;
EOF

chmod +x "$TARGET_DESKTOP_FILE"

# Copy to Desktop if directory exists
if [ -d "$DESKTOP_DIR" ]; then
    cp "$TARGET_DESKTOP_FILE" "$DESKTOP_DIR/wealthviewer.desktop"
    chmod +x "$DESKTOP_DIR/wealthviewer.desktop"
    # Mark as trusted for GNOME if gio is available
    gio set "$DESKTOP_DIR/wealthviewer.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Desktop icon installed! You can now find WealthViewer in your applications menu."
