# InterestFinder frontend

The Next.js frontend for InterestFinder uses TypeScript, Tailwind CSS, and shadcn/ui. Frontend files live in `frontend/`; the FastAPI backend lives in the repository root's `src/` directory. Forms use separate, readable components. Vitest unit/component tests and Playwright integration tests are included.

This project was created with the official starter:

```bash
npx create-next-app@latest frontend-standart --typescript --tailwind --eslint --app --src-dir --use-npm --disable-git --no-agent-feedback --import-alias '@/*' --yes
```

The starter's demo, online fonts, caching options, and example images were
removed. The `server-only` dependency prevents backend helpers from being
imported into browser code. The official shadcn CLI supplies the shared UI
components and their Radix dependencies.

## Run the frontend and backend

Install Node.js 22.12 or newer, which includes npm. Open a terminal in the cloned
Interest-Finder repository root, then run:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000/login. Next.js regenerates its build and type files.

The frontend defaults to the backend at http://127.0.0.1:8000/api/v1. Login,
registration, and data operations need FastAPI running too.

Open a **separate terminal in the repository root**, not in `frontend/`.
Follow the [root README](../README.md#backend-development) for first-time backend
installation and private environment configuration. If the backend is already
configured, start it on Windows PowerShell with:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir src
```

On Linux/macOS, from the same repository root:

```bash
.venv/bin/python -m uvicorn app.main:app --reload --app-dir src
```

For a different backend address or frontend port, create `frontend/.env.local`
from the frontend example and edit `BACKEND_API_URL` and `APP_ORIGIN`. Run the
following commands inside `frontend/`, and only copy the example if you do not
already have a configured `.env.local`.

On Linux/macOS:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

If port 3000 is occupied, set `APP_ORIGIN=http://localhost:3001` and run
`npm run dev -- --port 3001`.

The frontend folder contains source code, configuration, the dependency lock
file, UI license notices, and the frontend work division. Keep dependencies,
build output, caches, and private environment files out of commits.

## What is included

- Responsive login and registration forms using shadcn inputs and buttons.
- Name, email, password confirmation, and terms acceptance.
- Visible form errors, loading buttons, and password visibility controls.
- Real FastAPI registration and login.
- A protected account page, session restoration on reload, and logout.
- A responsive header with a simple mobile menu and a shared footer.
- A small backend proxy and browser API helper for future feature pages.
- Basic loading, error, and missing-page screens.

Home currently redirects to login. Discover and My Lists are placeholders, just
like the first frontend. Detail, discovery, saved-list cards, and review screens
are still the other feature owners' work. Terms and privacy text are provisional
project copy.

## Where to read the code

```text
src/app/login/page.tsx          checks the session and displays login
src/components/login-form.tsx sends login data from the browser
src/app/api/auth/login/route.ts calls fastapi and sets the cookie
src/app/register/page.tsx       displays registration
src/components/register-form.tsx handles the registration form
src/app/api/auth/register/route.ts validates and creates the account
src/app/account/page.tsx        requires a valid user
src/components/logout-button.tsx calls logout
src/app/api/auth/logout/route.ts removes the cookie
src/app/api/auth/session/route.ts returns the current user
src/lib/session.ts             reads and verifies the session
src/lib/backend.ts             makes server requests to fastapi
src/lib/api.ts                 makes browser requests through next
src/app/api/backend/           forwards known feature routes
src/components/header.tsx      navigation and mobile menu
src/components/footer.tsx      footer
src/app/globals.css            shared colors and responsive styles
```

Each form has its own state and submit function. Conditions use ordinary `if`
statements. Props have simple interfaces. Styling uses readable CSS classes and shared shadcn theme variables.
There are no generic form builders, schema libraries, custom error classes,
or token stores to learn first. Code comments are lowercase and short.

## Shared UI components

The components in `src/components/ui/` were installed with the official shadcn CLI:

```bash
npx shadcn@latest init --preset nova --base radix --no-monorepo --no-rtl --yes button input label checkbox card alert accordion sheet
```

- `Button`: submit, logout, retry, menu, and account navigation controls.
- `Input` and `Label`: login and registration fields.
- `Checkbox`: password visibility and terms acceptance.
- `Card`: login, registration, and account panels.
- `Alert`: form errors and success/session messages.
- `Accordion`: password-help disclosure.
- `Sheet`: mobile navigation with focus management and Escape-to-close behavior.

For example:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

<Label htmlFor="email">Email Address</Label>
<Input id="email" name="email" type="email" />
<Button type="submit">Log In</Button>
```

Add a component when a feature needs it:

```bash
npx shadcn@latest add dialog
```

`components.json` records the registry configuration. Shared colors live in
`src/app/globals.css`, keeping the green and cream design across components.
The generated UI files contain library types and styling; application forms
keep explicit state and normal conditional statements.

## How authentication works

The browser sends credentials to Next.js. Next.js converts login data into the
form fields expected by FastAPI. The backend verifies passwords and issues the
JWT. Next.js checks that token using `/auth/me`, then stores it in an HttpOnly,
SameSite=Lax cookie whose expiry matches the token.

Browser code cannot read the cookie. Private requests go through Next.js, which
adds the bearer token before calling FastAPI. The backend still checks ownership
and permissions. Requests that change data require this frontend's Origin.
After login and logout, a full page navigation makes the server read the updated
cookie. Protected pages validate it again instead of trusting its presence.

The backend has no refresh, password reset, or token-revocation endpoint. Users
log in again after expiry. Logout removes this browser's cookie; it does not
revoke a copied token before that token expires. Production cookies use Secure
and need HTTPS. This is a minimal learning version, not a complete public
hosting setup with rate limiting and request-size policies.

`BACKEND_API_URL` and `APP_ORIGIN` are server configuration. Do not put JWT signing
secrets or provider keys in public frontend variables.

## Fetching data in future client components

```typescript
import { apiRequest } from "@/lib/api";

const results = await apiRequest("/items?category=books&q=Hobbit");

const savedItem = await apiRequest("/saved-items/", "POST", {
  item_id: 101,
});
```

Search results can have a null local ID. Open `/items/books/{external_id}` to
store a book before saving it. Saved-item IDs, review IDs, and local catalog IDs
are different. Saved lists currently contain IDs and timestamps, not full item
cards; that backend response contract still needs to be extended for My Lists.

## Build and check types

```bash
npm run typecheck
npm run build
npm run start
```

The starter also includes `npm run lint`.

## Frontend tests

Run from `frontend/`:

```bash
npm test
npm run test:coverage
npx playwright install chromium
npm run test:integration
```

Vitest uses mocked requests for unit/component tests. Playwright starts Next.js
and the real FastAPI application on isolated test ports with a temporary database
and generated test credentials. The authentication UI is exercised in a browser;
saving, completion, and reviews currently use the real Next.js API proxy because
those feature screens are not implemented yet.

See [unit tests and coverage](UNIT_TESTS.md), [integration setup](INTEGRATION_TESTS.md),
and [team test ownership](tests/README.md) for requirements, evidence, and commands.
Generated coverage, Playwright reports, traces, and screenshots are ignored by Git.
