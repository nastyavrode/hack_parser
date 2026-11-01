export interface Hackathon {
  title: string;
  sourceUrl: string;
  sourceName: string;
  sourceProviderKey?: string;
  summary: string;
  description: string;
  format: 'ONLINE' | 'OFFLINE' | 'HYBRID' | null;
  ageMin: number | null;
  ageMax: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  registrationDeadline: Date | null;
  registrationUrl: string | null;
  location: 'barnaul' | 'altai' | 'russia' | 'international' | 'global' | null;
  priceType: 'FREE' | 'PAID' | 'UNKNOWN';
  directions: string[];
  rawText: string;
  needsReview: boolean;
  archiveCandidate?: boolean;
}

export interface HackathonProvider {
  readonly key: string;
  readonly name: string;
  isConfigured?(): boolean;
  fetchEvents(): Promise<Hackathon[]>;
}
