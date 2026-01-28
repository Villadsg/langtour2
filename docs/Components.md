# Components

Back to [[LangTour Overview]] | Related: [[Architecture]]

All components are located in `src/lib/components/`.

## Form Components

### TourForm.svelte
Standard tour creation/editing form.
- Fields: title, language, city, description, tour type, image
- Used in: [[Routes#Dashboard|Dashboard]] create/edit pages

### AITourForm.svelte
AI-assisted tour creation using Gemini.
- Conversational interface for gathering tour info
- Auto-generates descriptions from user input
- Uses [[Services#GeminiService|GeminiService]]

### editTourForm.svelte
Dedicated tour editing interface with pre-populated data.

### NotificationForm.svelte
Email subscription form for tour notifications.

### DateTimePicker.svelte
Reusable date/time selection widget for scheduling.

## Map Components

### BasicMapPicker.svelte
Simple map-based location picker for meeting points.

### SimpleMapPicker.svelte
Alternative map implementation with simpler interface.

## Display Components

### TourCard.svelte
Tour preview card showing:
- Tour image
- Title, language, city
- Average ratings
- Creator info
- Quick actions

```svelte
<TourCard
  tour={tour}
  averageRatings={ratings}
/>
```

### NavBar.svelte
Main navigation bar.
- Logo and branding
- Navigation links
- Auth state display (login/profile)
- Responsive mobile menu

### CityCard.svelte
City showcase card for homepage city selection.

### Section.svelte
Layout wrapper component for consistent spacing.

### FeatureCard.svelte
Feature highlight card for marketing sections.

### Testimonial.svelte
User testimonial display component.

### FlyNotification.svelte
Animated toast notification display.
- Uses fly transition
- Auto-dismiss

### CallToAction.svelte
CTA button component with consistent styling.

## Design System

### DesignSystem.svelte
Centralized design tokens:
- Color gradients
- Typography scales
- Spacing system
- Component variants

Located at `src/lib/styles/DesignSystem.svelte`

## Component Map

```
components/
├── Form
│   ├── TourForm.svelte
│   ├── AITourForm.svelte
│   ├── editTourForm.svelte
│   ├── NotificationForm.svelte
│   └── DateTimePicker.svelte
├── Map
│   ├── BasicMapPicker.svelte
│   └── SimpleMapPicker.svelte
└── Display
    ├── TourCard.svelte
    ├── NavBar.svelte
    ├── CityCard.svelte
    ├── Section.svelte
    ├── FeatureCard.svelte
    ├── Testimonial.svelte
    ├── FlyNotification.svelte
    └── CallToAction.svelte
```
