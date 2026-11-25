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

The existing suite has 77 unit/component cases and seven browser scenarios run on
desktop and mobile (14 Playwright tests). The complete account-to-review scenario is in `workflows`.
It exercises current auth UI plus saved-item/review proxy routes. Each feature
owner adds actual page interactions when their screens are implemented.

The merged review components in `src/components/reviews/` do not have unit tests
yet. Their review tests belong in `unit/details-reviews` (Yousuf). Until then,
combined function coverage is 44.21 percent and `npm run test:coverage` fails its
50 percent function threshold. See [UNIT_TESTS.md](../UNIT_TESTS.md#coverage).

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
