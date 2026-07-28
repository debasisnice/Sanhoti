# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sanhoti is a multi-tier website for a Bengali community organization (events, RSVPs, notices, galleries, magazines, documents, membership). Monorepo with two independent npm workspaces orchestrated from the root: `backend/` (Express + TypeScript API) and `frontend/` (React + TypeScript SPA via Vite). There is no real database — the backend persists everything as JSON files under `backend/data/`.

## Commands

All commands below can be run from the repo root (which proxies into `backend/`/`frontend/`) or directly inside those directories.

```bash
# Install (must be done in all three locations independently — no workspaces/hoisting)
npm install && cd backend && npm install && cd ../frontend && npm install

# Run both apps concurrently (backend :5001 by default, frontend :3000/5173)
npm run dev
npm run dev:backend   # tsx watch src/server.ts
npm run dev:frontend  # vite

# Build
npm run build              # backend (tsc) then frontend (tsc && vite build --mode production)

# Test (vitest in both packages)
npm test                        # backend then frontend
cd backend && npm test          # backend only
cd frontend && npm test         # frontend only
cd backend && npx vitest run src/tests/auth.test.ts   # single backend test file
cd frontend && npx vitest run src/tests/App.test.tsx  # single frontend test file
cd backend && npx vitest run -t "should login"        # single test by name

# Lint (root config covers both packages' .ts/.tsx)
npm run lint
```

