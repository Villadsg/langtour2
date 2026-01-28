# LangTour

A SvelteKit language learning tour booking platform with Firebase backend and AI-powered features.

## Quick Links

- [[Architecture]]
- [[Components]]
- [[Routes]]
- [[Services]]
- [[Data Model]]
- [[Configuration]]

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit 2.16, Svelte 5.0, TypeScript |
| Styling | Tailwind CSS 4.0 |
| Backend | Firebase (Auth, Firestore, Storage, Functions) |
| AI | Google Gemini 2.0 Flash |
| Testing | Playwright |

## Core Features

1. **Tour Discovery** - Browse tours by language and city
2. **Tour Creation** - AI-assisted tour creation with Gemini
3. **Scheduling & Bookings** - Schedule tours and manage reservations
4. **Ratings & Reviews** - Three-dimensional rating system
5. **User Management** - Role-based access (user, guide, admin)

## Directory Structure

```
langtour2/
├── src/
│   ├── lib/           # Shared utilities and components
│   │   ├── components/
│   │   ├── firebase/
│   │   ├── stores/
│   │   └── styles/
│   └── routes/        # SvelteKit pages
├── functions/         # Firebase Cloud Functions
├── tests/             # Playwright E2E tests
└── static/            # Static assets
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/firebaseService.ts` | Main service layer (~1200 lines) |
| `src/lib/geminiService.ts` | AI integration (~600 lines) |
| `functions/src/index.ts` | Cloud functions |
| `src/lib/firebase/types.ts` | TypeScript interfaces |

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run check    # Type checking
npm run test     # E2E tests
```
