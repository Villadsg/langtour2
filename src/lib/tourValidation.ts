// Tour validation utility for paste-and-parse flow

import type { ParsedTourData, MissingField, TourStop } from '$lib/firebase/types';

// Shared utility to extract structured tour data from a raw tour document.
// The description field may be a JSON string, a plain string, or an object.
export function getTourData(tourDoc: any): {
  id: string;
  name: string;
  cityId: string;
  language: string;
  languageTaught: string;
  instructionLanguage: string;
  langDifficulty: string;
  description: string;
  imageUrl: string;
  tourType: string;
  price: number;
} {
  const defaults = {
    id: '',
    name: 'Tour',
    cityId: '',
    language: '',
    languageTaught: '',
    instructionLanguage: '',
    langDifficulty: '',
    description: '',
    imageUrl: '',
    tourType: 'person',
    price: 0
  };

  if (!tourDoc) return defaults;

  let tourData: Record<string, any> = {};

  try {
    if (tourDoc.description) {
      if (typeof tourDoc.description === 'string') {
        const trimmed = tourDoc.description.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          tourData = JSON.parse(trimmed);
        } else {
          tourData = {
            name: trimmed.split('\n')[0] || 'Tour',
            description: trimmed
          };
        }
      } else if (typeof tourDoc.description === 'object') {
        tourData = tourDoc.description;
      }
    }
  } catch {
    tourData = {
      name: 'Tour',
      description: typeof tourDoc.description === 'string' ? tourDoc.description : ''
    };
  }

  // Prefer top-level doc fields, then fall back to parsed data
  const tourType = tourDoc.tourType || tourData.tourType || 'person';

  return {
    id: tourDoc.id || tourDoc.$id || '',
    name: tourDoc.name || tourData.name || defaults.name,
    cityId: tourData.cityId || defaults.cityId,
    language: tourData.language || tourData.languageTaught || defaults.language,
    languageTaught: tourData.languageTaught || defaults.languageTaught,
    instructionLanguage: tourData.instructionLanguage || defaults.instructionLanguage,
    langDifficulty: tourData.langDifficulty || defaults.langDifficulty,
    description: tourData.description || defaults.description,
    imageUrl: tourDoc.image_url || tourDoc.imageUrl || tourData.imageUrl || defaults.imageUrl,
    tourType,
    price: tourData.price ?? 0
  };
}

// Extract stops from a tour document (description stored as JSON string or object)
export function getStops(tourDoc: any): TourStop[] {
  if (!tourDoc?.description) return [];
  try {
    let desc = tourDoc.description;
    if (typeof desc === 'string') {
      const trimmed = desc.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        desc = JSON.parse(trimmed);
      } else {
        return [];
      }
    }
    return Array.isArray(desc.stops) ? desc.stops : [];
  } catch {
    return [];
  }
}

// Required fields for publishing a tour
const REQUIRED_TOUR_FIELDS = ['name', 'languageTaught', 'instructionLanguage', 'description'] as const;

// Optional but recommended fields
const OPTIONAL_TOUR_FIELDS = ['langDifficulty', 'tourType', 'cityName'] as const;

// Field display names for user-friendly messages
const FIELD_LABELS: Record<string, string> = {
  name: 'Tour Name',
  languageTaught: 'Language to Teach',
  instructionLanguage: 'Instruction Language',
  langDifficulty: 'Difficulty Level',
  description: 'Description',
  tourType: 'Tour Type',
  cityName: 'City',
  placeName: 'Place Name',
  location: 'Location'
};

export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

// Get list of missing fields from parsed tour data
export function getMissingFields(data: ParsedTourData): MissingField[] {
  const missing: MissingField[] = [];

  // Check required tour fields
  for (const field of REQUIRED_TOUR_FIELDS) {
    const value = data[field as keyof ParsedTourData];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push({
        field,
        section: 'tour',
        required: true
      });
    }
  }

  // Check optional tour fields
  for (const field of OPTIONAL_TOUR_FIELDS) {
    const value = data[field as keyof ParsedTourData];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push({
        field,
        section: 'tour',
        required: false
      });
    }
  }

  // Check if there's at least one stop
  if (!data.stops || data.stops.length === 0) {
    missing.push({
      field: 'stops',
      section: 'tour',
      required: true
    });
  } else {
    // Check each stop for valid location
    data.stops.forEach((stop, index) => {
      if (!stop.placeName || stop.placeName.trim() === '') {
        missing.push({
          field: 'placeName',
          section: 'stop',
          stopIndex: index,
          required: true
        });
      }

      if (stop.geocodeStatus === 'not_found' || !stop.location) {
        missing.push({
          field: 'location',
          section: 'stop',
          stopIndex: index,
          required: true
        });
      } else if (stop.geocodeStatus === 'ambiguous') {
        // Ambiguous is not missing, but should be noted
        missing.push({
          field: 'location',
          section: 'stop',
          stopIndex: index,
          required: false // Mark as optional since there IS a location, just ambiguous
        });
      }
    });
  }

  return missing;
}

// Get only required missing fields
export function getRequiredMissingFields(data: ParsedTourData): MissingField[] {
  return getMissingFields(data).filter(f => f.required);
}

// Get only optional missing fields
export function getOptionalMissingFields(data: ParsedTourData): MissingField[] {
  return getMissingFields(data).filter(f => !f.required);
}

// Check if tour can be published
export function canPublish(data: ParsedTourData): boolean {
  const required = getRequiredMissingFields(data);
  return required.length === 0;
}

// Get a summary message about missing fields
export function getMissingSummary(data: ParsedTourData): string {
  const required = getRequiredMissingFields(data);
  const optional = getOptionalMissingFields(data);

  if (required.length === 0 && optional.length === 0) {
    return 'All fields are complete. Ready to create tour.';
  }

  const parts: string[] = [];

  if (required.length > 0) {
    parts.push(`${required.length} required field${required.length > 1 ? 's' : ''} missing`);
  }

  if (optional.length > 0) {
    parts.push(`${optional.length} optional field${optional.length > 1 ? 's' : ''} could be added`);
  }

  return parts.join(', ');
}

// Group missing fields by section for display
export function groupMissingFields(fields: MissingField[]): {
  tour: MissingField[];
  stops: Map<number, MissingField[]>;
} {
  const tour: MissingField[] = [];
  const stops = new Map<number, MissingField[]>();

  for (const field of fields) {
    if (field.section === 'tour') {
      tour.push(field);
    } else if (field.section === 'stop' && field.stopIndex !== undefined) {
      const existing = stops.get(field.stopIndex) || [];
      existing.push(field);
      stops.set(field.stopIndex, existing);
    }
  }

  return { tour, stops };
}
