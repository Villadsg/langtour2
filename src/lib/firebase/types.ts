import type { Timestamp } from 'firebase/firestore';

// Teaching material types for multi-stop tours
export interface VocabularyItem {
	word: string;
	translation: string;
	pronunciation?: string;
	context: string; // Example sentence
}

export interface DialogueLine {
	speaker: string;
	text: string;
	translation: string;
}

export interface Dialogue {
	title: string;
	participants: string[];
	lines: DialogueLine[];
}

export interface FactKeyword {
	word: string;
	translation: string;
}

export interface StopFact {
	text: string;
	category: 'cultural' | 'historical' | 'linguistic' | 'geographical';
	keywords: FactKeyword[];
}

export interface TeachingMaterial {
	vocabulary: VocabularyItem[];
	dialogues: Dialogue[];
	facts?: StopFact[];
	keywords?: FactKeyword[];
	teacherPlan?: string;
	generatedAt: number;
	languageTaught: string;
	instructionLanguage: string;
	cefrLevel: string;
}

export interface TourStopLocation {
	lat: number;
	lng: number;
	address: string;
	placeName?: string; // User-editable label
	placeType?: string; // cafe, museum, market, etc.
}

export interface TourStop {
	id: string;
	order: number;
	location: TourStopLocation;
	teachingMaterial?: TeachingMaterial;
}

export interface User {
	id: string;
	email: string;
	name?: string;
	username?: string;
	role: string;
	isAdmin: boolean;
}

export interface PublicProfile {
	userId: string;
	username: string;
	bio?: string;
	languagesSpoken?: string[];
	avatarUrl?: string;
	avatarStorageId?: string;
	memberSince?: number;
	updatedAt: Timestamp | number;
}

export interface UserRole {
	userId: string;
	role: string;
}

export interface TourDescription {
	name: string;
	cityId: string;
	languageTaught: string;
	instructionLanguage: string;
	langDifficulty?: string;
	description: string;
	tourType?: string;
	price?: number;
	stops?: TourStop[];
}

export interface Tour {
	id?: string;
	_id?: string;
	$id?: string;
	description: TourDescription;
	imageUrl?: string;
	imageStorageId?: string;
	creatorId: string;
	createdAt?: Timestamp | number;
	updatedAt?: Timestamp | number;
}

export interface Schedule {
	id?: string;
	_id?: string;
	$id?: string;
	tourId: string;
	scheduledDate: number;
	maxParticipants: number;
	meetingPoint: string;
	additionalInfo?: string;
	price?: number;
	createdAt?: Timestamp | number;
}

export interface Booking {
	id?: string;
	_id?: string;
	$id?: string;
	scheduleId: string;
	userId: string;
	name: string;
	email: string;
	participants: number;
	notes?: string;
	attended?: boolean;
	attendedAt?: number;
	createdAt?: Timestamp | number;
}

export interface Rating {
	id?: string;
	_id?: string;
	$id?: string;
	tourId: string;
	userId: string;
	languageLearningRating: number;
	informativeRating: number;
	funRating: number;
	comment?: string;
	createdAt?: Timestamp | number;
}

export interface Notification {
	id?: string;
	tourId: string;
	email: string;
	createdAt: number;
}

export interface AverageRatings {
	languageLearning: number;
	informative: number;
	fun: number;
	overall: number;
	count: number;
}

export interface ScheduledTour extends Schedule {
	tour?: Tour;
	bookingsCount?: number;
}

export interface UserBooking extends Booking {
	schedule?: Schedule;
	tour?: Tour;
}

// Types for paste-and-parse tour creation flow
export interface ParsedTourData {
	name?: string;
	languageTaught?: string;
	instructionLanguage?: string;
	langDifficulty?: string;
	description?: string;
	tourType?: string;
	cityName?: string; // For geocoding to cityId
	startingLocation?: string; // Becomes first tour stop
	stops: ParsedStopData[];
	rawText: string;
}

export interface ParsedStopData {
	placeName: string;
	addressOrDescription: string;
	placeType?: string;
	teachingMaterial?: TeachingMaterial; // If user included vocab/dialogues
	// Geocoding results
	location?: TourStopLocation;
	geocodeStatus: 'pending' | 'found' | 'not_found' | 'ambiguous';
	// For ambiguous results, store alternatives
	alternatives?: TourStopLocation[];
}

export interface MissingField {
	field: string;
	section: 'tour' | 'stop';
	stopIndex?: number;
	required: boolean;
}
