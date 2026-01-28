# Architecture

Back to [[LangTour Overview]]

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    SvelteKit Frontend                    │
├─────────────────────────────────────────────────────────┤
│  Routes (Pages)  │  Components  │  Stores (State)       │
└────────┬─────────┴──────────────┴───────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
├──────────────────────────┬──────────────────────────────┤
│    firebaseService.ts    │     geminiService.ts         │
│    (Backend Operations)  │     (AI Integration)         │
└────────┬─────────────────┴────────────┬─────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐
│      Firebase       │      │   Google Gemini     │
│  - Auth             │      │   2.0 Flash API     │
│  - Firestore        │      └─────────────────────┘
│  - Storage          │
│  - Cloud Functions  │
└─────────────────────┘
```

## Layers

### 1. Presentation Layer
- **[[Components]]** - Reusable Svelte components
- **[[Routes]]** - SvelteKit file-based routing
- **Styles** - Tailwind CSS + Design System tokens

### 2. State Management
- **Svelte Stores** (`src/lib/stores/tourStore.ts`)
  - `citiesStore` - Available cities
  - `toursStore` - Tour catalog
  - `notificationsStore` - Notification queue
  - `currentUser` - Auth state
  - `isAdmin` - Role state

### 3. Service Layer
- **[[Services#FirebaseService|FirebaseService]]** - All backend operations
- **[[Services#GeminiService|GeminiService]]** - AI-powered features

### 4. Backend (Firebase)
- **Authentication** - Email/password auth
- **Firestore** - NoSQL database (see [[Data Model]])
- **Storage** - Image uploads
- **Cloud Functions** - Serverless triggers

## Key Patterns

### Reactive State
```svelte
<script>
  import { currentUser, isAdmin } from '$lib/stores/tourStore';

  // Reactive subscription
  $: loggedIn = $currentUser !== null;
</script>
```

### Service Layer Pattern
All Firebase operations go through `firebaseService.ts`:
```typescript
import { ConvexService } from '$lib/firebaseService';

const tours = await ConvexService.getAllTours();
```

### Protected Routes
Routes check auth state and redirect:
```typescript
onMount(async () => {
  const user = await ConvexService.getAccount();
  if (!user) goto('/login');
});
```

## Related
- [[Data Model]]
- [[Services]]
- [[Configuration]]
