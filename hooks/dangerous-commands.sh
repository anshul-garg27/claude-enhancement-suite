#!/usr/bin/env bash
# Dangerous Command Guard
# Blocks bash commands that could cause catastrophic damage.
# Exit 2 = block the tool call. Exit 0 = allow.

set -euo pipefail

TOOL_INPUT=$(cat)

# Extract the command from JSON tool input
COMMAND=$(echo "$TOOL_INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/p' | head -1 2>/dev/null || true)

if [ -z "$COMMAND" ]; then
  # Try to use the raw input as the command
  COMMAND="$TOOL_INPUT"
fi

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Normalize: lowercase for case-insensitive matching on SQL keywords
COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# --- Catastrophic deletes ---
if echo "$COMMAND" | grep -qE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+/\s*$|rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+/[^a-zA-Z]|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+/\s*$|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+/[^a-zA-Z]'; then
  echo "BLOCKED: 'rm -rf /' detected. This would delete the entire filesystem."
  exit 2
fi

if echo "$COMMAND" | grep -qE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+~/|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+~/|rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+~\s*$|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+~\s*$'; then
  echo "BLOCKED: 'rm -rf ~' detected. This would delete your entire home directory."
  exit 2
fi

# --- Database destruction ---
if echo "$COMMAND_LOWER" | grep -qE 'drop\s+database'; then
  echo "BLOCKED: 'DROP DATABASE' detected. Database destruction must be performed manually."
  exit 2
fi

if echo "$COMMAND_LOWER" | grep -qE 'drop\s+table'; then
  echo "BLOCKED: 'DROP TABLE' detected. Table destruction must be performed manually."
  exit 2
fi

# --- Force push to main/master ---
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force.*\s+(main|master)|git\s+push\s+.*-f.*\s+(main|master)|git\s+push\s+--force.*\s+origin\s+(main|master)|git\s+push\s+-f.*\s+origin\s+(main|master)'; then
  echo "BLOCKED: Force push to main/master detected. This rewrites shared history."
  exit 2
fi

# Also catch: git push --force (when on main/master, pattern: push --force without explicit branch often targets current)
if echo "$COMMAND" | grep -qE 'git\s+push\s+--force-with-lease\s+origin\s+(main|master)|git\s+push\s+--force\s+origin\s+(main|master)'; then
  echo "BLOCKED: Force push to main/master detected. This rewrites shared history."
  exit 2
fi

# --- Docker nuclear option ---
if echo "$COMMAND" | grep -qE 'docker\s+system\s+prune\s+-a|docker\s+system\s+prune\s+--all'; then
  echo "BLOCKED: 'docker system prune -a' removes ALL unused images, containers, networks. Run manually if intended."
  exit 2
fi

# --- Insecure permissions ---
if echo "$COMMAND" | grep -qE 'chmod\s+777'; then
  echo "BLOCKED: 'chmod 777' sets world-readable/writable/executable permissions. Use more restrictive permissions."
  exit 2
fi

# --- Pipe to shell (remote code execution) ---
if echo "$COMMAND" | grep -qE 'curl\s+.*\|\s*(sh|bash|zsh)|wget\s+.*\|\s*(sh|bash|zsh)'; then
  echo "BLOCKED: Piping remote content to shell detected. Download first, review, then execute."
  exit 2
fi

if echo "$COMMAND" | grep -qE 'curl\s+.*\|\s*sudo\s+(sh|bash|zsh)|wget\s+.*\|\s*sudo\s+(sh|bash|zsh)'; then
  echo "BLOCKED: Piping remote content to shell with sudo detected. This is extremely dangerous."
  exit 2
fi

# --- Git reset --hard ---
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  echo "BLOCKED: 'git reset --hard' detected. This discards all uncommitted changes permanently."
  exit 2
fi

# --- Terraform destroy ---
if echo "$COMMAND" | grep -qE 'terraform\s+destroy'; then
  echo "BLOCKED: 'terraform destroy' detected. Infrastructure destruction must be performed manually."
  exit 2
fi

# --- Kubernetes namespace deletion ---
if echo "$COMMAND" | grep -qE 'kubectl\s+delete\s+namespace|kubectl\s+delete\s+ns\s'; then
  echo "BLOCKED: 'kubectl delete namespace' detected. Namespace deletion removes all resources within it."
  exit 2
fi

# --- npm publish ---
if echo "$COMMAND" | grep -qE 'npm\s+publish'; then
  echo "BLOCKED: 'npm publish' detected. Package publishing must be performed manually or through CI/CD."
  exit 2
fi

# --- Docker remove all containers ---
if echo "$COMMAND" | grep -qE 'docker\s+rm\s+-f\s+\$\(docker\s+ps'; then
  echo "BLOCKED: 'docker rm -f \$(docker ps ...)' detected. Mass container removal must be performed manually."
  exit 2
fi

# --- SQL TRUNCATE TABLE ---
if echo "$COMMAND_LOWER" | grep -qE 'truncate\s+table'; then
  echo "BLOCKED: 'TRUNCATE TABLE' detected. Table truncation must be performed manually."
  exit 2
fi

# --- SQL DELETE FROM without WHERE ---
if echo "$COMMAND_LOWER" | grep -qE 'delete\s+from\s+[a-z_]+\s*$|delete\s+from\s+[a-z_]+\s*;'; then
  echo "BLOCKED: 'DELETE FROM' without WHERE clause detected. Unrestricted DELETE must be performed manually."
  exit 2
fi

# All checks passed
exit 0
