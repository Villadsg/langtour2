 # Data Model

Back to [[LangTour Overview]] | Related: [[Services]], [[Architecture]]

Firestore NoSQL database structure.

## Collections Overview

```
Firestore
├── tours/
├── schedules/
├── bookings/
├── ratings/
├── publicProfiles/
├── userRoles/
└── notifications/
```

## Entity Relationship

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ creates
       ▼
┌─────────────┐     has many    ┌─────────────┐
│    Tour     │────────────────▶│  Schedule   │
└──────┬──────┘                 └──────┬──────┘
       │                               │
       │ has many                      │ has many
       ▼                               ▼
┌─────────────┐                 ┌─────────────┐
│   Rating    │                 │   Booking   │
└─────────────┘                 └─────────────┘
```

## Collections Detail

### tours

```typescript
interface Tour {
  id: string;
  description: TourDescription;
  imageUrl: string;
  imageStorageId: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TourDescription {
  title: string;
  language: string;
  city: string;
  description: string;
  tourType: 'person' | 'app';
}
```

### schedules

```typescript
interface Schedule {
  id: string;
  tourId: string;           // Reference to tours/
  scheduledDate: Timestamp;
  maxParticipants: number;
  meetingPoint: string;
  additionalInfo?: string;
  price?: number;
  createdAt: Timestamp;
}
```

### bookings

```typescript
interface Booking {
  id: string;
  scheduleId: string;       // Reference to schedules/
  userId: string;           // Reference to user
  name: string;
  email: string;
  participants: number;
  notes?: string;
  attended: boolean;
  attendedAt?: Timestamp;
  createdAt: Timestamp;
}
```

### ratings

```typescript
interface Rating {
  id: string;
  tourId: string;           // Reference to tours/
  userId: string;           // Reference to user
  languageLearningRating: number;  // 1-5
  informativeRating: number;       // 1-5
  funRating: number;               // 1-5
  comment?: string;
  createdAt: Timestamp;
}
```

### publicProfiles

```typescript
interface PublicProfile {
  id: string;
  userId: string;
  username: string;
  updatedAt: Timestamp;
}
```

### userRoles

```typescript
interface UserRole {
  id: string;
  userId: string;
  role: 'user' | 'guide' | 'admin';
}
```

### notifications

```typescript
interface Notification {
  id: string;
  tourId: string;
  email: string;
  createdAt: Timestamp;
}
```

## Type Definitions

All types defined in `src/lib/firebase/types.ts`:

```typescript
// User type
interface User {
  id: string;
  email: string;
  username: string;
}

// Average ratings aggregate
interface AverageRatings {
  languageLearning: number;
  informative: number;
  fun: number;
  count: number;
}
```

## Security Rules

**File:** `firestore.rules`

Key rules:
- Users can only read/write their own data
- Tour creators can manage their tours
- Admin role has elevated access
- Public profiles are readable by all

## Indexes

Common query patterns require composite indexes:
- Tours by city
- Schedules by tourId + date
- Bookings by userId
- Ratings by tourId
