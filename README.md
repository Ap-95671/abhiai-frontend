# AbhiAI Frontend

AbhiAI's frontend is a Next.js 16 and React 19 authenticated workspace for AI
chat and social discovery.

## Current features

- Registration and JWT login
- Stored conversations with streaming AI responses and cancellation
- Conversation creation, rename, deletion, and history
- People and visibility-aware post search
- Social notifications with unread counts and read-state controls
- Home feed with public, followers-only, and private post creation
- Likes, replies, reposts, bookmarks, post deletion, and interaction counts
- User profiles with editing and follow/unfollow controls
- Responsive desktop and mobile layouts
- Loading, empty, validation, session-expiry, and API-error states

The browser API client lives in `src/lib/api.ts`. The main authenticated shell
and chat flow live in `src/app/page.tsx`; independent social feature state is
kept in `src/components/search-panel.tsx` and
`src/components/notifications-panel.tsx`.

## Run locally

From this directory:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend uses
`NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:8080/api/v1`.

## Verify

```bash
npm run lint
npm run build
```

From the parent AbhiAI directory, the production-like stack can be rebuilt with:

```bash
docker compose up -d --build
```

## Deploy to Vercel

Deploy this Next.js application from its own GitHub repository and `main`
branch. Vercel detects Next.js and runs `npm run build` automatically.

Configure one public production variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://<render-backend>.onrender.com/api/v1
```

This is a public API location, not a secret. JWT secrets, database credentials,
AI-provider keys, and R2 credentials belong only in Render. After Vercel creates
the first HTTPS deployment, copy its exact origin to the backend's
`ALLOWED_ORIGINS` variable and redeploy the backend. Each later push to `main`
creates a new production deployment automatically.
