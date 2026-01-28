# Services

Back to [[LangTour Overview]] | Related: [[Architecture]], [[Data Model]]

## FirebaseService

**File:** `src/lib/firebaseService.ts` (~1200 lines)

Main service layer handling all Firebase operations. Exported as `ConvexService` for backwards compatibility.

### Authentication

```typescript
// Create account
await ConvexService.createAccount(email, password, username);

// Login
await ConvexService.login(email, password);

// Logout
await ConvexService.logout();

// Get current user
const user = await ConvexService.getAccount();
```

### Tours

```typescript
// Get all tours
const tours = await ConvexService.getAllTours();

// Get single tour
const tour = await ConvexService.getTour(tourId);

// Get tours by creator
const myTours = await ConvexService.getCreatorTours(userId);

// Create tour
const tourId = await ConvexService.createTour(description, imageFile, creatorId);

// Update tour
await ConvexService.updateTour(tourId, description, imageFile);

// Delete tour
await ConvexService.deleteTour(tourId, imageStorageId);
```

### Schedules

```typescript
// Schedule a tour
const scheduleId = await ConvexService.scheduleTour({
  tourId, scheduledDate, maxParticipants, meetingPoint, additionalInfo, price
});

// Get scheduled tours
const schedules = await ConvexService.getScheduledTours(tourId);

// Cancel schedule
await ConvexService.cancelSchedule(scheduleId);
```

### Bookings

```typescript
// Book a tour
await ConvexService.bookTour({
  scheduleId, userId, name, email, participants, notes
});

// Get user's bookings
const bookings = await ConvexService.getUserBookings(userId);

// Get bookings for schedule
const attendees = await ConvexService.getBookingsForSchedule(scheduleId);

// Cancel booking
await ConvexService.cancelBooking(bookingId);

// Mark as attended
await ConvexService.markAsAttended(bookingId);
```

### Ratings

```typescript
// Submit rating
await ConvexService.submitTourRatings({
  tourId, userId, languageLearningRating, informativeRating, funRating, comment
});

// Get tour ratings
const ratings = await ConvexService.getTourRatings(tourId);

// Get average ratings
const avg = await ConvexService.getAverageTourRatings(tourId);

// Check if rated
const hasRated = await ConvexService.hasUserRatedTour(userId, tourId);
```

### User Profile

```typescript
// Get username
const name = await ConvexService.getUsernameById(userId);

// Update profile
await ConvexService.updateUserProfile(userId, { username });

// Check admin status
const isAdmin = await ConvexService.isUserAdmin(userId);
```

### File Storage

```typescript
// Upload file
const { url, storageId } = await ConvexService.uploadFile(file);

// Delete file
await ConvexService.deleteFile(storageId);
```

---

## GeminiService

**File:** `src/lib/geminiService.ts` (~600 lines)

AI integration using Google Gemini 2.0 Flash API.

### Methods

```typescript
// Generate follow-up question for tour creation
const question = await generateFollowUpQuestion(conversationHistory, missingFields);

// Create tour description from conversation
const description = await createCohesiveDescription(conversationHistory);

// Spell/grammar check
const corrected = await correctText(text);

// Get suggestions for missing fields
const suggestions = await generateSuggestions(partialData);

// Analyze description quality
const feedback = await analyzeTourDescription(description);
```

### Features
- Exponential backoff retry logic
- Rate limiting protection
- Structured output parsing
- Context-aware responses

---

## Cloud Functions

**File:** `functions/src/index.ts`

### onUserCreate
**Trigger:** Firebase Auth user creation

Creates initial user data:
- Public profile document
- Default user role

### sendRatingNotificationEmail
**Trigger:** HTTPS callable

Sends email notification to request tour rating.
- Uses Resend API
- Saves notification record

### onTourDelete
**Trigger:** Firestore document delete

Cascading cleanup:
- Deletes related schedules
- Deletes bookings
- Deletes ratings
- Removes images from Storage

---

## Usage Pattern

```typescript
import { ConvexService } from '$lib/firebaseService';
import { generateFollowUpQuestion } from '$lib/geminiService';

// In component
const tours = await ConvexService.getAllTours();

// AI features
const question = await generateFollowUpQuestion(history, missing);
```
