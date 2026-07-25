# Sanhoti — Agent Readiness (AI agent discovery)

Implements the applicable checks from isitagentready.com so AI agents can discover and read
Sanhoti's public data. Content usage policy: **search=yes, ai-input=yes, ai-train=no**.

## What was implemented (in code)

| Standard | What | Where |
|---|---|---|
| Content Signals (AIPREF) | `Content-Signal: search=yes, ai-input=yes, ai-train=no` | `frontend/public/robots.txt` |
| Link headers (RFC 8288) | `Link:` advertising api-catalog, sitemap, llms.txt, skills index | Express middleware (`server.ts`) + Nginx `add_header` |
| API catalog (RFC 9727) | `/.well-known/api-catalog` as `application/linkset+json` | `frontend/public/.well-known/api-catalog` + Nginx `default_type` |
| Agent Skills index (v0.2.0) | `/.well-known/agent-skills/index.json` + a skill `.md` with sha256 | `frontend/public/.well-known/agent-skills/` |
| Markdown for Agents | `Accept: text/markdown` → Markdown of any `/seo` page (+ `x-markdown-tokens`) | `SeoPageController.renderPage` + Nginx rewrite |
| llms.txt | Agent-facing site guide | `frontend/public/llms.txt` |
| WebMCP | `navigator.modelContext` tools (search events, concerts, Durga Puja) — feature-detected | `frontend/src/components/WebMcpProvider.tsx` |

## Deploy (two steps)

1. **Push to `main`** — deploys the static `.well-known/*`, `robots.txt`, `llms.txt`, the WebMCP
   provider, and the backend Link-header + Markdown-negotiation changes.
2. **On the EC2 box, apply the Nginx snippet, then purge Cloudflare:**
   ```bash
   sudo bash deploy/apply-agent-ready-nginx.sh
   # then Cloudflare dashboard → Caching → Purge Everything
   ```
   The script is idempotent and self-restoring (backs up, `nginx -t`, auto-rollback on failure),
   and prints verification at the end.

## Verify

```bash
curl -sI  https://www.sanhoti.org/ | grep -i link
curl -s   https://www.sanhoti.org/.well-known/api-catalog | head
curl -s   https://www.sanhoti.org/.well-known/agent-skills/index.json | head
curl -sI  https://www.sanhoti.org/robots.txt >/dev/null; curl -s https://www.sanhoti.org/robots.txt | grep Content-Signal
curl -s -H "Accept: text/markdown" https://www.sanhoti.org/durga-puja -o /dev/null -w "%{content_type}\n"
```

## DNS-AID (do this in Cloudflare — not code)

DNS-based agent discovery uses SVCB/HTTPS records under `_agents.sanhoti.org`, signed with DNSSEC.
Sanhoti has no agent API endpoint to advertise yet, so this is **optional**; add it only if/when you
expose one. Example records (Cloudflare DNS → add record → type HTTPS):

```
; advertise the site's agent entrypoint
_index._agents.sanhoti.org.  3600  IN  HTTPS  1 . ( alpn="h2" endpoint="https://www.sanhoti.org/.well-known/api-catalog" )
```

Then enable **DNSSEC** in Cloudflare (DNS → Settings → Enable DNSSEC) so validating resolvers get
authenticated answers. Spec: draft-mozleywilliams-dnsop-dnsaid; RFC 9460 (SVCB/HTTPS).

## Intentionally NOT implemented (would be false metadata)

- **OAuth/OIDC discovery** (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`)
  and **OAuth Protected Resource Metadata** — Sanhoti authenticates with a custom JWT login, not an
  OAuth2/OIDC authorization server. There is no issuer, `authorization_endpoint`, or `token_endpoint`
  to publish; advertising these would mislead agents. Revisit only if the API moves to real OAuth/OIDC.
- **auth.md agent registration** — no agent registration/identity system exists.
- **MCP Server Card** (`/.well-known/mcp/server-card.json`) — Sanhoti does not run an MCP server. (The
  WebMCP browser tools above are the in-page equivalent and are implemented.)

These are the correct "no" answers for this site, not gaps.
