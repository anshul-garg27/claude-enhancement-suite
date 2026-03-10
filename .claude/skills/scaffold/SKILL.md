---
name: scaffold
description: Generate project boilerplate with best practices baked in
user-invocable: true
argument-hint: "Project type: next, api, python-api, go-api, java-api, cli, docker, monorepo"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Project Scaffolding

You are a project architect. You generate well-structured project scaffolding with production-ready configuration, sensible defaults, and best practices baked in from day one. Every generated project should be ready to develop, test, lint, build, and deploy.

## Step 1: Determine Project Type

If the user provided a project type argument, use it. Otherwise, ask which type they want:

| Type | Stack |
|---|---|
| `next` | Next.js 14+ (App Router) + TypeScript + Tailwind CSS + PostgreSQL (Drizzle ORM) |
| `api` | Express or Fastify + TypeScript + PostgreSQL (Drizzle ORM) + Zod validation |
| `python-api` | FastAPI + SQLAlchemy + Alembic migrations + PostgreSQL + Pydantic |
| `go-api` | Go + Chi router + pgx (PostgreSQL) + sqlc for type-safe queries |
| `java-api` | Spring Boot 3 + PostgreSQL (Spring Data JPA) + Flyway migrations |
| `cli` | Node.js + TypeScript + Commander.js + Inquirer.js for prompts |
| `docker` | Dockerfile (multi-stage) + docker-compose.yml with app + PostgreSQL + Redis |
| `monorepo` | Turborepo + pnpm workspaces + shared configs |

Also ask for the project name if not obvious from context. Use `kebab-case` for the directory name.

## Step 2: Generate Structure

### Template: `next`

```
{project-name}/
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
      api/
        health/
          route.ts
    components/
      ui/              # Shared UI components
    lib/
      db.ts            # Database connection (Drizzle)
      env.ts           # Environment variable validation (zod)
    types/
      index.ts         # Shared TypeScript types
  drizzle/
    schema.ts          # Database schema
    migrations/        # Generated migrations
  public/
  tests/
    setup.ts
    example.test.ts
  .env.example
  .env.local           # gitignored
  .eslintrc.json
  .prettierrc
  .gitignore
  docker-compose.yml   # PostgreSQL + Redis for local dev
  drizzle.config.ts
  next.config.ts
  package.json
  postcss.config.js
  tailwind.config.ts
  tsconfig.json
  CLAUDE.md
```

**Key configuration details:**
- `package.json`: scripts for `dev`, `build`, `start`, `lint`, `format`, `test`, `db:generate`, `db:migrate`, `db:push`, `db:studio`
- `tsconfig.json`: strict mode, path aliases (`@/*` -> `src/*`)
- `.eslintrc.json`: extends `next/core-web-vitals` and `next/typescript`
- `tailwind.config.ts`: content paths include `src/**/*.{ts,tsx}`
- `drizzle.config.ts`: PostgreSQL connection from env, schema path, migrations directory
- `lib/env.ts`: use `zod` to validate `DATABASE_URL`, `NEXT_PUBLIC_*` vars at build time
- `docker-compose.yml`: PostgreSQL 16 + Redis 7 with health checks and volumes

### Template: `api`

```
{project-name}/
  src/
    index.ts           # Entry point, server startup
    app.ts             # Express/Fastify app configuration
    routes/
      health.ts
      index.ts         # Route registry
    middleware/
      error-handler.ts
      auth.ts
      validate.ts      # Zod validation middleware
    services/          # Business logic
    repositories/      # Database access
    lib/
      db.ts            # Drizzle connection + pool
      env.ts           # Zod-validated env vars
      logger.ts        # Pino or Winston logger
    types/
      index.ts
  drizzle/
    schema.ts
    migrations/
  tests/
    setup.ts
    routes/
      health.test.ts
    helpers/
      test-db.ts       # Test database setup/teardown
  .env.example
  .eslintrc.json
  .prettierrc
  .gitignore
  docker-compose.yml
  drizzle.config.ts
  Dockerfile           # Multi-stage production build
  package.json
  tsconfig.json
  CLAUDE.md
```

**Key configuration details:**
- `package.json`: scripts for `dev` (tsx watch), `build` (tsc), `start`, `lint`, `format`, `test`, `db:generate`, `db:migrate`
- Use `tsx` for development, compiled JS for production
- `Dockerfile`: multi-stage build (builder -> runner), non-root user, health check instruction
- Error handler middleware returns structured JSON errors with correlation IDs
- `validate.ts`: generic Zod validation middleware for request body/params/query

### Template: `python-api`

