# auth.md — Sanhoti Bengali Association of Orange County

Sanhoti's public data API is **read-only and requires no authentication**. AI agents can call
these endpoints directly with an HTTP `GET` — no API key, token, registration, or OAuth flow:

- `https://www.sanhoti.org/api/events` (also `/upcoming`, `/past`, `/{id}`)
- `https://www.sanhoti.org/api/durga-puja-page/active` and `/{year}`
- `https://www.sanhoti.org/api/sub-events/public`
- `https://www.sanhoti.org/sitemap.xml`

Machine-readable catalog: `https://www.sanhoti.org/.well-known/api-catalog`
Full endpoint guide: `https://www.sanhoti.org/.well-known/agent-skills/sanhoti-events.md`

## Registration

There is **no agent registration** and **no OAuth/OIDC authorization server**. Sanhoti does not
issue API keys or client credentials to third parties, and does not publish
`openid-configuration`, `oauth-authorization-server`, or `oauth-protected-resource` metadata
because there is no protected, agent-accessible resource that uses them.

## Administrative access

Content-management endpoints are restricted to Sanhoti staff through a private JWT login and are
**not available to third-party agents**. Please do not attempt to authenticate against them.

## Contact

For data or partnership questions: **info@sanhoti.org** · +1 949-378-6425
