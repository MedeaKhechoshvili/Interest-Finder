# Frontend unit and component tests

Run these commands inside `frontend/`:

```bash
npm ci
npm test
npm run test:coverage
```

These tests do not need the API server, Python, a database, or a browser
installation. Vitest runs the tests and React Testing Library renders forms in
jsdom. API responses, server cookies, and navigation are mocked.

## Coverage

The coverage command checks application TypeScript in `src`, including untested
pages. Generated shadcn files in `src/components/ui` are excluded. Tests and
tooling live outside `src` and are not counted as application code.

Statements, branches, functions, and lines each have a minimum threshold of
50 percent. The command fails if any threshold is missed or a test fails.

Latest local run (Windows, Node.js 26.13.1, npm 12.2.3), with the merged review
components included: 77 of 77 unit/component tests passed. The coverage run
reported:

| Measure    | Coverage | Threshold | Result |
| ---------- | -------- | --------- | ------ |
| Lines      | 65.23 percent (364/558) | 50 percent | Pass |
| Statements | 65.23 percent (364/558) | 50 percent | Pass |
| Branches   | 67.38 percent (219/325) | 50 percent | Pass |
| Functions  | 44.21 percent (42/95)   | 50 percent | **Fail** |

**`npm run test:coverage` currently fails** because function coverage is below
50 percent, even though every test passes. Do not report this as a passing
coverage run.

Most of the untested functions are in:

- `src/components/reviews/`: merged review components with no unit tests yet,
  and not used on a page until Detail exists (Yousuf for review tests, Bishal for
  the Detail page).
- `src/components/header.tsx`, `src/components/footer.tsx`, `src/app/layout.tsx`,
  and the login, register, account, and My Lists pages (Medea).
- Placeholder pages that each feature owner will replace (Discover: Nathan;
  My Lists: Sivan; Home: Medea).

The fix is to add real tests for that code, not to lower the thresholds or exclude
application files. The earlier figures (71 tests, 68.75 percent functions) came from
before the review components were merged.

Open `coverage/index.html` for the HTML report. The console also lists untested
lines. Reports are generated locally and ignored by Git. Coverage will change
as the team adds features, so each owner should add tests for their code.

## Test files

| File                                     | Tests | What it checks                                                                                                                      |
| ---------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/shared/return-path.test.ts`  | 16    | Safe local return paths and rejection of external, malformed, repeated, and looping destinations                                    |
| `tests/unit/shared/api.test.ts`          | 8     | Browser API requests, JSON bodies, errors, empty responses, and login redirection after expiry                                      |
| `tests/unit/shared/backend.test.ts`      | 6     | Backend URL handling, headers, form data, error messages, origin checks, and full navigation                                        |
| `tests/unit/auth/forms.test.tsx`         | 14    | Forms disabled until hydration, login, registration, confirmation, consent, pending requests, errors, retries, and logout           |
| `tests/unit/auth/auth-prompt.test.tsx`   | 4     | Guest login prompt: return links, closing with the button or Escape, focus return, signed-in bypass, and unsafe return paths        |
| `tests/unit/auth/auth-and-proxy.test.ts` | 29    | Mocked auth/proxy handlers, normalization, session verification, expiry, cookie settings, route restrictions, and upstream failures |

`npx vitest list` shows fewer entries because it groups `.each` cases; the
total from `npm test` is 77.

The application uses a small `goToPage()` helper for full-page navigation after
auth changes. Unit tests replace it with a spy; browser integration tests still
exercise actual navigation. The helper preserves the existing behavior.

The hydration tests render the forms as server HTML, check that the fieldset,
inputs, and submit button are disabled, then hydrate them and check that they
become usable.

`tests/setup.ts` cleans up rendered forms and mocks after each test. It also
provides the ResizeObserver interface needed by Radix in jsdom; actual browser
layout and responsive behavior are checked by the integration suite.

## Other commands

```bash
npm run test:watch
npm test -- tests/unit/shared/return-path.test.ts
npm run typecheck
```

The browser integration suite is separate:

```bash
npm run test:integration
```

See [INTEGRATION_TESTS.md](INTEGRATION_TESTS.md) for its server setup and browser
installation commands. Vitest does not collect the Playwright files, and
Playwright does not collect these unit files.

## Team test folders

See [tests/README.md](tests/README.md) for feature folders, ownership, naming,
and commands for running one person's tests. Each member adds tests alongside
their assigned feature work.
