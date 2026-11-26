# Frontend unit and component tests

Run these commands inside `frontend/`:

```bash
npm ci
npm test
npm run test:coverage
```

These tests do not need the API server, Python, a database, or a browser installation. Vitest runs the tests and React Testing Library renders forms in jsdom. API responses, server cookies, and navigation are mocked.

## Coverage

The coverage command checks application TypeScript in `src`, including untested pages. Generated shadcn files in `src/components/ui` are excluded. Tests and tooling live outside `src` and are not counted as application code.

Statements, branches, functions, and lines each have a minimum threshold of 50 percent. The command fails if any threshold is missed or a test fails.

### Latest coverage results

The latest coverage run on the My Lists feature branch reported the following results:

| Measure | Coverage | Threshold | Result |
| --- | ---: | ---: | --- |
| Statements | 70.55% | 50% | Pass |
| Branches | 72.86% | 50% | Pass |
| Functions | 57.36% | 50% | Pass |
| Lines | 70.91% | 50% | Pass |

**All four coverage requirements are met.**

The overall coverage report includes the application files under `src`. Some individual files have 0% coverage, but the overall project coverage for each metric remains above the required threshold.

### Files with no test coverage
Latest local run (Windows, Node.js 26.13.1, npm 12.2.3), with the merged review
components and the Home page included: 123 of 123 unit/component tests passed.
The coverage run reported:

| Measure    | Coverage | Threshold | Result |
| ---------- | -------- | --------- | ------ |
| Lines      | 73.83 percent (553/749) | 50 percent | Pass |
| Statements | 73.86 percent (554/750) | 50 percent | Pass |
| Branches   | 77.11 percent (374/485) | 50 percent | Pass |
| Functions  | 57.60 percent (72/125)  | 50 percent | Pass |

`npm run test:coverage` passes. Before the Home tests were added, function
coverage was 44.21 percent and the command failed.

Most of the remaining untested functions are in:

- `src/components/reviews/`: merged review components with no unit tests yet,
  and not used on a page until Detail exists (Yousuf for review tests, Bishal for
  the Detail page).
- `src/components/header.tsx`, `src/components/footer.tsx`, `src/app/layout.tsx`,
  and the login, register, account, and My Lists pages (Medea).
- Placeholder pages that each feature owner will replace (Discover: Nathan;
  My Lists: Sivan).

Keep coverage up by adding real tests for that code, not by lowering the
thresholds or excluding application files.

The latest report identifies several areas that currently have no test coverage:

- `src/app/`: application layout, error, loading, not-found, and home page files.
- `src/app/account/page.tsx`: account page.
- `src/app/auth-prompt-demo/page.tsx`: authentication prompt demo page.
- `src/app/discover/page.tsx`: Discover page.
- `src/app/login/page.tsx`: login page.
- `src/app/my-lists/page.tsx`: My Lists page.
- `src/app/privacy/page.tsx`: privacy page.
- `src/app/register/page.tsx`: registration page.
- `src/app/terms/page.tsx`: terms page.
- `src/components/footer.tsx` and `src/components/header.tsx`: shared layout components.
- `src/components/reviews/`: review components and review API utilities.
- `src/lib/utils.ts`: utility file.

These files are not necessarily broken; they simply were not exercised by the tests included in this coverage run. Adding tests for these areas would improve coverage further.

### My Lists coverage

The latest report shows strong coverage for the My Lists implementation:

| File | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `components/my-lists-client.tsx` | 91.46% | 82.89% | 92.30% | 95.94% |
| `components/save-button.tsx` | 96.42% | 92.59% | 100% | 100% |
| `lib/saved-items.ts` | 100% | 100% | 100% | 100% |

This indicates that the main My Lists client, reusable Save button, and saved-items API helper are well covered by the current unit tests.

### Coverage report location

Open `coverage/index.html` inside the `frontend/` directory to view the detailed HTML report. It shows which files and individual lines are covered by tests.

The console output also identifies uncovered lines. Coverage reports are generated locally and ignored by Git.

Coverage will change as the team adds features, so each feature owner should add tests for their code.

## Test files

