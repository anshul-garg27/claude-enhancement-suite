# CLAUDE.md - Project Configuration for [PROJECT_NAME]

## Identity

- **Project**: [PROJECT_NAME]
- **Description**: [ONE_LINE_DESCRIPTION]
- **Stack**: [e.g., TypeScript + Next.js + PostgreSQL + Redis]
- **Monorepo**: [yes/no]

---

## CRITICAL RULES (read first, always obey)

- NEVER commit secrets, tokens, API keys, or credentials to source control.
- NEVER run destructive database commands (DROP, TRUNCATE) without explicit user confirmation.
- NEVER force-push to main or master.
- NEVER modify lock files (package-lock.json, pnpm-lock.yaml, go.sum) by hand.
- NEVER skip tests or linting to "save time."
- ALWAYS create a new git branch for features/fixes. Never commit directly to main.

---

## Project Structure

```
[PROJECT_ROOT]/
  src/                    # [DESCRIPTION]
    [MODULE_A]/           # [DESCRIPTION]
    [MODULE_B]/           # [DESCRIPTION]
  tests/                  # [DESCRIPTION]
  scripts/                # Build/deploy scripts
  infra/                  # [Terraform/CDK/Docker configs]
  docs/                   # Documentation
  .env.example            # Template for environment variables
```

**Key entry points:**
- App: `[e.g., src/main.ts, src/index.ts, cmd/server/main.go]`
- Config: `[e.g., src/config.ts, settings.py]`
- Routes: `[e.g., src/routes/, src/api/]`
- Database: `[e.g., src/db/, prisma/schema.prisma, migrations/]`

---

## Commands

```bash
# Development
[INSTALL_CMD]             # e.g., pnpm install
[DEV_CMD]                 # e.g., pnpm dev
[BUILD_CMD]               # e.g., pnpm build

# Testing
[TEST_CMD]                # e.g., pnpm test
[TEST_SINGLE_CMD]         # e.g., pnpm test -- path/to/file
[TEST_COVERAGE_CMD]       # e.g., pnpm test:coverage

# Linting & Formatting
[LINT_CMD]                # e.g., pnpm lint
[FORMAT_CMD]              # e.g., pnpm format

# Database
[DB_MIGRATE_CMD]          # e.g., pnpm prisma migrate dev
[DB_SEED_CMD]             # e.g., pnpm prisma db seed
[DB_RESET_CMD]            # e.g., pnpm prisma migrate reset

# Docker
[DOCKER_UP_CMD]           # e.g., docker compose up -d
[DOCKER_DOWN_CMD]         # e.g., docker compose down

# Deployment
[DEPLOY_CMD]              # e.g., ./scripts/deploy.sh staging
```

---

## Coding Conventions

### TypeScript / JavaScript
- Strict mode enabled. No `any` unless explicitly justified with a comment.
- Use `interface` for object shapes, `type` for unions/intersections.
- Prefer `const` over `let`. Never use `var`.
- Use named exports, not default exports.
- Error handling: always catch and type errors. Never swallow exceptions silently.
- Async: use async/await, not raw promises or callbacks.
- Naming: `camelCase` for variables/functions, `PascalCase` for types/classes/components, `UPPER_SNAKE` for constants.
- Imports: group as stdlib -> external -> internal -> relative. Blank line between groups.
- Max file length: 300 lines. If longer, split into modules.

