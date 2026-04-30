# LangTour2

A SvelteKit app for creating, browsing, and booking language-immersion tours. Hosts can paste freeform tour descriptions and have them parsed into structured data by a local LLM; travelers can browse tours on a map and book.

## Tech stack

- **Frontend:** SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4
- **Backend:** Firebase (auth, Firestore)
- **AI extraction:** [NuExtract 1.5](https://huggingface.co/numind/NuExtract-1.5) running locally via [Ollama](https://ollama.com/)
- **Maps:** Leaflet + Nominatim geocoding
- **Deploy:** Vercel (`@sveltejs/adapter-vercel`)
- **Tests:** Playwright

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your Firebase project credentials:

```bash
cp .env.example .env
```

### 3. Set up Ollama (for AI tour extraction)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull iodose/nuextract-v1.5
ollama pull qwen2.5:1.5b
ollama serve
```

### 4. Run the dev server

```bash
npm run dev          # or: npm run dev -- --open
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run check` | Type-check with `svelte-check` |
| `npm run lint` | Prettier + ESLint check |
| `npm run format` | Format with Prettier |
| `npm test` | Run Playwright tests |

## Project structure

```
src/
  lib/
    services/         # Firebase, geocoding, NuExtract clients
    styles/           # DesignSystem.svelte (shared tokens)
    tourValidation.ts # Tour-doc parsing helpers
  routes/
    admin/  api/  auth/  bookings/  create-with-ai/
    dashboard/  login/  profile/  signup/  tours/
```

## Deployment

The app is configured for Vercel via `adapter-vercel`. Note that the local Ollama-based extraction won't work in a serverless deploy without pointing it at a hosted Ollama endpoint.
