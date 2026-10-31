export interface Hackathon {
  id: number;
  title: string;
  source_url: string;
  source_name: string;
  format: 'offline' | 'online';
  location: string;
  age_min: number;
  age_max: number;
  directions: string[];
  description: string;
  registration_deadline: string;
  event_dates: string;
  raw_text: string;
  date_parsed: string;
  needs_review: boolean;
}

export interface FilterState {
  search: string;
  format: 'all' | 'offline' | 'online';
  ageRange: [number, number];
  directions: string[];
  showNeedsReview: boolean;
}
