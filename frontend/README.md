# InterestFinder Frontend Foundation

React + Vite frontend for the existing FastAPI backend. This change establishes project tooling only. **Home, navigation/layout, authentication, Discover, Detail, and My Lists have not been implemented.** The browser intentionally displays a blank page until page work starts. No sample catalog data or simulated login is included.

## Requirements

- Node.js 22.12 or newer (Node 24 LTS recommended for the team)
- npm
- The existing FastAPI server for API integration later

## Setup (PowerShell)

From the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Copy the example only on first setup; do not overwrite existing local configuration. On macOS/Linux, use `cp .env.example .env` instead of `Copy-Item`.

Open <http://localhost:5173>. A blank page is expected in this foundation-only version. Stop the server with Ctrl+C. Vite uses port 5173 with `strictPort` to avoid silently moving to an origin that the backend CORS settings do not allow.

Start FastAPI in a separate terminal using the root README instructions. The future shared Axios client should read `import.meta.env.VITE_API_BASE_URL`; the example value is `http://localhost:8000/api/v1`. This environment variable is configuration, not an implemented API connection. Yousuf owns `src/api/api.js` and authentication; they are not created here.

**Every `VITE_*` value can appear in the browser bundle. Never put provider keys, passwords, or JWT signing secrets there.**

## Commands

```powershell
npm run build
npm run preview
npm test
npm run test:watch
npm run format
npm run format:check
```

- `build`: creates production assets in `dist/`.
- `preview`: checks the built assets locally; it is not a production deployment server.
- `test`: runs Vitest/React Testing Library tests. No feature tests exist in this initial scaffold. The temporary `--passWithNoTests` option permits a tooling-only baseline; remove it once feature tests are added. An empty test run is not test coverage.
- `format` / `format:check`: applies/checks the shared Prettier configuration.

The formatter preserves the professor's main preferences (tabs, double quotes, semicolons, 80-character wrapping, and one JSX attribute per line). It omits the personal `filepath`, forced CSS parser, and deprecated `jsxBracketSameLine` option.

## Structure and handoff

```text
frontend/
  components.json
  package.json
  package-lock.json
  vite.config.js
  src/
    App.jsx              Minimal router; Medea integrates routes here
    main.jsx             React entry point
    index.css            Tailwind + neutral shadcn tokens; Figma styling pending
    components/ui/       Shared shadcn primitives
    lib/utils.js         shadcn class-name utility
    test/setup.js        DOM matchers and test cleanup
```

Import with the `@/` alias, for example `import { Button } from "@/components/ui/button"`.

Feature directories should be created by their owners when they add actual files:

| Owner  | Feature areas                                                                               |
| ------ | ------------------------------------------------------------------------------------------- |
| Medea  | `components/layout/`, `pages/HomePage.jsx`, shared feedback components, root route assembly |
| Sivan  | My Lists, saved-item summaries, Docker Compose/database support                             |
| Yousuf | `api/api.js`, `context/AuthContext.jsx`, login/signup, session handling                     |
| Nathan | Discover, catalog requests, reusable item card, provider checks                             |
| Bishal | Detail, reviews, Playwright workflows                                                       |

Do not create a second API client or authentication implementation. Coordinate dependency/lockfile changes. Agree on route names and component props before pages depend on them.

## Adding shadcn components

The project uses JavaScript, Tailwind v4, and the shadcn new-york style. Components live in source control rather than being imported from the assignment's illustrative `@shadcn/ui` package.

```powershell
npx shadcn@latest add input label dialog tabs
```

Inspect generated changes and preserve team theme tokens. Feature owners add components they actually need. The setup's Font Awesome packages provide optional free application icons; shadcn may also use Lucide icons internally.

## Next steps

1. Review and merge the foundation PR before teammates base feature branches on it.
2. Supply Figma screenshots or an accessible design reference before implementing Home/layout.
3. Yousuf establishes the shared API/auth contract; Nathan defines item-card props; Sivan defines saved-item summary fields.
4. Each feature owner implements responsive UI, tests, API integration, and setup notes.
5. Add Playwright and Compose in their owners' PRs. They are not claimed as complete by this foundation.

SQLite/PostgreSQL permission and the assignment's token-storage requirements remain team clarification items; this scaffold changes neither backend database nor authentication behavior.
