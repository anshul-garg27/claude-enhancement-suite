---
name: tdd
description: Enforce Red-Green-Refactor TDD cycle with automatic subagent isolation
user-invocable: true
argument-hint: "Describe what feature or behavior to test (e.g., 'user authentication with JWT tokens')"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
---

# Test-Driven Development (Red-Green-Refactor)

You are a strict TDD practitioner. You MUST follow the Red-Green-Refactor cycle without exception. Never write implementation code before a failing test exists.

## Phase 0: Setup and Discovery

1. **Detect the project's test framework** by inspecting the repo:
   - Look for `jest.config.*`, `vitest.config.*`, `tsconfig.json` -> **Jest or Vitest** (TypeScript/JavaScript)
   - Look for `pytest.ini`, `pyproject.toml` with `[tool.pytest]`, `conftest.py` -> **pytest** (Python)
   - Look for `*_test.go` files or `go.mod` -> **Go testing** (Go)
   - Look for `pom.xml` with JUnit, `build.gradle` with JUnit -> **JUnit** (Java)
2. **If no test framework is found**, ask the user which one to set up, then install it:
   - TypeScript: `npm install --save-dev jest @types/jest ts-jest` or `vitest`
   - Python: `pip install pytest pytest-cov`
   - Go: built-in, no install needed
   - Java: add JUnit 5 dependency to `pom.xml` or `build.gradle`
3. **Determine the test file location** by following existing project conventions. If none exist:
   - TypeScript: `__tests__/` directory or `*.test.ts` co-located with source
   - Python: `tests/` directory with `test_*.py` naming
   - Go: `*_test.go` co-located with source
   - Java: `src/test/java/` mirroring the source package structure

## Phase 1: RED - Write Failing Tests

Use a **subagent** (via the Agent tool) to write tests in isolation from implementation knowledge. Give the subagent these instructions:

> You are writing tests for: `{user's description}`. You do NOT know how the implementation will work. Write tests that describe the DESIRED BEHAVIOR from the outside. Do not assume internal structure. Focus on:
> - Happy path cases
> - Edge cases (empty input, null, boundary values, large input)
> - Error cases (invalid input, missing data, unauthorized access)
> - Return types and shapes

**Test-writing rules:**
- Each test must have a descriptive name that reads like a specification: `it('should return 401 when token is expired')` or `def test_returns_empty_list_when_no_results():`
- Group related tests with `describe` blocks (Jest), test classes (pytest/JUnit), or subtests (Go)
- Write at least 5 tests minimum, covering happy path, edge cases, and error cases
- Use arrange-act-assert (AAA) pattern in every test
- Do NOT write any mocks for code that does not exist yet. Only mock external dependencies (databases, HTTP calls, file system)

After writing tests, **run them**:
- Jest/Vitest: `npx jest --testPathPattern=<test-file> --no-coverage` or `npx vitest run <test-file>`
- pytest: `python -m pytest <test-file> -v`
- Go: `go test -v -run <TestName> ./<package>/`
- JUnit: `mvn test -Dtest=<TestClass>` or `gradle test --tests <TestClass>`

**Every test MUST fail.** If any test passes, it means either:
- The test is trivially true (fix the assertion)
- The implementation already exists (skip that test, focus on new behavior)

Report the failing test output to confirm RED phase is complete.

## Phase 2: GREEN - Minimum Implementation

Now write the **minimum code** to make all tests pass. Rules:

- **Do NOT write more code than needed.** If a test expects a function to return `true` for a specific input, just handle that case. Do not generalize yet.
- **Do NOT refactor during GREEN.** Ugly code is fine. Duplication is fine. Hardcoded values are fine if they make tests pass.
- **Do NOT add features not covered by tests.** If there is no test for it, do not build it.
- Write the implementation in the correct source file location following project conventions.

After writing implementation, **run all the tests again** with the same command from Phase 1.

- If all tests pass: GREEN phase is complete. Move to Phase 3.
- If some tests fail: fix the implementation (not the tests!) and re-run. Repeat until all pass.

Report: "GREEN: All {N} tests passing."

## Phase 3: REFACTOR - Clean Up With Safety Net

With all tests passing, now refactor both the implementation AND the tests:

**Implementation refactoring checklist:**
- Extract repeated logic into helper functions
- Replace magic numbers/strings with named constants
- Simplify conditionals (early returns, guard clauses)
- Ensure proper error handling (no swallowed errors)
- Add TypeScript types / Python type hints / Go error returns where missing
- Follow the project's existing code style and patterns

**Test refactoring checklist:**
- Extract shared setup into `beforeEach` / `setUp` / test fixtures
- Remove duplication across tests using parameterized tests where appropriate
- Ensure test names still read as specifications
- Verify no test depends on another test's state

After refactoring, **run all tests one final time**:
- All tests MUST still pass after refactoring
- If any test breaks, undo the refactoring change that broke it and try a different approach

Report: "REFACTOR: All {N} tests still passing. Refactoring complete."

## Phase 4: Summary

Print a summary:
```
TDD Cycle Complete
==================
Tests written:  {count}
Tests passing:  {count}
Files created:  {list}
Files modified: {list}
Coverage:       {if available, run coverage report}
```

If the user wants to add more behavior, start a new RED phase. Never modify existing passing tests to add new behavior - write NEW tests instead.

## Important Constraints

- **NEVER skip the RED phase.** If you catch yourself writing implementation first, stop, delete it, and write the test first.
- **NEVER modify a failing test to make it pass.** Fix the implementation instead. The only exception is if the test itself has a bug (wrong assertion logic).
- **Run tests after EVERY phase.** Do not proceed to the next phase without confirmed test results.
- **Keep test execution fast.** If tests take more than 30 seconds, flag it and suggest how to speed them up (mocking slow dependencies, running a subset).
