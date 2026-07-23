# Sanhoti — Tech Stack & Hosting Reference

For the dev team. Covers the full technology stack and the AWS + Cloudflare hosting setup.

> **Sensitive:** contains the production IP, AWS account ID, and server paths. Share within the team only — do not post publicly or commit secrets (SSH keys, `.env`) alongside it.

---

## 1. Overview

Sanhoti is a multi-tier website for a Bengali community organization (events, RSVPs, notices, galleries, magazines, documents, membership). It's a monorepo with two independent npm workspaces:

- **`backend/`** — Express + TypeScript REST API
- **`frontend/`** — React + TypeScript SPA (Vite)

There is **no database** — the backend persists everything as JSON files under `backend/data/`. Uploaded media (flyers, gallery photos, magazines, PDFs) is stored on the server filesystem, also under `backend/data/`.

---

## 2. Tech Stack

### Backend (`sanhoti-backend`)

| Area | Technology |
|------|-----------|
| Runtime | Node.js |
| Language | TypeScript 5.3 (ESM, `"type": "module"`) |
| Framework | Express 4.18 |
| Dev runner | `tsx watch` |
| Build | `tsc` → `dist/` |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` password hashing |
| Validation | `express-validator`, `zod` |
| File uploads | `multer` |
| Email | `nodemailer` |
| Misc | `qrcode` (tickets/payment QR), `uuid`, `cors`, `dotenv` |
| Testing | Vitest |
| Persistence | JSON files in `backend/data/` (no DB) |

**Architecture:** strict layered flow — `routes/index.ts → Controller → Service → DataHelper → JSON file`. Controllers handle HTTP only, services hold business logic, DataHelpers are the only layer touching storage. RBAC via JWT roles (`admin` / `user`); admin mutations are audit-logged.

### Frontend (`sanhoti-frontend`)

| Area | Technology |
|------|-----------|
| Framework | React 18 |
| Language | TypeScript 5.3 |
| Build tool | Vite 5 |
| Routing | React Router 6 |
| State | Zustand 4 (persisted to `localStorage`) |
| HTTP | Axios (single instance in `src/services/api.ts`) |
| Forms | React Hook Form + `@hookform/resolvers` + `zod` |
| Styling | Tailwind CSS 3 (PostCSS + Autoprefixer) |
| Animation | Framer Motion |
| Icons | `lucide-react` |
| PDF | `pdfjs-dist`, `react-pdf` |
| QR | `qrcode.react`, `html5-qrcode` (scanning) |
| SEO | `react-helmet-async` |
| Notifications | `react-hot-toast` |
| PWA | `vite-plugin-pwa` (installable mobile app) |
| Testing | Vitest + React Testing Library |

**API layer:** `src/services/api.ts` is the only place HTTP calls are made. A request interceptor attaches the JWT from `localStorage`; the layer also translates frontend camelCase ↔ backend snake_case. Base URL is relative `/api` in production, `VITE_API_URL` (default `http://localhost:5001/api`) in dev.

### Tooling

- **Lint:** ESLint (root config covers `.ts`/`.tsx` for both packages)
- **Orchestration:** `concurrently` runs both apps from the repo root
- **Local dev:** backend on **:5001**, frontend on **:3000/5173** (`npm run dev`)

---

## 3. Hosting Architecture

Single-server deployment. One AWS EC2 instance runs both the frontend (static files) and backend (Node process), with Nginx as a reverse proxy. Cloudflare sits in front for DNS, SSL, and CDN.

```
User
  │  https://sanhoti.org
  ▼
Cloudflare  (DNS, SSL/TLS termination, CDN, DDoS protection, hides origin IP)
  │  proxied → origin 44.220.179.207
  ▼
AWS EC2  (Ubuntu 22.04)
  ├─ Nginx  :80 / :443
  │    ├─ location /      → serves /var/www/sanhoti/frontend/dist (static SPA)
  │    └─ location /api   → proxy_pass http://localhost:5001
  └─ Node backend  :5001  (localhost only, managed by PM2 as "sanhoti-backend")
        └─ JSON data + uploaded media in /var/www/sanhoti/backend/data
```

The backend listens only on `localhost:5001` — it is never exposed to the internet. Only Nginx (ports 80/443) is reachable, which keeps the attack surface small.

---

## 4. AWS Details

| Item | Value |
|------|-------|
| AWS Account ID | `839444049194` |
| Region | US East (N. Virginia) — `us-east-1` |
| Instance type | t3.micro (or t2.micro) |
| AMI | Ubuntu Server 22.04 LTS |
| Public IPv4 | `44.220.179.207` |
| Public DNS | `ec2-44-220-179-207.compute-1.amazonaws.com` |
| App directory | `/var/www/sanhoti` |
| Process manager | PM2 (`sanhoti-backend`) |
| Web server | Nginx |
| SSH user | `ubuntu` (key: `sanhoti-keypair.pem`) |

**Security group** (`sanhoti-website-sg`) inbound rules:

- SSH (22) — My IP preferred
- HTTP (80) — `0.0.0.0/0`
- HTTPS (443) — `0.0.0.0/0`

> Note: the public IP can change if the instance is stopped/started. Use an Elastic IP if a static IP is needed.

---

## 5. Cloudflare / Domain

- **Domain:** `sanhoti.org` (plus `www.sanhoti.org`)
- **DNS:** A records for `@` and `www` → `44.220.179.207`, **Proxied** (orange cloud)
- **SSL/TLS mode:** Full (or Full strict if a valid origin cert is present)
- **Benefits:** free SSL, CDN caching, DDoS protection, origin IP hidden

**Origin SSL:** Let's Encrypt via Certbot on the server (`certbot --nginx -d sanhoti.org -d www.sanhoti.org`), auto-renewed. Certs live at `/etc/letsencrypt/live/sanhoti.org/`. HTTP is redirected to HTTPS at Nginx.

---

## 6. CI/CD & Deployment

- **Repo:** `git@github.com:debasisnice/Sanhoti.git`
- **Trigger:** push to `main` / `master` (or manual `workflow_dispatch`)
- **Workflow:** `.github/workflows/deploy.yml` — GitHub Actions SSHes into EC2 and runs a deploy script.

Deploy steps on the server:

1. Back up uploaded media and runtime JSON data (both gitignored) to `/tmp`.
2. `git fetch` + `git reset --hard origin/main` (or master).
3. Restore the backed-up media and JSON data over the fresh checkout.
4. Build backend (`npm ci` + `npm run build`).
5. Build frontend (`npm ci` + `npm run build`), with a sanity check that the bundle contains expected UI.
6. Restart backend via PM2, reload Nginx.
7. Verify step confirms PM2 process is `online` and Nginx is active.

**Required GitHub secrets:** `EC2_SSH_PRIVATE_KEY`, `EC2_HOST`, `EC2_USER`.

**Backend `.env` (on server):** `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `EMAIL_*`, `UPLOAD_DIR`.

---

## 7. Useful References (in `docs/`)

- `AWS_DEPLOYMENT_GUIDE.md`, `NEW_INSTANCE_DEPLOYMENT.md` — full server setup
- `CLOUDFLARE_DOMAIN_SETUP.md`, `SETUP_HTTPS_SANHOTI.md` — domain + SSL
- `SECURITY_GROUP_SETUP.md` — firewall rules
- `GITHUB_ACTIONS_SETUP.md`, `CI_CD_QUICK_START.md` — CI/CD
- `QUICK_START.md`, `SETUP.md` — local dev
- Troubleshooting: `FIX_*` docs (OOM, SSH, PM2, PDF, etc.)
