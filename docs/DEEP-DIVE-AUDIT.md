# PhD-Level Deep Dive Audit of Claude Enhancement Suite

*Audit Date: March 10, 2026 | 39 files, ~10,000 lines*

---

## CRITICAL BUGS FOUND (Must Fix)

### BUG-001: Hook Scripts Read Input Wrong (ALL 6 scripts affected)

**Severity: CRITICAL - All hooks are non-functional**

Claude Code hooks receive tool input via **stdin as JSON**, NOT as a command argument. Every hook script reads from `$1` (first argument) but the data comes on stdin.

**Current (broken):**
```json
"command": "bash hooks/protected-files.sh \"$TOOL_INPUT\""
```
```bash
TOOL_INPUT="${1:-}"
```

**Fixed:**
```json
"command": "bash hooks/protected-files.sh"
```
```bash
TOOL_INPUT=$(cat)
```

**Impact:** All 6 hooks silently do nothing. Protected files aren't protected. Dangerous commands aren't blocked. Auto-format never runs.

### BUG-002: SQL Injection Bypass in pg_query (db-explorer)

The `assertReadOnly` function has bypass vectors:

1. **String literals**: `SELECT 'DROP TABLE users'` is blocked even though it's safe (false positive)
2. **Dollar-quoted strings**: `SELECT $$DELETE FROM users$$` may bypass the check
3. **CTE mutations**: `WITH deleted AS (DELETE FROM users RETURNING *) SELECT * FROM deleted` - the regex only checks for bare keywords, not their position in CTEs
4. **No query timeout**: A `SELECT pg_sleep(3600)` or cartesian join will hang the server forever

### BUG-003: Docker Log Stream Header Parsing (docker-manager)

```typescript
logText = logText.split("\n").map((line) => (line.length > 8 ? line.slice(8) : line)).join("\n");
```

Docker multiplexed log streams use a specific 8-byte header format (1 byte stream type + 3 padding + 4 byte length). Blindly slicing 8 bytes corrupts non-multiplexed logs and mishandles binary payloads. Should use dockerode's stream demuxing utilities.

### BUG-004: Docker Inspect Leaks Secrets

The env variable filter only checks for `SECRET`, `PASSWORD`, and `KEY=`:
```typescript
env: info.Config.Env?.filter(
  (e) => !e.includes("SECRET") && !e.includes("PASSWORD") && !e.includes("KEY=")
)
```

**Misses:** `TOKEN`, `AUTH`, `CREDENTIAL`, `PRIVATE`, `AWS_SECRET_ACCESS_KEY`, `API_KEY`, `ACCESS_KEY`, `SIGNING_KEY`, `ENCRYPTION`, `BEARER`, `GITHUB_TOKEN`, `DATABASE_URL` (contains password in connection string)

### BUG-005: dead_code_detect Only Handles TypeScript/JavaScript

The `dead_code_detect` tool in project-health only scans `*.{ts,tsx,js,jsx}` files. Python, Go, and Java exports are completely ignored despite the user working in all 4 languages.

---

## SECURITY VULNERABILITIES

### SEC-001: MongoDB NoSQL Injection (db-explorer)

The `mongo_query` tool parses user-provided JSON filters directly:
```typescript
const filter = safeJsonParse(input.filter ?? "{}", "filter");
```

An attacker (or confused AI) could inject operators:
```json
{"$where": "sleep(10000)"}
{"password": {"$regex": "^a"}}
```

**Fix:** Block `$where`, `$function`, `$accumulator` operators. Sanitize `$regex` patterns.

### SEC-002: No Query Timeout on Any Database (db-explorer)

PostgreSQL, MongoDB, and Redis queries have no execution timeout. A malicious or accidental query like `SELECT * FROM generate_series(1, 1000000000)` will hang the MCP server indefinitely.

**Fix:** Add `statement_timeout` for PG, `maxTimeMS` for MongoDB, timeout option for Redis.

### SEC-003: Redis readOnly Flag is ioredis-Specific Behavior

The `readOnly: true` option in ioredis is for Redis Cluster replicas only. It does NOT prevent write commands on standalone Redis. A call to `SET key value` would succeed.

**Fix:** Add explicit command allowlist or wrap Redis instance to intercept write commands.

### SEC-004: Hook Bypass via Symlinks

Protected files check uses `basename` only. An attacker could create a symlink:
```bash
ln -s .env my-config.txt
# Claude edits my-config.txt -> bypasses protection
```

**Fix:** Resolve symlinks with `readlink -f` before checking.

### SEC-005: Dangerous Command Bypass via Command Substitution