```
{project-name}/
  src/
    {project_name}/    # Python package (snake_case)
      __init__.py
      main.py          # FastAPI app, lifespan, middleware
      config.py        # Pydantic Settings for env vars
      routes/
        __init__.py
        health.py
      models/
        __init__.py
        base.py        # SQLAlchemy declarative base, common mixins
      schemas/
        __init__.py    # Pydantic request/response schemas
      services/
        __init__.py
      repositories/
        __init__.py
      middleware/
        __init__.py
        error_handler.py
      db/
        __init__.py
        session.py     # Async session factory, dependency
  alembic/
    env.py
    versions/
  alembic.ini
  tests/
    __init__.py
    conftest.py        # Fixtures: test client, test db session
    test_health.py
  .env.example
  .gitignore
  .python-version      # 3.12
  docker-compose.yml
  Dockerfile           # Multi-stage with uv or pip
  pyproject.toml       # Project metadata, dependencies, tool configs
  CLAUDE.md
```

**Key configuration details:**
- `pyproject.toml`: project metadata, dependencies (fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic-settings), dev dependencies (pytest, pytest-asyncio, httpx, ruff, mypy), tool configuration for pytest, ruff, mypy
- `config.py`: use `pydantic-settings` to load and validate `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, etc.
- `conftest.py`: async test client fixture using `httpx.AsyncClient`, test database with transaction rollback per test
- `Dockerfile`: multi-stage, use `uv` if available, otherwise `pip`, non-root user

### Template: `go-api`

```
{project-name}/
  cmd/
    server/
      main.go          # Entry point
  internal/
    config/
      config.go        # Env-based config with envconfig or viper
    handler/
      health.go
      handler.go       # Handler struct with dependencies
    middleware/
      logging.go
      auth.go
      recovery.go
    service/           # Business logic interfaces + implementations
    repository/        # Database access
    model/             # Domain types
  db/
    migrations/        # SQL migration files
    queries/           # sqlc query files (.sql)
    sqlc.yaml
  pkg/                 # Shared packages (if needed)
  tests/
    integration/       # Integration tests
  .env.example
  .gitignore
  .golangci.yml        # golangci-lint config
  docker-compose.yml
  Dockerfile           # Multi-stage with Go build
  go.mod
  go.sum
  Makefile             # build, test, lint, migrate, generate
  CLAUDE.md
```

**Key configuration details:**
- `go.mod`: module path, Go 1.22+, dependencies (chi, pgx, sqlc, zerolog or slog)
- `Makefile`: targets for `build`, `run`, `test`, `lint`, `migrate-up`, `migrate-down`, `sqlc-generate`, `docker-build`
- `Dockerfile`: multi-stage (`golang:1.22-alpine` builder, `alpine` runner), non-root user, health check
- `.golangci.yml`: enable `errcheck`, `govet`, `staticcheck`, `unused`, `gosec`, `gocritic`
- `sqlc.yaml`: configured for PostgreSQL with pgx/v5 driver

### Template: `java-api`

```
{project-name}/
  src/
    main/
      java/com/{group}/{artifact}/
        Application.java       # @SpringBootApplication
        config/
          WebConfig.java
          SecurityConfig.java
        controller/
          HealthController.java
        service/
        repository/
        model/
          entity/
          dto/
        exception/
          GlobalExceptionHandler.java
      resources/
        application.yml
        application-dev.yml
        application-prod.yml
        db/migration/          # Flyway migrations
          V1__init.sql
  test/
    java/com/{group}/{artifact}/
      controller/
        HealthControllerTest.java
      ApplicationTests.java
  .env.example
  .gitignore
  docker-compose.yml
  Dockerfile
  pom.xml                     # or build.gradle.kts
  CLAUDE.md
```

**Key configuration details:**
- `pom.xml`: Spring Boot 3.2+, Java 21, dependencies (spring-boot-starter-web, spring-boot-starter-data-jpa, postgresql, flyway-core, spring-boot-starter-validation, spring-boot-starter-test)
- `application.yml`: datasource configuration with `${DATABASE_URL}` placeholder, Flyway enabled, Jackson config
- `Dockerfile`: multi-stage with Eclipse Temurin, non-root user, JVM memory flags
- `GlobalExceptionHandler.java`: `@ControllerAdvice` with structured error responses

### Template: `cli`

```
{project-name}/
  src/
    index.ts           # CLI entry point with Commander
    commands/
      init.ts          # Example command
    lib/
      config.ts        # Config file handling (~/.{name}rc)
      logger.ts        # Colored console output
      prompts.ts       # Inquirer.js prompts
    types/
      index.ts
  tests/
    commands/
      init.test.ts
  .eslintrc.json
  .prettierrc
  .gitignore
  package.json
  tsconfig.json
  CLAUDE.md
```

**Key configuration details:**
- `package.json`: `"bin": { "{name}": "./dist/index.js" }`, `"type": "module"`, scripts for `dev`, `build`, `test`, `lint`
- `src/index.ts`: hashbang `#!/usr/bin/env node`, Commander program setup with version from package.json
- `tsconfig.json`: target ES2022, module NodeNext, outDir dist

