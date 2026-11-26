# Frontend unit and component tests

Run these commands from the `frontend/` directory:

```powershell
npm ci
npm test
npm run test:coverage
```

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is
blocked (for example `npm.cmd run test:coverage`).

The unit/component suite uses Vitest and React Testing Library. It runs in jsdom
and mocks API requests, server cookies, and navigation, so it does not need a
running FastAPI server, Python, a database, a browser installation, or provider
API keys.

## Coverage

The coverage command checks application TypeScript in `src`, including untested
pages. Generated shadcn files in `src/components/ui` are excluded. Tests and
tooling live outside `src` and are not counted as application code.

Statements, branches, functions, and lines each have a minimum threshold of
50 percent. The command fails if any threshold is missed or a test fails.

Open `coverage/index.html` for the HTML report. The console also lists untested
lines. Reports are generated locally and ignored by Git.

## Latest results

Latest local run after Home, Discover, Detail, My Lists, reviews, Home bookmark
saving, and the layout and page tests were added (Windows, Node.js 26.13.1,
npm 12.2.3). These are the reference numbers for the frontend; other documents
link here instead of repeating them.

| Check | Result |
| --- | --- |
| Unit/component tests | **264 passed** in 18 test files |
| Statements | 80.87 percent (998/1234), threshold 50, pass |
| Branches | 78.64 percent (674/857), threshold 50, pass |
| Functions | 73.83 percent (158/214), threshold 50, pass |
| Lines | 81.22 percent (991/1220), threshold 50, pass |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |

Rerun the commands after changing code or merging new work, and update this
table.

### Code without unit tests

Coverage passes overall, but these parts have no unit tests yet:

- `src/components/reviews/`: the review panel, form, list, item, stars, and API
  helpers (Yousuf).
- `src/app/items/[category]/[externalId]/page.tsx`: the Detail page (Bishal).
- `src/app/my-lists/page.tsx`: the My Lists server page that checks the session
  (Sivan; the browser tests cover its redirect).

Keep coverage up by adding real tests for that code, not by lowering the
thresholds or excluding application files.

## Test files

| Area | File | Tests | What it checks |
| --- | --- | ---: | --- |
| Shared (Medea) | `tests/unit/shared/return-path.test.ts` | 16 | Safe local return paths and rejection of external, malformed, repeated, and looping destinations |
| Shared (Medea) | `tests/unit/shared/api.test.ts` | 8 | Browser API requests, JSON bodies, errors, empty responses, and login redirection after expiry |
| Shared (Medea) | `tests/unit/shared/backend.test.ts` | 6 | Backend URL handling, headers, form data, error messages, origin checks, and full navigation |
| Auth (Medea) | `tests/unit/auth/forms.test.tsx` | 14 | Forms disabled until hydration, login, registration, confirmation, consent, pending requests, errors, retries, and logout |
| Auth (Medea) | `tests/unit/auth/auth-prompt.test.tsx` | 4 | Guest login prompt: return links, closing with the button or Escape, focus return, signed-in bypass, and unsafe return paths |
| Auth (Medea) | `tests/unit/auth/auth-and-proxy.test.ts` | 29 | Mocked auth/proxy handlers, normalization, session verification, expiry, cookie settings, route restrictions, and upstream failures |
| Auth (Medea) | `tests/unit/auth/pages.test.tsx` | 12 | Login and register pages (return page, messages, outside addresses replaced, signed-in users redirected), the account page (guest redirect, greeting, log out), and the error, not-found, loading, privacy, and terms pages |
| Shared (Medea) | `tests/unit/shared/layout.test.tsx` | 13 | Header links for guests and signed-in users, the current-page marker, the mobile menu (open, close on a link, close with Escape), footer links and year, and the root layout for guests, signed-in users, and an unavailable account service |
| Home (Medea) | `tests/unit/home/home-data.test.ts` | 37 | Home response validation, local catalog ids, row selection, detail links, image URLs, rating scales, and card metadata |
| Home (Medea) | `tests/unit/home/home-components.test.tsx` | 20 | The Home page landmark, loading, partial, empty, and error states, retry, search and category links, image fallback, the guest bookmark prompt, and saving from the bookmark |
| Discover (Nathan) | `tests/unit/discover/catalog.test.ts` | 33 | Reading search, category, page, and filters from the URL; page and search limits; year validation; building URLs and detail links; rating scale labels; card subtitles |
| Discover (Nathan) | `tests/unit/discover/discover-form.test.tsx` | 13 | Search submission, category switching, the filters for each category, year validation, clearing the search, and following URL changes |
| Discover (Nathan) | `tests/unit/discover/discover-results.test.tsx` | 12 | Requests through the shared API helper, loading, results and summary, empty search, error with retry, late responses, and pagination |
| Discover (Nathan) | `tests/unit/discover/discover-page.test.tsx` | 1 | The page passes the URL search to the form and results |
| Discover (Nathan) | `tests/unit/discover/item-card.test.tsx` | 9 | Detail link, category, year, rating scale, plain-text description, image and placeholder fallback, extra controls such as a save button, and eager or lazy images |
| My Lists (Sivan) | `tests/unit/saved-items/saved-items.test.ts` | 18 | Saved-items API helpers, response validation, numeric local catalog id validation, resolving a missing local id through the detail endpoint, and saved-record ids for updates and deletes |
| My Lists (Sivan) | `tests/unit/saved-items/save-button.test.tsx` | 7 | Save success, missing local id resolution, duplicate handling, request failures, parent-provided saved state, and preventing double submissions |
| My Lists (Sivan) | `tests/unit/saved-items/my-lists-client.test.tsx` | 12 | Planned and Completed lists, counts, empty states, tabs, status changes, deletion and confirmation, retry, update/delete errors, missing catalog details, and image fallback |

`npx vitest list` shows fewer entries because it groups `.each` cases; the
total from `npm test` is 264.

Coverage of the main My Lists files in the latest run: `save-button.tsx` 96.42
percent statements and 100 percent functions; see the HTML report for the others.

## Notes on the test setup

The application uses a small `goToPage()` helper for full-page navigation after
auth changes. Unit tests replace it with a spy; browser integration tests still
exercise actual navigation.

The hydration tests render the forms as server HTML, check that the fieldset,
inputs, and submit button are disabled, then hydrate them and check that they
become usable.

`tests/setup.ts` cleans up rendered components and mocks after each test. It
also provides the ResizeObserver interface needed by Radix in jsdom; actual
browser layout and responsive behavior are checked by the integration suite.

## Other commands

```powershell
npm run test:watch
npm test -- tests/unit/saved-items
npm test -- tests/unit/home/home-components.test.tsx
npm run typecheck
npm run build
```

The browser integration suite is separate:

```powershell
npx playwright install chromium
npm run test:integration
```

See [INTEGRATION_TESTS.md](INTEGRATION_TESTS.md) for its server setup and
scenarios. Vitest does not collect the Playwright files, and Playwright does not
collect these unit files.

There is no `lint` script for now; see the
[frontend README](README.md#build-and-check-types) for the reason. Do not report
lint results.

## Team test folders

See [tests/README.md](tests/README.md) for feature folders, ownership, naming,
and commands for running one person's tests. Each member adds tests alongside
their assigned feature work.