| File | Tests | What it checks |
| --- | ---: | --- |
| `tests/unit/shared/return-path.test.ts` | 16 | Safe local return paths and rejection of external, malformed, repeated, and looping destinations |
| `tests/unit/shared/api.test.ts` | 8 | Browser API requests, JSON bodies, errors, empty responses, and login redirection after expiry |
| `tests/unit/shared/backend.test.ts` | 6 | Backend URL handling, headers, form data, error messages, origin checks, and full navigation |
| `tests/unit/auth/forms.test.tsx` | 14 | Forms disabled until hydration, login, registration, confirmation, consent, pending requests, errors, retries, and logout |
| `tests/unit/auth/auth-prompt.test.tsx` | 4 | Guest login prompt: return links, closing with the button or Escape, focus return, signed-in bypass, and unsafe return paths |
| `tests/unit/auth/auth-and-proxy.test.ts` | 29 | Mocked auth/proxy handlers, normalization, session verification, expiry, cookie settings, route restrictions, and upstream failures |
| `tests/unit/saved-items/saved-items.test.ts` | 18 | Saved-items API helpers, response validation, catalog ID validation and resolution, and correct IDs for update/delete |
| `tests/unit/saved-items/save-button.test.tsx` | 7 | Save success, local ID resolution, duplicate handling, errors, saved state, and pending-request protection |
| `tests/unit/saved-items/my-lists-client.test.tsx` | 12 | Planned/Completed lists, empty states, status changes, deletion, retry, errors, and missing catalog details |

The six pre-existing test files contain 77 tests. The three saved-items test files add 37 tests, bringing the documented total to **114 unit/component tests**.
| File                                     | Tests | What it checks                                                                                                                      |
| ---------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/shared/return-path.test.ts`  | 16    | Safe local return paths and rejection of external, malformed, repeated, and looping destinations                                    |
| `tests/unit/shared/api.test.ts`          | 8     | Browser API requests, JSON bodies, errors, empty responses, and login redirection after expiry                                      |
| `tests/unit/shared/backend.test.ts`      | 6     | Backend URL handling, headers, form data, error messages, origin checks, and full navigation                                        |
| `tests/unit/auth/forms.test.tsx`         | 14    | Forms disabled until hydration, login, registration, confirmation, consent, pending requests, errors, retries, and logout           |
| `tests/unit/auth/auth-prompt.test.tsx`   | 4     | Guest login prompt: return links, closing with the button or Escape, focus return, signed-in bypass, and unsafe return paths        |
| `tests/unit/auth/auth-and-proxy.test.ts` | 29    | Mocked auth/proxy handlers, normalization, session verification, expiry, cookie settings, route restrictions, and upstream failures |
| `tests/unit/home/home-data.test.ts`      | 33    | Home response validation, row selection, detail links, image URLs, rating scales, and card metadata                                 |
| `tests/unit/home/home-components.test.tsx` | 13  | Home loading, partial, empty, and error states, retry, search and category links, image fallback, and bookmark login prompt        |

`npx vitest list` shows fewer entries because it groups `.each` cases; the
total from `npm test` is 123.

The latest coverage report includes the My Lists tests. The test count above is based on the individual test cases listed in the test files; use the actual Vitest output to report the exact number that passed or failed in a particular run.

`npx vitest list` shows fewer entries because it groups `.each` cases; use the test run output from `npm test` for the actual executed test count.

The application uses a small `goToPage()` helper for full-page navigation after auth changes. Unit tests replace it with a spy; browser integration tests still exercise actual navigation. The helper preserves the existing behavior.

The hydration tests render the forms as server HTML, check that the fieldset, inputs, and submit button are disabled, then hydrate them and check that they become usable.

`tests/setup.ts` cleans up rendered forms and mocks after each test. It also provides the ResizeObserver interface needed by Radix in jsdom; actual browser layout and responsive behavior are checked by the integration suite.

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

See [INTEGRATION_TESTS.md](INTEGRATION_TESTS.md) for its server setup and browser installation commands. Vitest does not collect the Playwright files, and Playwright does not collect these unit files.

## Team test folders

See [tests/README.md](tests/README.md) for feature folders, ownership, naming, and commands for running one person's tests. Each member adds tests alongside their assigned feature work.