```bash
$(cat /dev/urandom | base64 | head -c 20 > /tmp/cmd && echo "rm -rf /" >> /tmp/cmd && bash /tmp/cmd)
```

The regex-based approach can never be comprehensive. Should use an allowlist approach for production.

---

## MISSING FEATURES (Ranked by Impact)

### MISS-001: Missing Skills Power Users Need

| Skill | Description | Why Critical |
|-------|-------------|-------------|
| `/api-design` | Design REST/GraphQL APIs, generate OpenAPI specs | 80% of projects need API design |
| `/migrate` | Database migration creation + management | Every project with a DB needs this |
| `/pr-create` | Well-formatted PR creation with description + checklist | Daily workflow |
| `/document` | Generate API docs, architecture docs, README | Documentation debt is universal |
| `/performance` | Profile and optimize slow code paths | Critical for production readiness |
| `/dependency-update` | Safe dependency updates with automated testing | Security hygiene |
| `/incident` | Incident response: diagnose, mitigate, postmortem | Production operations |
| `/git-flow` | Manage feature branches, releases, hotfixes | Team workflow |

### MISS-002: Missing Agents

| Agent | Model | Why Missing Hurts |
|-------|-------|-------------------|
| `database.md` | Opus | No specialist for schema design, query optimization, migration strategy |
| `performance.md` | Sonnet | No specialist for profiling, benchmarking, optimization |
| `frontend.md` | Sonnet | No specialist for React, CSS, accessibility, responsive design |
| `documentation.md` | Haiku | No specialist for writing docs (haiku is cheaper for text generation) |
| `migration.md` | Sonnet | No specialist for framework/language/version migrations |

### MISS-003: Missing MCP Tools

**db-explorer missing:**
- `pg_explain` - EXPLAIN ANALYZE output (wrapped in a read-only transaction)
- `pg_locks` - Current lock information for debugging deadlocks
- `pg_connections` - Active connections, idle connections, waiting queries
- `pg_slow_queries` - Top queries from pg_stat_statements
- `mongo_indexes` - List indexes with usage statistics
- `redis_slowlog` - Redis slow log entries
- `redis_memory` - Memory usage analysis per key pattern

**docker-manager missing:**
- `docker_compose_config` - Parse and display docker-compose.yml (was listed but never implemented)
- `docker_health` - Health check status per container

**project-health missing:**
- `circular_deps` - Detect circular dependencies (huge maintainability win)
- `bundle_analysis` - Bundle size breakdown for frontend projects
- `license_check` - Check dependency licenses for compliance

### MISS-004: Agent Memory Not Configured

None of the 6 agents have the `memory` field set. This means:
- The architect forgets previous architectural decisions between sessions
- The reviewer forgets project-specific code review patterns
- The debugger forgets past debugging patterns and root causes

Every agent should have `memory: project` so learnings persist.

### MISS-005: No CI/CD Integration Templates

No GitHub Actions workflow, no GitLab CI template, no pre-commit hooks config. Users must configure CI manually.

### MISS-006: Skills Missing allowed-tools

Only `refactor/SKILL.md` specifies `allowed-tools`. The other 5 skills will inherit default tool access, which may be too broad or too narrow.

### MISS-007: No .env.example for MCP Servers

Users must read the README to know what env vars are needed. A `.env.example` file per server would be more discoverable.

### MISS-008: install.sh Doesn't Validate Prerequisites

No check for Node.js, npm, git, or Claude Code being installed. No backup of existing files. No uninstall option.

---

## CODE QUALITY ISSUES

### QUAL-001: auto-format.sh Performance

Running `npx prettier --version` on EVERY file write takes ~500ms. Should cache the check:
```bash
# Cache formatter availability per session
PRETTIER_AVAILABLE="${PRETTIER_AVAILABLE:-}"
if [ -z "$PRETTIER_AVAILABLE" ]; then
  if npx prettier --version >/dev/null 2>&1; then
    export PRETTIER_AVAILABLE=1
  else
    export PRETTIER_AVAILABLE=0
  fi
fi
```

### QUAL-002: session-logger.sh Detects Non-Claude Changes

Uses `find -mmin -5` which picks up files changed by ANY process, not just Claude. Could log IDE auto-saves, background builds, etc.

### QUAL-003: session-logger.sh Log Grows Unbounded

No rotation or size limit. After months of use, session-log.md could be thousands of lines.

### QUAL-004: large-file-warning.sh Checks Existing File, Not New Content

