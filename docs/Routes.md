# Routes

Back to [[LangTour Overview]] | Related: [[Architecture]], [[Components]]

All routes are in `src/routes/` following SvelteKit file-based routing.

## Public Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `+page.svelte` | Homepage with tour discovery |
| `/tours/[tourId]` | `tours/[tourId]/+page.svelte` | Tour detail page |
| `/tours/[tourId]/rate` | `tours/[tourId]/rate/+page.svelte` | Submit tour rating |
| `/about` | `about/+page.svelte` | About page |

## Authentication Routes

| Route | File | Description |
|-------|------|-------------|
| `/login` | `login/+page.svelte` | User login |
| `/signup` | `signup/+page.svelte` | User registration |
| `/auth/confirm` | `auth/confirm/+page.svelte` | Email confirmation |

## Protected Routes (Requires Auth)

### User Routes

| Route | File | Description |
|-------|------|-------------|
| `/profile` | `profile/+page.svelte` | User profile management |
| `/bookings` | `bookings/+page.svelte` | User's tour bookings |

### Dashboard (Tour Creators)

| Route | File | Description |
|-------|------|-------------|
| `/dashboard` | `dashboard/+page.svelte` | Creator dashboard |
| `/dashboard/create` | `dashboard/create/+page.svelte` | Create new tour |
| `/dashboard/edit/[tourId]` | `dashboard/edit/[tourId]/+page.svelte` | Edit tour |
| `/dashboard/tours/[tourId]/schedule` | `dashboard/tours/[tourId]/schedule/+page.svelte` | Schedule tour |
| `/dashboard/schedules/[scheduleId]/manage` | `dashboard/schedules/[scheduleId]/manage/+page.svelte` | Manage attendees |

### Admin Routes

| Route | File | Description |
|-------|------|-------------|
| `/admin` | `admin/+page.svelte` | Admin dashboard |
| `/admin/create` | `admin/create/+page.svelte` | Admin tour creation |
| `/admin/edit/[tourId]` | `admin/edit/[tourId]/+page.svelte` | Admin tour editing |

## Route Hierarchy

```
routes/
├── +layout.svelte          # Root layout (NavBar, Footer)
├── +page.svelte            # Homepage
├── about/
├── login/
├── signup/
├── auth/
│   └── confirm/
├── profile/
├── bookings/
├── tours/
│   └── [tourId]/
│       ├── +page.svelte    # Tour detail
│       └── rate/
├── dashboard/
│   ├── +page.svelte        # Dashboard home
│   ├── create/
│   ├── edit/
│   │   └── [tourId]/
│   ├── tours/
│   │   └── [tourId]/
│   │       └── schedule/
│   └── schedules/
│       └── [scheduleId]/
│           └── manage/
└── admin/
    ├── +layout.svelte      # Admin layout (role check)
    ├── +page.svelte
    ├── create/
    └── edit/
        └── [tourId]/
```

## Auth Protection Pattern

Protected routes check authentication on mount:

```typescript
onMount(async () => {
  const user = await ConvexService.getAccount();
  if (!user) {
    goto('/login');
    return;
  }
  // Load page data
});
```

## Dynamic Routes

Routes with `[param]` are dynamic:
- `[tourId]` - Tour identifier
- `[scheduleId]` - Schedule identifier

Access params via `$page.params`:
```typescript
import { page } from '$app/stores';
const tourId = $page.params.tourId;
```
