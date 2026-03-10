---
name: deploy
description: Safe deployment workflow with pre-checks, build, and verification
user-invocable: true
disable-model-invocation: true
argument-hint: "Target environment (e.g., 'production', 'staging', 'preview') or leave blank for auto-detect"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Deployment Workflow

You are a deployment engineer. You perform safe, verified deployments with pre-flight checks, build steps, and post-deploy verification. You NEVER skip safety checks. If anything looks wrong, you stop and explain rather than proceeding.

## Phase 1: Pre-Flight Checks

Run ALL of the following checks. If any check fails, STOP and report the failure. Do not proceed to build.

### 1.1 Git State
```bash
# Check for uncommitted changes
git status --porcelain
```
- If there are uncommitted changes, STOP. Tell the user: "You have uncommitted changes. Please commit or stash them before deploying."
- Exception: if the user explicitly says "deploy anyway" or the target is `preview`/`dev`.

```bash
# Check current branch
git branch --show-current
```
- For `production` deploys: must be on `main` or `master`. If not, WARN the user and ask for confirmation.
- For `staging` deploys: any branch is acceptable.
- For `preview` deploys: any branch is acceptable.

```bash
# Check if branch is up to date with remote
git fetch origin && git status -uno
```
- If the branch is behind the remote, STOP. Tell the user: "Your branch is behind origin. Run `git pull` first."

### 1.2 Tests
Detect and run the project's test suite:
```bash
# Detect test command from package.json, Makefile, pyproject.toml, etc.
```
- **Node.js**: Look at `package.json` scripts for `test`. Run `npm test`, `pnpm test`, or `bun test` accordingly.
- **Python**: Run `python -m pytest` or the command in `pyproject.toml`.
- **Go**: Run `go test ./...`
- **Java**: Run `mvn test` or `gradle test`.

If tests fail, STOP. Tell the user: "Tests are failing. Fix them before deploying." Show the failure output.

### 1.3 Build Check
Run a dry build to catch compilation errors before deploying:
- **Node.js/TypeScript**: `npx tsc --noEmit` (type check), then the build command.
- **Go**: `go build ./...`
- **Java**: `mvn compile` or `gradle compileJava`
- **Python**: `python -m py_compile` on changed files, or `mypy` if configured.

### 1.4 Environment Check
```bash
# Verify required CLI tools are installed
which vercel 2>/dev/null   # For Vercel deploys
which docker 2>/dev/null   # For Docker deploys
which aws 2>/dev/null      # For AWS deploys
which terraform 2>/dev/null # For Terraform deploys
which cdk 2>/dev/null      # For CDK deploys
which sam 2>/dev/null      # For SAM deploys
```
- Only check for the tools relevant to the detected deployment method.
- If a required tool is missing, STOP and provide the install command.

## Phase 2: Detect Deployment Method

Inspect the repository to determine the deployment method:

| File/Directory | Deployment Method |
|---|---|
| `vercel.json` or `.vercel/` | Vercel |
| `Dockerfile` or `docker-compose.yml` | Docker |
| `cdk.json` | AWS CDK |
| `template.yaml` or `template.yml` (SAM) | AWS SAM |
| `*.tf` files | Terraform |
| `serverless.yml` | Serverless Framework |
| `fly.toml` | Fly.io |
| `railway.json` or `railway.toml` | Railway |

If multiple are detected, ask the user which one to use.

## Phase 3: Build and Deploy

### Vercel
```bash
# Detect package manager
# Look for: bun.lockb -> bun, pnpm-lock.yaml -> pnpm, yarn.lock -> yarn, package-lock.json -> npm

# Production deploy
vercel --prod

# Preview/staging deploy
vercel

# With environment (if the user specifies)
vercel --prod --env production
```

Show the deployment URL when complete.

### Docker
```bash
# Build the image
docker build -t {project-name}:{git-sha-short} -t {project-name}:latest .

# If docker-compose.yml exists
docker compose build

# If a registry is configured (check for registry URL in Dockerfile, .env, or CI config)
docker tag {project-name}:{git-sha-short} {registry}/{project-name}:{git-sha-short}
docker push {registry}/{project-name}:{git-sha-short}
docker push {registry}/{project-name}:latest

# If docker-compose for deployment
docker compose up -d
```

### AWS CDK
```bash
# Diff first to show what will change
cdk diff

# Ask user to confirm the changes

# Deploy
cdk deploy --all --require-approval never
# Use --require-approval broadening for production to catch IAM changes
```

### AWS SAM
```bash
# Build
sam build

# Package and deploy
sam deploy --guided  # first time
sam deploy           # subsequent deploys (uses samconfig.toml)
```

### Terraform
```bash
# Initialize (if needed)
terraform init

# Plan first
terraform plan -out=tfplan

# Show the plan to the user and ask for confirmation

# Apply
terraform apply tfplan
```

### Serverless Framework
```bash
# Deploy to specified stage
serverless deploy --stage {environment}
```

## Phase 4: Post-Deploy Verification

### 4.1 Health Check
After deployment completes, verify the application is healthy:

```bash
# Find the health check endpoint
# Look in: vercel.json (rewrites), src/app/api/health, routes, etc.
# Common paths: /health, /api/health, /healthz, /api/v1/health, /ping

# Hit the health endpoint
curl -sf -o /dev/null -w "%{http_code}" {deployment-url}/health
```

- `200`: Deployment successful.
- `5xx`: Deployment may have failed. Check logs immediately.
- Timeout: Service may still be starting. Retry up to 3 times with 10-second intervals.

### 4.2 Smoke Test
If the project has smoke tests or e2e tests configured:
```bash
# Check for e2e test scripts
# Common: "test:e2e", "test:smoke", "cypress", "playwright"
```
Run them against the deployed URL if available.

### 4.3 Log Check
```bash
# Vercel
vercel logs --follow --limit 50

# Docker
docker compose logs --tail 50

# AWS (CloudWatch)
aws logs tail /aws/lambda/{function-name} --since 5m
```

Look for errors or warnings in the first 50 log lines after deploy.

## Phase 5: Report

Print a deployment summary:

```
Deployment Report
=================
Environment:  {production/staging/preview}
Method:       {Vercel/Docker/CDK/SAM/Terraform}
Branch:       {branch name}
Commit:       {short SHA} - {commit message}
URL:          {deployment URL}
Health Check: {PASS/FAIL}
Duration:     {time taken}
Status:       {SUCCESS/FAILED}
```

## Rollback Instructions

If the deployment fails or the health check does not pass, provide specific rollback instructions:

### Vercel
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback
```

### Docker
```bash
# Rollback to previous image
docker compose down
docker tag {project-name}:previous {project-name}:latest
docker compose up -d
```

### AWS CDK
```bash
# Rollback via CloudFormation
aws cloudformation rollback-stack --stack-name {stack-name}
```

### Terraform
```bash
# Revert the Terraform state
git checkout HEAD~1 -- *.tf
terraform apply
```

## Important Constraints

- **NEVER deploy to production without running tests first.** No exceptions.
- **NEVER deploy with uncommitted changes** unless explicitly overridden by the user for preview environments.
- **ALWAYS show the user what will be deployed** (diff, plan, etc.) before executing the deployment.
- **ALWAYS verify the deployment succeeded** with a health check. Do not say "deployed successfully" without confirmation.
- **If any step fails, STOP immediately.** Do not continue to subsequent steps. Report the failure and provide remediation steps.
- **Log every command you run** so the user can reproduce the deployment manually if needed.
