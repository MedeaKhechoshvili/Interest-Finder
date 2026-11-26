# Frontend test organization

Everyone writes and maintains tests for their own features. We group tests by
feature so each person can add tests without editing another feature's suite.

```text
tests/
	setup.ts
	mocks/
		server-only.ts
	unit/
		auth/
		shared/
		home/
		discover/
		saved-items/
		details-reviews/
	integration/
		auth/
		layout/
		workflows/
		home/
		discover/
		saved-items/
		details-reviews/
```

## Responsibilities

| Person   | Unit/component tests                               | Integration tests                                            |
| -------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Medea    | `unit/auth`, `unit/shared`, `unit/home`            | `integration/auth`, `integration/layout`, `integration/home` |
| Nathan   | `unit/discover`, including shared catalog cards    | `integration/discover`                                       |
| Sivan    | `unit/saved-items`, including shared save controls | `integration/saved-items`                                    |
| Bishal   | Detail tests in `unit/details-reviews`              | Detail tests in `integration/details-reviews`                  |
| Yousuf   | Review tests in `unit/details-reviews`              | Review tests in `integration/details-reviews`; coordinate `integration/workflows` |
| Everyone | Tests for changes to their own features            | Maintain their part of `integration/workflows`               |

Medea maintains the shared configuration, setup, and API test launcher and
contributed the initial account-to-review test. Yousuf coordinates expansion of
the combined workflow as the feature pages become available. Use separate
Detail and review test files within the shared `details-reviews` folders. Each
feature owner fixes failures and adds meaningful coverage for their own code.
Coordinate changes to shared fixtures and helpers before changing them.

## Naming and discovery

- Put Vitest tests in `unit/<feature>/*.test.ts` or `*.test.tsx`.
- Put Playwright tests in `integration/<feature>/*.spec.ts`.
- Use descriptive filenames such as `filters.test.tsx` or `review-edit.spec.ts`.
- Keep shared test setup in `setup.ts` and reusable mocks in `mocks/`.
- Use mocked API responses for unit/component tests.
- Use the real isolated test API for integration tests.
- Add assertions for success, validation, permissions, and failed requests.
- Future-feature folders contain README plans, not passing or skipped test stubs.

All unit tests and browser tests pass, and combined coverage meets the 50 percent
thresholds. The current numbers are in [UNIT_TESTS.md](../UNIT_TESTS.md#latest-results)
and [INTEGRATION_TESTS.md](../INTEGRATION_TESTS.md#what-is-checked).

Current state of each feature's tests:

| Feature | Unit tests | Browser tests |
| --- | --- | --- |
| Auth and shared (Medea) | `unit/auth`, `unit/shared` | `integration/auth`, `integration/layout` |
| Home (Medea) | `unit/home` | `integration/home` |
| Discover (Nathan) | `unit/discover` | Not yet (planning notes) |
| My Lists (Sivan) | `unit/saved-items` | `integration/saved-items` |
| Detail (Bishal) | Not yet (planning notes) | Not yet (planning notes) |
| Reviews (Yousuf) | Not yet (planning notes) | Not yet (planning notes) |

The complete account-to-review scenario is in `workflows`. It uses the real
login and account pages, but saves, completes, and reviews through the Next.js
API proxy. Changing it to click through Discover, Detail, and My Lists is planned
for the final project (Yousuf coordinates it).

Shared catalog fixture data for browser tests lives in `fixtures/home/`. The test
API uses it for Home, search, and item details, so Discover and Detail tests can
use the same items.

Browser tests that fill in forms must wait for the field to be editable
(`await expect(field).toBeEditable()`) and check `toHaveValue()` before
submitting, because forms stay disabled until hydration finishes. See
[INTEGRATION_TESTS.md](../INTEGRATION_TESTS.md#waiting-for-hydrated-forms).

## Run from the frontend folder

```bash
npm test
npm run test:coverage
npm run test:integration
npm run test:integration:ui
```

Run just one feature:

```bash
npm test -- tests/unit/discover
npm run test:integration -- tests/integration/discover
```

Feature commands require actual test files in that folder. For existing tests:

```bash
npm test -- tests/unit/auth
npm run test:integration -- tests/integration/auth
```

The combined application coverage thresholds remain at least 50 percent for
lines, statements, branches, and functions. Every owner contributes toward the
shared target; file or test counts alone do not establish coverage.

See [UNIT_TESTS.md](../UNIT_TESTS.md) for coverage details and
[INTEGRATION_TESTS.md](../INTEGRATION_TESTS.md) for browser/API setup.
