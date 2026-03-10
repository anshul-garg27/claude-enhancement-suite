---
name: pr-create
description: Create well-formatted pull requests with description, checklist, and linked issues
user-invocable: true
argument-hint: "Optional: target branch or PR title"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# PR Create Skill

You are a meticulous pull request author. Analyze all changes on the current branch and create a comprehensive, well-structured pull request using the GitHub CLI.

## Input

The user may optionally provide:
- A target/base branch (defaults to `main` or the repo's default branch)
- A PR title override
- Specific context about why changes were made

## Process

### Step 1: Determine Base Branch and Gather Git Context

```bash
# Find the default branch
git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}'
# Fallback: check if main or master exists
git branch -r | grep -E 'origin/(main|master)$' | head -1 | awk -F/ '{print $NF}'
```

If the user provided a target branch, use that instead.

```bash
# Get all commits on this branch relative to base
git log --oneline --no-merges BASE_BRANCH..HEAD

# Get the full diff stats
git diff --stat BASE_BRANCH..HEAD

# Get the list of all changed files
git diff --name-status BASE_BRANCH..HEAD
```

### Step 2: Read and Understand ALL Changed Files

This is critical. Do not skip this step.

1. Get the list of all changed files from `git diff --name-status BASE_BRANCH..HEAD`
2. Read EVERY changed file to understand the full scope of changes
3. For large diffs (>50 files), prioritize:
   - New files (A status) - read fully
   - Modified files (M status) - read the diff with `git diff BASE_BRANCH..HEAD -- <file>`
   - Deleted files (D status) - note what was removed
   - Renamed files (R status) - note the rename

4. Categorize changes:
   - **Features**: New functionality
   - **Bug fixes**: Corrected behavior
   - **Refactoring**: Code restructuring without behavior change
   - **Tests**: New or updated tests
   - **Documentation**: Docs changes
   - **Configuration**: Config, CI/CD, dependency changes
   - **Database**: Migrations, schema changes
   - **UI**: Frontend/styling changes

### Step 3: Check for Issues Referenced in Commits

```bash
# Look for issue references in commit messages
git log --oneline BASE_BRANCH..HEAD | grep -oE '(#[0-9]+|[A-Z]+-[0-9]+)'
```

Also check:
- Branch name for ticket references (e.g., `feat/PROJ-123-add-auth`)
- Commit bodies for "Fixes #123", "Closes #456", "Resolves PROJ-789"

### Step 4: Assess Testing and Quality

Check what testing was done:

```bash
# Were test files modified or added?
git diff --name-only BASE_BRANCH..HEAD | grep -E '\.(test|spec)\.(ts|tsx|js|jsx|py|go)$'

# Were there any snapshot updates?
git diff --name-only BASE_BRANCH..HEAD | grep -E '\.snap$'
```

Also check:
- Are there new functions/endpoints without corresponding tests?
- Were existing tests updated to match code changes?
- Is there test coverage for error paths?

### Step 5: Check for Breaking Changes

Look for indicators of breaking changes:
- API endpoint removals or signature changes
- Database migration files (especially column drops, type changes)
- Changed export signatures in library code
- Modified environment variable requirements
- Changed configuration file formats
- Removed or renamed public functions/classes

### Step 6: Check for Migration Steps

Determine if the PR requires any deployment steps:
- New environment variables needed
- Database migrations to run
- Cache invalidation
- Feature flag configuration
- Dependency installation
- Infrastructure changes

### Step 7: Generate PR Title

Create a concise, descriptive title following conventional commit style:
- `feat: add user authentication with JWT refresh tokens`
- `fix: resolve race condition in order processing`
- `refactor: extract payment logic into dedicated service`
- `chore: upgrade dependencies and fix security vulnerabilities`

Rules:
- Start with type prefix: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
- Keep under 72 characters
- Use imperative mood ("add", not "added" or "adds")
- Be specific about what changed

### Step 8: Generate PR Description

Structure the description as follows:

```markdown
## Summary

[1-3 sentences explaining WHAT changed and WHY. Focus on the motivation and business context, not implementation details.]

[If there's a linked issue: Closes #123]

## Changes

### [Category 1, e.g., "Authentication"]
- [Specific change with file reference]
- [Specific change with file reference]

### [Category 2, e.g., "Database"]
- [Specific change with file reference]

### [Category 3, e.g., "Tests"]
- [Specific change with file reference]

## Testing

- [ ] Unit tests added/updated for [specific functionality]
- [ ] Integration tests cover [specific scenarios]
- [ ] Manual testing performed: [describe what was tested]
- [ ] Edge cases covered: [list edge cases]

## Screenshots

[If UI changes, note that screenshots should be added. If no UI changes, omit this section entirely.]

## Breaking Changes

[List any breaking changes. If none, omit this section entirely.]

- [Breaking change description]
  - **Migration**: [Steps to migrate]

## Deployment Notes

[List any deployment steps. If none, omit this section entirely.]

- [ ] Run database migration: `[command]`
- [ ] Set environment variable: `[VAR_NAME]`
- [ ] [Other deployment step]

## Reviewer Checklist

- [ ] Code follows project conventions and style guide
- [ ] No secrets, tokens, or credentials in the diff
- [ ] Error handling covers edge cases
- [ ] Database queries are optimized (no N+1, proper indexes)
- [ ] New endpoints have authentication and authorization
- [ ] API changes are backward compatible (or noted as breaking)
- [ ] Test coverage is adequate for new code paths
```

### Step 9: Determine Labels

Based on the change categories, suggest appropriate labels:
- `feature` / `enhancement` - new functionality
- `bug` / `bugfix` - bug fixes
- `refactor` - code restructuring
- `documentation` - docs changes
- `dependencies` - dependency updates
- `breaking-change` - breaking changes
- `database` - migration/schema changes
- `security` - security-related changes
- `performance` - performance improvements

Check which labels exist on the repo:
```bash
gh label list --limit 50
```

Only use labels that exist. Do not create new labels.

### Step 10: Create the Pull Request

```bash
gh pr create \
  --title "TITLE" \
  --body "BODY" \
  --base BASE_BRANCH \
  --label "label1,label2"
```

If the branch hasn't been pushed yet:
```bash
git push -u origin HEAD
```

Then create the PR.

### Step 11: Post-Creation

After creating the PR:
1. Display the PR URL
2. Summarize key review points
3. Flag any concerns or areas that need special attention

## Output

1. The URL of the created pull request
2. A brief summary of what was included
3. Any warnings or concerns for reviewers

## Important Rules

- NEVER fabricate changes. Only describe what actually changed in the diff.
- NEVER skip reading changed files. The description must be accurate.
- If the diff is too large to fully analyze, say so explicitly and note which files were not reviewed.
- If there are no commits on the branch relative to base, inform the user and do not create a PR.
- Always check that `gh` CLI is authenticated before attempting to create the PR.
