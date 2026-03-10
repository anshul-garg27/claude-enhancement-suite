#!/usr/bin/env bash
# Auto-Format on File Write
# Runs the appropriate formatter after Edit/Write operations.
# Always exits 0 -- formatting failures should not block the workflow.

set -uo pipefail

TOOL_INPUT=$(cat)

# Extract file_path from JSON tool input
FILE_PATH=$(echo "$TOOL_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 2>/dev/null || true)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXTENSION="${FILE_PATH##*.}"

case "$EXTENSION" in
  ts|tsx|js|jsx|json|css|scss|html)
    # TypeScript / JavaScript / Web files -> Prettier
    if command -v npx >/dev/null 2>&1; then
      # Check if prettier is available in the project
      if npx prettier --version >/dev/null 2>&1; then
        npx prettier --write "$FILE_PATH" 2>/dev/null || true
      fi
    fi
    ;;

  py)
    # Python -> ruff format (preferred) or black
    if command -v ruff >/dev/null 2>&1; then
      ruff format "$FILE_PATH" 2>/dev/null || true
    elif command -v black >/dev/null 2>&1; then
      black --quiet "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  go)
    # Go -> gofmt
    if command -v gofmt >/dev/null 2>&1; then
      gofmt -w "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  java)
    # Java -> google-java-format
    if command -v google-java-format >/dev/null 2>&1; then
      google-java-format -i "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  rs)
    # Rust -> rustfmt
    if command -v rustfmt >/dev/null 2>&1; then
      rustfmt "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  sql)
    # SQL -> pg_format or sqlfluff
    if command -v pg_format >/dev/null 2>&1; then
      pg_format -i "$FILE_PATH" 2>/dev/null || true
    elif command -v sqlfluff >/dev/null 2>&1; then
      sqlfluff fix --dialect postgres "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  yml|yaml)
    # YAML -> yamlfmt or prettier
    if command -v yamlfmt >/dev/null 2>&1; then
      yamlfmt "$FILE_PATH" 2>/dev/null || true
    elif command -v npx >/dev/null 2>&1 && npx prettier --version >/dev/null 2>&1; then
      npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  sh|bash)
    # Shell -> shfmt
    if command -v shfmt >/dev/null 2>&1; then
      shfmt -w "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  tf)
    # Terraform -> terraform fmt
    if command -v terraform >/dev/null 2>&1; then
      terraform fmt "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  kt|kts)
    # Kotlin -> ktlint
    if command -v ktlint >/dev/null 2>&1; then
      ktlint -F "$FILE_PATH" 2>/dev/null || true
    fi
    ;;

  md)
    # Markdown -> prettier
    if command -v npx >/dev/null 2>&1 && npx prettier --version >/dev/null 2>&1; then
      npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
