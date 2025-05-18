import { writable } from 'svelte/store';

export interface Tour {
    id: string;
    cityId: string;
    name: string;
    language: string;
    description: string;
    imageUrl?: string;
    tourType?: string;
}

export interface City {
    id: string;
    name: string;
    country: string;
    imageUrl?: string;
}

export interface Notification {
    email: string;
    tourId: string;
    timestamp: Date;
}

// Initial data
const cities: City[] = [
    { id: 'madrid', name: 'Madrid', country: 'Spain' },
    { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark' }
];

const tours: Tour[] = [
    {
        id: 'madrid-spanish-immersion',
        cityId: 'madrid',
        name: 'Madrid Spanish Immersion',
        language: 'Spanish',
        description: 'Immerse yourself in Spanish as you explore Madrid’s vibrant neighborhoods, local markets, and tapas bars. Practice conversational skills with native speakers and learn about Spanish culture firsthand.'
    },
    {
        id: 'madrid-art-culture',
        cityId: 'madrid',
        name: 'Art & Spanish in Madrid',
        language: 'Spanish',
        description: 'Combine art appreciation with language learning as you visit the Prado Museum and Reina Sofía. Learn vocabulary related to art and history while engaging with local guides.'
    },
    {
        id: 'copenhagen-danish-basics',
        cityId: 'copenhagen',
        name: 'Copenhagen Danish Basics',
        language: 'Danish',
        description: 'Learn fundamental Danish phrases while exploring Copenhagen’s iconic landmarks like Nyhavn and the Little Mermaid. Focus on greetings, ordering food, and basic conversation.'
    },
    {
        id: 'copenhagen-hygge-language',
        cityId: 'copenhagen',
        name: 'Hygge & Language in Copenhagen',
        language: 'Danish',
        description: 'Experience the Danish concept of Hygge while practicing language skills in cozy cafés and historic neighborhoods. Learn vocabulary around comfort, community, and everyday life.'
    }
];

// Create stores
export const citiesStore = writable<City[]>(cities);
export const toursStore = writable<Tour[]>(tours);
export const notificationsStore = writable<Notification[]>([]);

// Store functions
export function getToursByCity(cityId: string): Tour[] {
    return tours.filter(tour => tour.cityId === cityId);
}

export function getTourById(tourId: string): Tour | undefined {
    return tours.find(tour => tour.id === tourId);
}

export function addNotification(email: string, tourId: string): void {
    const notification: Notification = {
        email,
        tourId,
        timestamp: new Date()
    };
    
    notificationsStore.update(notifications => [...notifications, notification]);
    // In a real app, this would also save to a database or API
}
