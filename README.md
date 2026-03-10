# Claude Enhancement Suite

A complete toolkit to supercharge Claude Code CLI - custom skills, specialized agents, MCP servers, safety hooks, and optimized configuration.

## Quick Start

### 1. Copy skills to your project
```bash
cp -r .claude/skills/* /path/to/your/project/.claude/skills/
```

### 2. Copy agents globally
```bash
cp .claude/agents/* ~/.claude/agents/
```

### 3. Install MCP servers
```bash
# Database Explorer
cd mcp-servers/db-explorer && npm install

# Docker Manager
cd mcp-servers/docker-manager && npm install

# Project Health
cd mcp-servers/project-health && npm install
```

### 4. Add MCP servers to settings
Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "db-explorer": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-servers/db-explorer/src/index.ts"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/mydb",
        "MONGODB_URL": "mongodb://localhost:27017/mydb",
        "REDIS_URL": "redis://localhost:6379"
      }
    },
    "docker-manager": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-servers/docker-manager/src/index.ts"]
    },
    "project-health": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-servers/project-health/src/index.ts"],
      "env": { "PROJECT_DIR": "/path/to/project" }
    }
  }
}
```

### 5. Set up hooks
```bash
cp .claude/settings.json /path/to/your/project/.claude/settings.json
cp -r hooks/ /path/to/your/project/hooks/
chmod +x hooks/*.sh
```

### 6. Adapt CLAUDE.md
Copy `CLAUDE.md` to your project root and fill in the `[PLACEHOLDER]` values.

## What's Included

### Skills (invoke with `/skill-name`)
| Skill | Command | Description |
|-------|---------|-------------|
| TDD | `/tdd` | Red-Green-Refactor cycle with subagent isolation |
| Code Review | `/smart-review` | 3-agent parallel review (security, perf, quality) |
| Deploy | `/deploy` | Safe deployment with pre-checks and verification |
| Debug | `/systematic-debug` | Hypothesis-driven bug hunting |
| Scaffold | `/scaffold` | Project boilerplate generator |
| Refactor | `/safe-refactor` | Incremental refactoring with safety nets |

### Agents (auto-selected or via Agent tool)
| Agent | Model | Purpose |
|-------|-------|---------|
| Architect | Opus | System design and architecture analysis |
| Reviewer | Sonnet | Code review (security, perf, quality) |
| Tester | Sonnet | Test writing and coverage analysis |
| Debugger | Opus | Root cause analysis and bug tracing |
| DevOps | Sonnet | Infrastructure and CI/CD |
| Security | Opus | Vulnerability scanning and audit |

### MCP Servers (read-only, safe by design)
| Server | Tools | Description |
|--------|-------|-------------|
| db-explorer | 9 tools | PostgreSQL, MongoDB, Redis inspection |
| docker-manager | 7 tools | Container monitoring and inspection |
| project-health | 7 tools | Git metrics, code complexity, dead code |

### Hooks (automatic safety + formatting)
| Hook | Type | Description |
|------|------|-------------|
| Protected Files | PreToolUse | Block edits to .env, lock files, secrets |
| Dangerous Commands | PreToolUse | Block rm -rf, DROP TABLE, force push |
| Auto Format | PostToolUse | Prettier/Black/gofmt on save |
| Auto Lint | PostToolUse | ESLint/Ruff/go vet on save |
| Session Logger | Stop | Log changes to session-log.md |

## Files

```
claude-enhancement-suite/
├── README.md                           # This file
├── RESEARCH.md                         # 104 improvement recommendations
├── CLAUDE.md                           # Optimized project config template
├── .claude/
│   ├── settings.json                   # Hooks configuration
│   ├── skills/
│   │   ├── tdd/SKILL.md
│   │   ├── code-review/SKILL.md
│   │   ├── deploy/SKILL.md
│   │   ├── debug/SKILL.md
│   │   ├── scaffold/SKILL.md
│   │   └── refactor/SKILL.md
│   └── agents/
│       ├── architect.md
│       ├── reviewer.md
│       ├── tester.md
│       ├── debugger.md
│       ├── devops.md
│       └── security.md
├── hooks/
│   ├── protected-files.sh
│   ├── dangerous-commands.sh
│   ├── auto-format.sh
│   ├── auto-lint.sh
│   ├── large-file-warning.sh
│   └── session-logger.sh
└── mcp-servers/
    ├── db-explorer/                    # PostgreSQL + MongoDB + Redis
    ├── docker-manager/                 # Docker inspection
    └── project-health/                 # Code health metrics
```