### Python
- Target Python [3.11+/3.12+].
- Use type hints on all function signatures.
- Follow PEP 8. Use `ruff` for linting and formatting.
- Prefer dataclasses or Pydantic models over plain dicts for structured data.
- Naming: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE` for constants.
- Use `pathlib.Path` instead of `os.path`.
- Use f-strings for string formatting. No `%` or `.format()`.
- Always specify `encoding='utf-8'` when opening files.

### Go
- Follow standard Go conventions. Run `gofmt` and `go vet`.
- Error handling: always check returned errors. Never use `_` to discard errors.
- Naming: `camelCase` exported = `PascalCase`, unexported = `camelCase`.
- Use `context.Context` as first parameter for functions that do I/O.
- Prefer table-driven tests.
- Keep interfaces small (1-3 methods).

### Java
- Follow Google Java Style Guide.
- Use records for immutable data carriers.
- Prefer `Optional` over null returns.
- Use `var` for local variables when the type is obvious from context.
- Naming: `camelCase` methods/variables, `PascalCase` classes, `UPPER_SNAKE` constants.

### SQL (PostgreSQL)
- Use lowercase for SQL keywords in application code. Use UPPERCASE in standalone SQL files.
- Always use parameterized queries. NEVER concatenate user input into SQL strings.
- Name migrations sequentially: `NNNN_description.sql`.
- Use transactions for multi-statement operations.
- Add indexes for foreign keys and frequently queried columns.

---

## Git Workflow

- **Branch naming**: `[TYPE]/[TICKET_ID]-short-description`
  - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `infra`
  - Example: `feat/PROJ-123-add-user-auth`
- **Commit messages**: `[type](scope): description` (conventional commits)
  - Example: `feat(auth): add JWT refresh token rotation`
- **Before committing**: run `[LINT_CMD]` and `[TEST_CMD]`.
- **PR requirements**: tests pass, no lint errors, description includes what + why.
- **Never rebase shared branches.** Use merge commits for main.

---

## Testing Requirements

- **Minimum coverage**: [e.g., 80%] for new code.
- **Test file location**: `[e.g., next to source as *.test.ts, or in tests/ directory]`
- **Test naming**: `describe('ModuleName', () => { it('should do X when Y', ...) })`
- **What to test**:
  - All public API functions.
  - Edge cases: empty inputs, nulls, boundary values, error paths.
  - Database queries: use [test database / test containers / mocks].
  - API endpoints: test status codes, response shapes, auth checks.
- **What NOT to test**: private implementation details, trivial getters/setters, third-party library internals.
- **Mocking policy**: mock external services (APIs, S3, email), do not mock the module under test.

---

## Security Rules

- Store secrets in environment variables or a secrets manager. Never in code.
- Validate and sanitize all external input (API params, form data, URL params).
- Use parameterized queries for all database operations.
- Apply principle of least privilege for IAM roles and database users.
- Enable CORS only for known origins. Never use `*` in production.
- Hash passwords with bcrypt/argon2. Never store plaintext.
- Set secure HTTP headers: HSTS, CSP, X-Frame-Options.
- All API endpoints must have authentication and authorization checks.
- Log security events (failed logins, permission denials) but never log secrets.

---

## File Organization Patterns

When creating new files, follow these patterns:

| What | Where | Example |
|---|---|---|
| API route | `[src/api/resource/]` | `src/api/users/route.ts` |
| Service/business logic | `[src/services/]` | `src/services/auth.service.ts` |
| Database queries | `[src/db/queries/]` | `src/db/queries/users.ts` |
| Types/interfaces | `[src/types/]` | `src/types/user.ts` |
| Utilities | `[src/utils/]` | `src/utils/date.ts` |
| React components | `[src/components/]` | `src/components/Button/index.tsx` |
| Tests | `[alongside source or tests/]` | `src/services/auth.service.test.ts` |
| Migrations | `[migrations/ or prisma/migrations/]` | `migrations/0042_add_audit_log.sql` |
| Scripts | `scripts/` | `scripts/seed-data.ts` |
| Config | project root or `config/` | `tsconfig.json`, `config/redis.ts` |

---

## Performance Considerations

- Use database indexes for all WHERE, JOIN, and ORDER BY columns.
- Paginate all list endpoints. Default page size: [e.g., 20]. Max: [e.g., 100].
- Cache expensive computations and frequent reads in Redis with appropriate TTLs.
- Use connection pooling for databases (e.g., PgBouncer, built-in pool).
- Lazy-load heavy modules and components.
- Use batch operations instead of N+1 queries.
- Set timeouts on all external HTTP calls.
- For Docker: use multi-stage builds, minimize image layers, pin base image versions.

---

## Anti-Patterns (NEVER do these)

- Do not use `console.log` for production logging. Use a structured logger.
- Do not catch errors just to re-throw them without adding context.
- Do not store state in global variables.
- Do not use magic numbers or strings. Define named constants.
- Do not write functions longer than 50 lines. Decompose into smaller functions.
- Do not use `setTimeout` or polling as a substitute for proper event handling.
- Do not copy-paste code. Extract shared logic into utility functions.
- Do not ignore TypeScript/linter errors with `@ts-ignore` or `eslint-disable` without a justifying comment.
- Do not write tests that depend on execution order or external state.
- Do not use `*` imports. Always import specific names.

---

## Environment-Specific Notes

### Docker
- Dev: `docker-compose.yml` -- includes hot-reload volumes.
- Test: `docker-compose.test.yml` -- ephemeral databases, isolated network.
- Prod: `docker-compose.prod.yml` -- DO NOT edit directly. Changes go through CI/CD.

### AWS
- Region: `[e.g., us-east-1]`
- Infra-as-code: `[Terraform/CDK/CloudFormation]` in `infra/` directory.
- Deployment: [describe CI/CD pipeline briefly].

### Databases
- PostgreSQL: primary datastore. Schema managed by [Prisma/TypeORM/raw migrations].
- MongoDB: [used for X, if applicable].
- Redis: caching layer + session store. Key prefix: `[APP_PREFIX]:`.

---

## Triggers

When you see these patterns, take the specified action:

- **"add a new API endpoint"** -> Create route + service + types + tests + migration (if needed).
- **"fix a bug"** -> Write a failing test first, then fix, then verify test passes.
- **"refactor"** -> Ensure tests pass before AND after. No behavior changes.
- **"add a dependency"** -> Check bundle size impact. Prefer well-maintained packages with >1k GitHub stars.
- **"database change"** -> Create a migration file. Never modify the database schema directly.
- **"new component"** -> Create component + types + tests + story (if Storybook is used).
- **"optimize"** -> Measure first with benchmarks/profiling. No premature optimization.
