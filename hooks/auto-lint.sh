#!/usr/bin/env bash
# Auto-Lint Check
# Runs the appropriate linter after Edit/Write operations.
# Prints warnings but always exits 0 -- lint issues should not block the workflow.

set -uo pipefail

TOOL_INPUT=$(cat)

# Extract file_path from JSON tool input
FILE_PATH=$(echo "$TOOL_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 2>/dev/null || true)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXTENSION="${FILE_PATH##*.}"

case "$EXTENSION" in
  ts|tsx|js|jsx)
    # TypeScript / JavaScript -> ESLint
    if command -v npx >/dev/null 2>&1; then
      if npx eslint --version >/dev/null 2>&1; then
        LINT_OUTPUT=$(npx eslint --no-error-on-unmatched-pattern "$FILE_PATH" 2>&1) || true
        if [ -n "$LINT_OUTPUT" ]; then
          echo "ESLint issues in $FILE_PATH:"
          echo "$LINT_OUTPUT"
        fi
      fi
    fi
    ;;

  py)
    # Python -> ruff check (preferred) or flake8 or pylint
    if command -v ruff >/dev/null 2>&1; then
      LINT_OUTPUT=$(ruff check "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "Ruff issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    elif command -v flake8 >/dev/null 2>&1; then
      LINT_OUTPUT=$(flake8 "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "Flake8 issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  go)
    # Go -> go vet
    if command -v go >/dev/null 2>&1; then
      DIR=$(dirname "$FILE_PATH")
      LINT_OUTPUT=$(cd "$DIR" && go vet ./... 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "Go vet issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  java)
    # Java -> checkstyle (if available)
    if command -v checkstyle >/dev/null 2>&1; then
      LINT_OUTPUT=$(checkstyle "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "Checkstyle issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  sql)
    # SQL -> sqlfluff lint
    if command -v sqlfluff >/dev/null 2>&1; then
      LINT_OUTPUT=$(sqlfluff lint --dialect postgres "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "SQLFluff issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  yml|yaml)
    # YAML -> yamllint
    if command -v yamllint >/dev/null 2>&1; then
      LINT_OUTPUT=$(yamllint "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "yamllint issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  sh|bash)
    # Shell -> shellcheck
    if command -v shellcheck >/dev/null 2>&1; then
      LINT_OUTPUT=$(shellcheck "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "ShellCheck issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  tf)
    # Terraform -> terraform validate
    if command -v terraform >/dev/null 2>&1; then
      DIR=$(dirname "$FILE_PATH")
      LINT_OUTPUT=$(cd "$DIR" && terraform validate 2>&1) || true
      if [ -n "$LINT_OUTPUT" ] && ! echo "$LINT_OUTPUT" | grep -q "Success"; then
        echo "Terraform validate issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  kt|kts)
    # Kotlin -> ktlint
    if command -v ktlint >/dev/null 2>&1; then
      LINT_OUTPUT=$(ktlint "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "ktlint issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;

  md)
    # Markdown -> markdownlint or prettier --check
    if command -v markdownlint >/dev/null 2>&1; then
      LINT_OUTPUT=$(markdownlint "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ]; then
        echo "markdownlint issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    elif command -v npx >/dev/null 2>&1 && npx prettier --version >/dev/null 2>&1; then
      LINT_OUTPUT=$(npx prettier --check "$FILE_PATH" 2>&1) || true
      if [ -n "$LINT_OUTPUT" ] && echo "$LINT_OUTPUT" | grep -q "would reformat"; then
        echo "Prettier issues in $FILE_PATH:"
        echo "$LINT_OUTPUT"
      fi
    fi
    ;;
esac

exit 0
