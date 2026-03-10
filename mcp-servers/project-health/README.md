# Project Health MCP Server

Code health metrics for Claude Code - git activity, code complexity, dependency audits, and dead code detection.

## Tools

| Tool | Description |
|------|-------------|
| `git_activity` | Commits/day, contributors, hotspot files (most changed) |
| `git_blame_summary` | Code ownership percentages per file/directory |
| `git_recent_changes` | Recently changed files with frequency and authors |
| `dependency_audit` | Check for outdated/vulnerable deps (npm, pip, Go) |
| `code_complexity` | File counts, line counts, function counts, large files |
| `todo_scan` | Find all TODO/FIXME/HACK/XXX comments |
| `dead_code_detect` | Find exported functions never imported elsewhere |

## Setup

```bash
cd mcp-servers/project-health
npm install
```

## Claude Code Configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "project-health": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-servers/project-health/src/index.ts"],
      "env": {
        "PROJECT_DIR": "/path/to/your/project"
      }
    }
  }
}
```

Set `PROJECT_DIR` to the root of the project you want to analyze. If not set, uses the current working directory.

## Requirements

- Node.js 18+
- Git (for git-based metrics)
- Optional: `npm`, `pip-audit`, `govulncheck` for dependency auditing
