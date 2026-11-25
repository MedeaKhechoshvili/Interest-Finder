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

Verification after placement in this repository: 71 unit/component tests passed.
The coverage run reported:

| Measure    | Coverage      |
| ---------- | ------------- |
| Lines      | 86.76 percent |
| Statements | 86.76 percent |
| Branches   | 91.84 percent |
| Functions  | 68.75 percent |

Open `coverage/index.html` for the HTML report. The console also lists untested
lines. Reports are generated locally and ignored by Git. Coverage will change
as the team adds features, so each owner should add tests for their code.

## Test files

| File                                     | What it checks                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/shared/return-path.test.ts`  | Safe local return paths and rejection of external, malformed, repeated, and looping destinations                                    |
| `tests/unit/shared/api.test.ts`          | Browser API requests, JSON bodies, errors, empty responses, and login redirection after expiry                                      |
| `tests/unit/shared/backend.test.ts`      | Backend URL handling, headers, form data, error messages, origin checks, and full navigation                                        |
| `tests/unit/auth/forms.test.tsx`         | Login, registration, confirmation, consent, visibility, pending requests, errors, retries, and logout                               |
| `tests/unit/auth/auth-and-proxy.test.ts` | Mocked auth/proxy handlers, normalization, session verification, expiry, cookie settings, route restrictions, and upstream failures |

The application uses a small `goToPage()` helper for full-page navigation after
auth changes. Unit tests replace it with a spy; browser integration tests still
exercise actual navigation. The helper preserves the existing behavior.

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
