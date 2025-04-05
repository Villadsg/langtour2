import { writable } from 'svelte/store';

export interface Tour {
    id: string;
    cityId: string;
    name: string;
    language: string;
    description: string;
    imageUrl?: string;
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
    { id: 'paris', name: 'Paris', country: 'France', imageUrl: '/images/paris.jpg' },
    { id: 'barcelona', name: 'Barcelona', country: 'Spain', imageUrl: '/images/barcelona.jpg' },
    { id: 'rome', name: 'Rome', country: 'Italy', imageUrl: '/images/rome.jpg' },
    { id: 'berlin', name: 'Berlin', country: 'Germany', imageUrl: '/images/berlin.jpg' },
    { id: 'tokyo', name: 'Tokyo', country: 'Japan', imageUrl: '/images/tokyo.jpg' }
];

const tours: Tour[] = [
    { 
        id: 'paris-french-1', 
        cityId: 'paris', 
        name: 'Parisian French Immersion', 
        language: 'French',
        description: 'Explore the charming streets of Paris while learning authentic French from locals. This tour covers essential phrases, cultural etiquette, and includes visits to iconic Parisian cafés where you can practice your skills.'
    },
    { 
        id: 'paris-french-2', 
        cityId: 'paris', 
        name: 'French Art & Language', 
        language: 'French',
        description: 'Combine art appreciation with language learning as you visit the Louvre and Musée d\'Orsay. Learn vocabulary related to art and culture while admiring masterpieces.'
    },
    { 
        id: 'barcelona-spanish-1', 
        cityId: 'barcelona', 
        name: 'Spanish in Barcelona', 
        language: 'Spanish',
        description: 'Learn Spanish while exploring Barcelona\'s vibrant neighborhoods. This tour focuses on practical conversation skills and Catalan cultural insights.'
    },
    { 
        id: 'barcelona-catalan-1', 
        cityId: 'barcelona', 
        name: 'Catalan Basics', 
        language: 'Catalan',
        description: 'Discover the unique Catalan language with native speakers. This tour takes you through the Gothic Quarter while teaching you essential Catalan phrases and local traditions.'
    },
    { 
        id: 'rome-italian-1', 
        cityId: 'rome', 
        name: 'Roman Italian Adventure', 
        language: 'Italian',
        description: 'Learn Italian while visiting ancient Roman sites. This tour combines history lessons with language practice, focusing on pronunciation and everyday conversation.'
    },
    { 
        id: 'berlin-german-1', 
        cityId: 'berlin', 
        name: 'Berlin German Basics', 
        language: 'German',
        description: 'Get comfortable with German language fundamentals while exploring Berlin\'s diverse neighborhoods. Perfect for beginners wanting to learn practical phrases.'
    },
    { 
        id: 'tokyo-japanese-1', 
        cityId: 'tokyo', 
        name: 'Tokyo Japanese Essentials', 
        language: 'Japanese',
        description: 'Navigate Tokyo while learning essential Japanese phrases. This tour covers basic greetings, ordering food, and reading simple signs.'
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