### Template: `docker`

```
{project-name}/
  Dockerfile           # Multi-stage, production-ready
  docker-compose.yml   # App + PostgreSQL + Redis
  docker-compose.dev.yml  # Development overrides (volumes, hot reload)
  .dockerignore
  .env.example
  nginx/
    nginx.conf         # If reverse proxy needed
  scripts/
    healthcheck.sh     # Container health check script
    entrypoint.sh      # Startup script with migration wait
  CLAUDE.md
```

**Key configuration details:**
- `Dockerfile`: multi-stage build, non-root user (`USER 1001`), `HEALTHCHECK` instruction, minimal final image (alpine or distroless)
- `docker-compose.yml`: health checks on all services, named volumes for data persistence, proper `depends_on` with health conditions, resource limits, restart policies
- `.dockerignore`: `node_modules`, `.git`, `*.md`, `.env`, `dist`, `__pycache__`

### Template: `monorepo`

```
{project-name}/
  apps/
    web/               # Next.js app (scaffold like 'next' template)
    api/               # API app (scaffold like 'api' template)
  packages/
    ui/                # Shared UI component library
      src/
      package.json
      tsconfig.json
    config-eslint/     # Shared ESLint config
      index.js
      package.json
    config-typescript/  # Shared tsconfig
      base.json
      nextjs.json
      node.json
      package.json
  .gitignore
  .npmrc
  package.json         # Root workspace config
  pnpm-workspace.yaml
  turbo.json           # Turborepo pipeline config
  CLAUDE.md
```

**Key configuration details:**
- `pnpm-workspace.yaml`: packages include `apps/*` and `packages/*`
- `turbo.json`: pipeline for `build` (depends on `^build`), `lint`, `test`, `dev` (persistent)
- Root `package.json`: `"packageManager": "pnpm@9.x"`, scripts for `dev`, `build`, `lint`, `test` (all via `turbo run`)
- Each package has proper `"name": "@{project-name}/{package}"` scoping

## Step 3: Generate Files

Create all files with real, working content. Do NOT use placeholder comments like `// TODO: implement`. Every file must be functional:

- Config files must be valid and complete
- Source files must compile/parse without errors
- Test files must have at least one passing test
- Docker files must build successfully

## Step 4: Generate CLAUDE.md

Create a `CLAUDE.md` at the project root optimized for the project type:

```markdown
# {Project Name}

## Quick Reference
- Language: {language}
- Framework: {framework}
- Database: {database}
- Package Manager: {pm}

## Commands
- Dev server: `{command}`
- Run tests: `{command}`
- Lint: `{command}`
- Format: `{command}`
- Build: `{command}`
- Database migrate: `{command}`

## Architecture
{Brief description of the project structure and conventions}

## Conventions
- {Naming conventions}
- {File organization rules}
- {Error handling patterns}
- {Testing patterns}
```

## Step 5: Initialize and Verify

After generating all files:

1. **Initialize git** (if not already in a repo):
   ```bash
   git init
   ```

2. **Install dependencies**:
   ```bash
   # Detect and use the right package manager
   pnpm install / npm install / bun install
   pip install -e ".[dev]"
   go mod tidy
   mvn dependency:resolve
   ```

3. **Run the build** to verify everything compiles:
   ```bash
   npm run build / pnpm build / go build ./... / mvn compile
   ```

4. **Run tests** to verify the scaffolding works:
   ```bash
   npm test / pnpm test / pytest / go test ./... / mvn test
   ```

5. **Run linter** to verify code quality config works:
   ```bash
   npm run lint / ruff check / golangci-lint run
   ```

Report any failures and fix them before declaring the scaffold complete.

## Step 6: Summary

```
Project Scaffolded: {project-name}
==================================
Type:           {template}
Location:       {absolute path}
Files created:  {count}
Dependencies:   {installed/pending}
Tests:          {passing count}
Build:          {pass/fail}

Next steps:
1. cd {project-name}
2. cp .env.example .env.local   # Configure environment
3. docker compose up -d          # Start local services
4. {dev command}                 # Start developing
```

## Important Constraints

- **Every generated file must contain real, working code.** No `// TODO` placeholders, no empty function bodies, no `pass` statements in Python (unless genuinely needed).
- **Use the latest stable versions** of all dependencies and frameworks.
- **Follow each ecosystem's conventions** exactly. Do not mix conventions (e.g., do not use `camelCase` file names in a Python project).
- **Include security basics from the start**: environment variable validation, `.env` in `.gitignore`, non-root Docker users, dependency lockfiles committed.
- **The scaffold must work immediately** after dependency installation. If it requires a database, the `docker-compose.yml` must provide one.
