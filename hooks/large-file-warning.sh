#!/usr/bin/env bash
# Large File Warning
# Warns (does not block) when writing files > 500 lines.
# Exit 1 = warn but allow. Exit 0 = allow silently.

set -euo pipefail

TOOL_INPUT=$(cat)

# Extract file_path from JSON tool input
FILE_PATH=$(echo "$TOOL_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 2>/dev/null || true)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check if the file exists and count its lines
if [ -f "$FILE_PATH" ]; then
  LINE_COUNT=$(wc -l < "$FILE_PATH" 2>/dev/null | tr -d ' ' || echo "0")
  if [ "$LINE_COUNT" -gt 500 ]; then
    echo "WARNING: '$FILE_PATH' has $LINE_COUNT lines (>500). Consider splitting into smaller modules."
    exit 1
  fi
fi

# For new files, try to count lines in the content being written
CONTENT=$(echo "$TOOL_INPUT" | sed -n 's/.*"content"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1 2>/dev/null || true)
if [ -n "$CONTENT" ]; then
  NEWLINE_COUNT=$(printf '%s' "$CONTENT" | tr -cd '\\n' | wc -c | tr -d ' ' 2>/dev/null || echo "0")
  if [ "$NEWLINE_COUNT" -gt 500 ]; then
    echo "WARNING: Content being written has ~$NEWLINE_COUNT lines (>500). Consider splitting into smaller modules."
    exit 1
  fi
fi

exit 0
