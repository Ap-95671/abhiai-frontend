# AbhiAI Frontend

<p align="center">
  <img src="public/abhiai-logo.png" alt="AbhiAI logo" width="112" />
</p>

The web client for **AbhiAI**—a unified AI assistant and social platform. It provides authenticated chat, model selection, multimodal composition, and social discovery through a responsive, high-contrast interface built with Next.js and React.

> **Status:** active development. The core assistant and social workspace are implemented. Reliability, accessibility, testing, advanced multimodal experiences, and production delivery are tracked in the public [AbhiAI Development Roadmap](https://github.com/users/Ap-95671/projects/2).

## Product capabilities

### AI workspace

- Registration, login, protected routes, and session-expiry handling
- Stored conversations with create, select, rename, and delete workflows
- Progressive assistant streaming and stop-generation control
- Backend-driven model catalog and manual model selection
- Requested, selected, and fallback model attribution
- Image, PDF, and text attachment composition
- External-AI processing confirmation for selected attachments
- Image generation tools and clear provider error states
- Responsive near-black AbhiAI design system

### Social workspace

- Home feed and visibility-aware post creation
- Profiles, follow controls, search, and notifications
- Likes, replies, reposts, bookmarks, polls, and articles
- Direct messages, group conversations, and communities
- Stories, video feeds, hashtags, mentions, and creator analytics
- Block, mute, reporting, and moderation affordances
- Navigation between assistant and social product areas

## Architecture

The browser talks only to the AbhiAI backend. AI provider credentials and provider-specific SDK decisions stay server-side.

```text
Next.js routes and components
          │
          ▼
src/lib/api.ts ── typed HTTP / streaming boundary
          │
          ▼
AbhiAI backend ── auth, data, model routing, providers, storage
```

Important areas:

```text
src/
├── app/
│   ├── page.tsx       landing page
│   ├── login/         authentication route
│   ├── chat/          AI workspace route
│   └── social/        social workspace route
├── components/
│   ├── auth/          authentication experience
│   ├── branding/      AbhiAI visual identity
│   ├── chat/          composer tools and generation states
│   └── *.tsx          social product panels
└── lib/api.ts         backend API and streaming client
```

This boundary allows the backend to add, replace, or route between AI providers—including future Abhena implementations—without restructuring the frontend.

## Technology

- Next.js 16.3
- React 19.2
- TypeScript 5
- Tailwind CSS 4 and CSS Modules
- ESLint 9
- Docker

## Local development

### Prerequisites

- Node.js 20 or newer
- npm
- A running AbhiAI backend

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure the backend URL

```bash
cp .env.example .env.local
```

The default value is:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

This variable is intentionally public because it is only an API location. Never place database passwords, JWT secrets, AI-provider keys, storage keys, or other server credentials in a `NEXT_PUBLIC_*` variable.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run build
```

The audited main branch passes both commands. Automated unit, component, accessibility, and end-to-end coverage is the next frontend quality milestone.

## Available routes

| Route | Purpose |
| --- | --- |
| `/` | Public AbhiAI landing page |
| `/login` | Account registration and login |
| `/chat` | Authenticated AI workspace |
| `/social` | Authenticated social workspace |

## Docker

Build the standalone frontend container from this repository, or run the complete stack from the parent AbhiAI workspace:

```bash
docker compose up -d --build
```

## Deployment to Vercel

1. Import `Ap-95671/abhiai-frontend` into Vercel.
2. Keep the framework preset as Next.js and use the repository root.
3. Configure:

   ```text
   NEXT_PUBLIC_API_BASE_URL=https://<backend-host>/api/v1
   ```

4. Add the exact Vercel HTTPS origin to the backend `ALLOWED_ORIGINS` value.
5. Redeploy both sides after changing their cross-origin configuration.

All secrets remain in the backend hosting platform. Vercel should contain only public frontend configuration for this project.

## UX principles

- AbhiAI remains visually original while using a true-black, premium dark foundation.
- Model availability is factual: unconfigured or coming-soon models are not presented as usable.
- Streaming, cancellation, fallback, loading, and provider failure states remain understandable.
- Mobile layouts must not overlap the composer, menus, or navigation.
- Interactive controls require visible focus, keyboard support, readable labels, and sufficient contrast.
- AI-assisted social content remains opt-in and clearly attributable.

## Security

- `.env.local` and other environment files are ignored; `.env.example` contains public placeholders only.
- The frontend never connects directly to an AI provider or database.
- Authentication and authorization are enforced by the backend, not trusted to client state.
- Uploaded content is treated as untrusted and processed through backend validation.
- If a secret appears in Git history, screenshots, logs, or browser-visible code, rotate it immediately.

## Roadmap and contributing

- [Development Roadmap](https://github.com/users/Ap-95671/projects/2)
- [Frontend issues](https://github.com/Ap-95671/abhiai-frontend/issues)
- [Backend repository](https://github.com/Ap-95671/abhiai-backend)

Before opening a pull request:

1. Link the relevant roadmap issue.
2. Keep backend communication inside the API client boundary.
3. Preserve authentication, responsive, loading, empty, and error states.
4. Add proportionate tests as the frontend test framework lands.
5. Run `npm run lint` and `npm run build`.
6. Confirm no secret or generated build output is staged.

## License

No open-source license has been selected yet. All rights are reserved by the project owner until a license file is added.