Backend requires a `backend/.env` (see `docs/QUICK_START.md`): `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `EMAIL_*`, `UPLOAD_DIR`. Data/uploads directories (`backend/data`, `backend/uploads`) must exist — the backend auto-creates `backend/data` if missing but seed JSON files won't exist until created.

To promote a user to admin locally: register normally, then edit `backend/data/users.json` and change that user's `user_type` from `"user"` to `"admin"`, then re-login.

Deployment is automatic on push to `main`/`master` via `.github/workflows/deploy.yml` (SSH into an EC2 instance, git sync, rebuild, pm2 restart). `docs/` contains many AWS/deployment-specific runbooks — consult those only when working on infra, not app logic.

## Backend Architecture

Strict layered architecture — never let a layer skip another:

```
routes/index.ts → Controller → Service → DataHelper (extends DatabaseHelper) → JSON file in backend/data/
```

- **Controllers** (`src/controllers/*Controller.ts`): parse `req`/`res`, call one service method, shape the HTTP response. No business logic, no direct file/data access.
- **Services** (`src/services/*Service.ts`): business logic and validation (e.g. `EventService.createEvent` rejects an end date before the start date). Depend only on DataHelpers and other services, never on Express types.
- **Data helpers** (`src/data/*DataHelper.ts`): the only layer that touches storage. Each extends `DatabaseHelper` (`src/data/DatabaseHelper.ts`), which provides `readFile<T>(filename)` / `writeFile<T>(filename, data)` (plain JSON read/write against `backend/data/<file>.json`) plus `generateId()` and `generate12DigitAlphanumericId()` for entity IDs.
- **routes/index.ts** is the single place routes are wired: it imports every controller, instantiates one singleton per controller, and applies middleware per-route. `bindController(controller, methodName)` is the standard way handlers are attached — controller methods are never referenced directly as route handlers. **Route order matters**: specific/static paths (e.g. `/events/all`, `/galleries/folders`) are always registered before parameterized ones (`/events/:id`) to avoid the param route swallowing them. All routes below the `router.use(authenticate)` call require a valid JWT; public routes must stay above that line.

### Auth & RBAC

- JWT auth via `middleware/auth.ts` (`authenticate`) — validates the `Authorization: Bearer` header and attaches `req.user = { userId, email, role }`.
- RBAC via `middleware/rbac.ts` — `requireAdmin` / `requireMember` gate routes by `req.user.role`.
- **Important quirk**: `models/types.ts`'s `UserRole` enum defines `'admin' | 'member' | 'public'`, but the actual role string stored on users and put into the JWT is the `User.user_type` field, which in practice is only ever `'admin'` or `'user'` (see `AuthService.register`/`login`, which set `role: user.user_type`). `rbac.ts`'s `requireMember` therefore checks for `'admin'`/`'user'`, not the enum's `'member'`. Don't assume the enum reflects runtime values.
- `middleware/audit.ts` (`auditLog(action, resource)`) wraps `res.json` to log admin mutations after the response is sent, via `AuditService` → `AuditDataHelper` → `backend/data/auditLogs.json`. It's applied per-route in `routes/index.ts` alongside `requireAdmin`, not globally — new admin-mutating routes should get an `auditLog(...)` entry to stay consistent with existing ones.

### File uploads

Images/PDFs (event flyers, gallery photos, magazines, documents, sponsor/homepage/board-member images, payment QR) are handled with `multer` inside the relevant controller and stored under `backend/data/<Category>/` (e.g. `Events_Flyers`, `Galleries`, `Magazines`, `Documents`), often within a per-event slug+ID folder. Controllers expose both an upload endpoint and a `serve*`/`get*Image` endpoint that streams the file back. Public image/photo endpoints are intentionally listed above the `authenticate` middleware in `routes/index.ts`.

### Social/crawler share pages

`server.ts` defines `/og/...` routes (outside `/api`, before the security-header/CSP middleware short-circuits for them) that serve plain image bytes and share-preview HTML for crawlers (WhatsApp, Facebook, Twitter, etc.). `EventController` contains crawler-sniffing logic (`isLinkPreviewCrawler`) to distinguish bot fetchers from in-app browsers so real users get redirected to the SPA while bots get static OG tags.

## Frontend Architecture

- `src/pages/` — one component per route, `src/pages/admin/` for the admin-only dashboard pages (events, notices, galleries, magazines, RSVPs, messages, email, audit logs, settings, user manual).
- `src/services/api.ts` — single Axios instance and the only place HTTP calls to the backend are made. Base URL is relative `/api` in production (served behind the same Nginx/domain) and `VITE_API_URL` (default `http://localhost:5001/api`) in development. A request interceptor attaches the JWT from `localStorage` to every call. API functions here also translate between frontend camelCase fields and backend snake_case fields (e.g. `firstName` → `first_name`) — new API calls should follow this existing translation pattern rather than sending camelCase straight through.
- `src/store/authStore.ts` — Zustand store (persisted to `localStorage` under `auth-storage`) holding `user`, `token`, `isAuthenticated`, `isAdmin`, `isMember`. `isAdmin`/`isMember` are derived once at login time from `user.role`, not recomputed reactively elsewhere.
- `src/components/ProtectedRoute.tsx` gates admin/member-only routes client-side (the backend RBAC middleware is still the actual security boundary).
- `src/seo/` + `src/components/Seo.tsx` (`react-helmet-async`) manage per-page meta tags; `SitemapController` on the backend generates `sitemap.xml`.

## SEO architecture

SEO is a primary product requirement here, not an afterthought. Three rules matter most when adding or changing public pages:

1. **Every public route needs a matching `/seo` prerender.** Nginx rewrites search-bot requests for extension-less SPA routes to `/seo/<path>`, which `SeoPageController` renders as static HTML. A route that exists in `App.tsx` but not in `SeoPageController.renderPage` will 404 for Googlebot while serving 200 to users. Keep the two route lists in sync, and keep the prerendered content equivalent to what the React page shows — the prerender must not be a thinner stub.
2. **Never return HTTP 200 for a URL that doesn't exist.** `staticPage()` returns `null` for unknown paths so `renderPage` emits a real 404; the SPA catch-all (`DurgaPujaYearRoute`) renders `NotFound` with `noindex` instead of redirecting to `/`. Both exist to prevent soft-404s and duplicate-canonical reports in Search Console. Routes that exist but shouldn't be indexed (login, register, dashboard, admin, RSVP forms) go through `isNoindexRoute` → 200 + `noindex`, *not* a 404.
3. **New public pages must be added to `STATIC_ROUTES` in `SitemapController`,** and linked from the `Footer` — the sitemap alone is a weak discovery signal. Never list a robots.txt-disallowed URL in the sitemap.

### Artists

Artists are first-class entities (`Artist` in `models/types.ts`, `ArtistDataHelper` → `ArtistService` → `ArtistController`, stored in `backend/data/artists.json`, photos in `backend/data/Artists/`). Each becomes a crawlable `/artists/<slug>` page carrying schema.org `Person`/`MusicGroup` markup with `alternateName` (spelling variants), `sameAs` (Wikipedia/social profiles), and `performerIn`. This exists so that a search for a performer's name can surface Sanhoti — the legacy free-text `performers` string on an event gives search engines nothing to rank.

- Slugs are the public URL and must stay stable. `ArtistDataHelper.update` retains the old slug in `previous_slugs` so a rename doesn't 404 an already-indexed URL; `findBySlug` resolves current slug → previous slug → id.
- Events and sub-events link artists via `artist_ids`. `ArtistService.getAppearances` also falls back to matching the legacy `performers` text, so pre-existing records surface without a manual re-link.

### Admin-authored SEO fields

Events and sub-events carry `meta_title`, `meta_description`, `image_alt`, `faqs`, and `artist_ids`, edited through `components/admin/SeoFieldsPanel.tsx`. These override the generated title/description and emit `FAQPage` schema. Both the React page and the `/seo` prerender must honour them — if you add a field, wire it in both places or bots and users will see different metadata.

### Structured data

`SeoPageController.layout()` emits a single connected `@graph` (Organization + WebSite + WebPage + BreadcrumbList + page nodes) with stable `@id`s, rather than disconnected blocks. Page-specific nodes should reference `ORG_ID` / the artist `@id` instead of repeating entity data.
