# Configuration

Back to [[LangTour Overview]]

## Environment Variables

**File:** `.env.example`

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# AI Integration
PUBLIC_GEMINI_API_KEY=
```

## Config Files

### SvelteKit (`svelte.config.js`)
- Adapter: adapter-auto
- Vite preprocessing

### Vite (`vite.config.ts`)
- Tailwind CSS plugin
- SvelteKit plugin
- File system configuration

### TypeScript (`tsconfig.json`)
- Strict mode enabled
- Source maps enabled
- Module resolution: bundler

### Tailwind (`app.css`)
- Tailwind directives
- Custom utilities
- Plugin imports

## Firebase Configuration

### Client (`src/lib/firebase/config.ts`)
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

### Security Rules

**Firestore:** `firestore.rules`
**Storage:** `storage.rules`

## Scripts

**File:** `package.json`

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite dev` | Development server |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Preview build |
| `check` | `svelte-kit sync && svelte-check` | Type checking |
| `lint` | `eslint .` | Code linting |
| `format` | `prettier --write .` | Code formatting |
| `test` | `playwright test` | E2E tests |

## Dependencies

### Production
- `firebase` ^11.2.0
- `@google/generative-ai` ^0.24.1

### Development
- `@sveltejs/kit` ^2.16.0
- `svelte` ^5.0.0
- `typescript` ^5.0.0
- `tailwindcss` ^4.0.0
- `playwright` ^1.40.0
- `eslint` ^9.0.0
- `prettier` ^3.0.0

## Testing

**File:** `playwright.config.ts`

- E2E test configuration
- Test files in `tests/`
- Conversation recording support