For a brand-new file, the `[ -f "$FILE_PATH" ]` check fails, so the line count check is skipped. The fallback content check using `grep -c '\\n'` counts literal `\n` strings, not actual newlines.

### QUAL-005: MCP Server Error Messages Leak Internal Paths

Error messages include full stack traces and file paths, which could expose server architecture to untrusted users.

### QUAL-006: No TypeScript Build Scripts

All 3 MCP servers lack `npm run build` in their README setup instructions. The `tsconfig.json` has `outDir: "dist"` but no one tells the user to build before running in production.

---

## CROSS-PLATFORM ISSUES

### PLAT-001: grep -oP Not Available on macOS

`protected-files.sh` line 11 uses `grep -oP` (Perl regex) which doesn't exist on macOS. The fallback on line 14-16 uses `sed` which works, but the first attempt always fails and produces stderr noise.

**Fix:** Skip the `grep -P` attempt on macOS entirely by checking `uname` first.

### PLAT-002: echo -e Not Portable

`session-logger.sh` line 84 uses `echo -e "$FILE_LIST"` which behaves differently on macOS/BSD vs Linux. On some shells, `-e` is printed literally.

**Fix:** Use `printf '%b\n' "$FILE_LIST"` instead.

### PLAT-003: find -type f Requires Capital F on Some Systems

The `find` command in `session-logger.sh` uses `-type f` which should be fine, but the earlier attempt using `find -type` without the argument caused an error in our session. Consider explicit `--` before paths.

### PLAT-004: No Windows/WSL Consideration

All hook scripts assume Unix. On WSL, paths start with `/mnt/c/` and Docker socket location differs. No guidance provided.

---

## ARCHITECTURAL IMPROVEMENTS

### ARCH-001: Hook Scripts Should Use a Shared Library

All 6 hook scripts duplicate the JSON parsing logic. Should extract into a `hooks/lib/parse-input.sh` that's sourced:
```bash
source "$(dirname "$0")/lib/parse-input.sh"
```

### ARCH-002: MCP Servers Should Support Graceful Degradation

If PostgreSQL is not configured but MongoDB is, db-explorer still tries to register PG tools and fails on first call. Should detect which databases are configured and only register available tools.

### ARCH-003: Skills Should Cross-Reference Each Other

The deploy skill should reference the TDD skill ("run /tdd before deploying"). The code-review skill should reference the security agent. Currently they're isolated silos.

### ARCH-004: Agent Team Configuration Missing

No pre-configured agent team template. Users have to manually set up `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and coordinate agents. Should provide team configs:
- **Feature team:** architect → tester → reviewer
- **Security team:** security → reviewer → devops
- **Debug team:** debugger → tester

---

## COMPLETENESS GAPS IN RESEARCH.MD

1. **Claude Code SDK** - No coverage of programmatic integration via `claude -p`
2. **Voice input** - Push-to-talk in 20 languages not mentioned
3. **Plugin architecture** - How to create and publish Claude Code plugins
4. **LSP integration** - How language servers improve code intelligence
5. **Claude Code on the web** - Cloud execution capabilities
6. **Teleport feature** - Moving sessions between terminal and web
7. **Worktree isolation** - Git worktree support for parallel development
8. **Agent team coordination** - tmux split-pane multi-agent workflows

---

## PRIORITY FIX ORDER

### P0 - Fix Today (Broken Functionality)
1. **BUG-001**: Fix all hook scripts to read from stdin
2. **BUG-002**: Add query timeout + fix SQL injection bypasses
3. **BUG-004**: Expand Docker secret filtering
4. **SEC-001**: Block MongoDB NoSQL injection operators
5. **SEC-002**: Add query timeouts to all databases

### P1 - Fix This Week (Security + Quality)
6. **SEC-003**: Fix Redis readOnly misconception
7. **SEC-004**: Resolve symlinks in protected files check
8. **MISS-004**: Add `memory: project` to all agents
9. **MISS-006**: Add `allowed-tools` to all skills
10. **QUAL-001**: Cache formatter availability checks
11. **PLAT-001**: Fix macOS grep -P noise
12. **PLAT-002**: Fix echo -e portability

### P2 - Build Next (Missing Features)
13. **MISS-001**: Build `/api-design` and `/pr-create` skills
14. **MISS-002**: Build `database.md` and `performance.md` agents
15. **MISS-003**: Add `pg_explain`, `pg_slow_queries`, `mongo_indexes` MCP tools
16. **MISS-005**: Create GitHub Actions CI template
17. **ARCH-001**: Extract shared hook library
18. **ARCH-002**: Graceful degradation for MCP servers
