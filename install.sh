#!/usr/bin/env bash
# Claude Enhancement Suite - Installer
# Copies skills, agents, hooks, and configures MCP servers
set -euo pipefail

SUITE_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "==========================================="
echo "  Claude Enhancement Suite - Installer"
echo "==========================================="
echo ""

# --- 1. Install Skills ---
echo -e "${GREEN}[1/6] Installing Skills...${NC}"
SKILLS_DIR="$CLAUDE_DIR/skills"
for skill_dir in "$SUITE_DIR/.claude/skills"/*/; do
  skill_name=$(basename "$skill_dir")
  target="$SKILLS_DIR/$skill_name"
  if [ -d "$target" ]; then
    echo "  Updating: $skill_name"
  else
    echo "  Installing: $skill_name"
  fi
  mkdir -p "$target"
  cp -r "$skill_dir"* "$target/"
done
echo "  Done. 6 skills installed."
echo ""

# --- 2. Install Agents ---
echo -e "${GREEN}[2/6] Installing Agents...${NC}"
AGENTS_DIR="$CLAUDE_DIR/agents"
mkdir -p "$AGENTS_DIR"
for agent_file in "$SUITE_DIR/.claude/agents"/*.md; do
  agent_name=$(basename "$agent_file")
  cp "$agent_file" "$AGENTS_DIR/$agent_name"
  echo "  Installed: $agent_name"
done
echo "  Done. 6 agents installed."
echo ""

# --- 3. Install MCP Servers ---
echo -e "${GREEN}[3/6] Installing MCP Servers...${NC}"
for server_dir in "$SUITE_DIR/mcp-servers"/*/; do
  server_name=$(basename "$server_dir")
  if [ -f "$server_dir/package.json" ]; then
    echo "  Installing $server_name dependencies..."
    (cd "$server_dir" && npm install --silent 2>/dev/null) || {
      echo -e "  ${YELLOW}Warning: npm install failed for $server_name. Install manually.${NC}"
    }
  fi
done
echo "  Done."
echo ""

# --- 4. Install Hook Scripts ---
echo -e "${GREEN}[4/6] Installing Hook Scripts...${NC}"
echo "  Hook scripts are project-specific."
echo "  To install in a project, run:"
echo "    cp -r $SUITE_DIR/hooks/ /your/project/hooks/"
echo "    cp $SUITE_DIR/.claude/settings.json /your/project/.claude/settings.json"
echo "    chmod +x /your/project/hooks/*.sh"
echo ""

# --- 5. Copy Templates ---
echo -e "${GREEN}[5/6] Copying Templates...${NC}"
echo "  CLAUDE.md template: $SUITE_DIR/CLAUDE.md"
echo "  .claudeignore template: $SUITE_DIR/.claudeignore"
echo "  Copy these to your project root and customize."
echo ""

# --- 6. MCP Server Configuration ---
echo -e "${GREEN}[6/6] MCP Server Configuration${NC}"
echo ""
echo "Add this to your ~/.claude/settings.json under \"mcpServers\":"
echo ""
cat <<EOF
{
  "mcpServers": {
    "db-explorer": {
      "command": "npx",
      "args": ["tsx", "$SUITE_DIR/mcp-servers/db-explorer/src/index.ts"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/mydb",
        "MONGODB_URL": "mongodb://localhost:27017/mydb",
        "REDIS_URL": "redis://localhost:6379"
      }
    },
    "docker-manager": {
      "command": "npx",
      "args": ["tsx", "$SUITE_DIR/mcp-servers/docker-manager/src/index.ts"]
    },
    "project-health": {
      "command": "npx",
      "args": ["tsx", "$SUITE_DIR/mcp-servers/project-health/src/index.ts"],
      "env": {
        "PROJECT_DIR": "/path/to/your/project"
      }
    }
  }
}
EOF
echo ""

echo "==========================================="
echo -e "${GREEN}  Installation Complete!${NC}"
echo "==========================================="
echo ""
echo "Installed:"
echo "  - 6 Skills   (tdd, smart-review, deploy, systematic-debug, scaffold, safe-refactor)"
echo "  - 6 Agents   (architect, reviewer, tester, debugger, devops, security)"
echo "  - 3 MCP Servers (db-explorer, docker-manager, project-health)"
echo "  - 6 Hook Scripts (protected-files, dangerous-commands, auto-format, auto-lint, large-file-warning, session-logger)"
echo "  - Templates  (CLAUDE.md, .claudeignore)"
echo ""
echo "Next steps:"
echo "  1. Add MCP server config to ~/.claude/settings.json"
echo "  2. Copy hooks + .claude/settings.json to your project"
echo "  3. Copy CLAUDE.md to your project and fill in [PLACEHOLDER] values"
echo "  4. Copy .claudeignore to your project"
echo ""
echo "Usage:"
echo "  /tdd \"user authentication\"         # TDD workflow"
echo "  /smart-review 42                    # Review PR #42"
echo "  /deploy production                  # Safe deploy"
echo "  /systematic-debug \"TypeError...\"    # Debug a bug"
echo "  /scaffold next                      # New Next.js project"
echo "  /safe-refactor \"extract auth\"       # Safe refactoring"
