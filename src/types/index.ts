export type Uuid = string;
export type HHMM = string; // '12:30'

export const FOOD_CATEGORIES = ['pizza','sushi','burgers','salad','asian','mexican',
  'mediterranean','indian','bbq','sandwiches','soup','bowls'] as const;
export type FoodCategory = typeof FOOD_CATEGORIES[number];

export const DIETARY_TAGS = ['vegetarian','vegan','gluten_free','lactose_free','halal','kosher','nut_free'] as const;
export type DietaryTag = typeof DIETARY_TAGS[number];

export const TRANSPORT_MODES = ['walk','car','delivery'] as const;
export type TransportMode = typeof TRANSPORT_MODES[number];

export type Attendance = 'yes' | 'maybe' | 'no';
export type SessionStatus = 'collecting' | 'voting' | 'closed';

export interface Restaurant {
  id: string; name: string; emoji: string; description: string;
  categories: FoodCategory[]; avgPrice: number; dietary: DietaryTag[];
  walkMinutes: number; supportsDelivery: boolean; deliveryMinutes: number | null;
  opensAt: HHMM; closesAt: HHMM; rating?: number;
  imageUrl?: string; // card photo; UI falls back to the emoji if it fails to load
}

export interface DessertSpot {
  id: string; name: string; emoji: string; description: string;
  walkMinutes: number; imageUrl?: string;
}

/** A prospect in the "potential clients" mode (see src/lib/clients.ts). */
export interface ClientCompany {
  id: string; name: string; sector: string;
  source: 'provided' | 'ctech-2026';
  rank?: number;      // CTech 2026 published rank, when source is ctech-2026
  logoUrl?: string;   // UI falls back to the company initial if it fails to load
}

export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'disabled';

export interface Profile {
  id: Uuid; display_name: string; avatar_emoji: string; group_id: Uuid | null;
  // Account-management fields (absent in demo mode / legacy rows)
  username?: string; full_name?: string; email?: string; team?: string;
  role?: UserRole; account_status?: AccountStatus;
  must_change_password?: boolean; profile_completed?: boolean;
  dietary_restrictions?: DietaryTag[]; allergies?: string;
  avatar_url?: string | null; created_at?: string; updated_at?: string;
}

export interface Group { id: Uuid; name: string; invite_code: string; created_by: Uuid; created_at: string; }

export interface DailyLunchSession {
  id: Uuid; group_id: Uuid; session_date: string; status: SessionStatus;
  meeting_point: string; winner_recommendation_id: Uuid | null;
  difficult_coworker_id: Uuid | null; difficult_coworker_reason: string | null;
  closed_at: string | null;
}

export interface LunchPreference {
  id: Uuid; session_id: Uuid; user_id: Uuid; attendance: Attendance;
  available_from: HHMM; available_to: HHMM; max_budget: number;
  categories: FoodCategory[]; dietary: DietaryTag[]; allergies: string;
  transport: TransportMode;
  max_walking_minutes: number; comment: string; updated_at: string;
}

export interface ScoreLine { rule: string; points: number; label: string; }

export interface Recommendation {
  id: Uuid; session_id: Uuid; restaurant_id: string; restaurant_name: string;
  rank: number; score: number; score_breakdown: ScoreLine[];
  ai_why: string | null; ai_slogan: string | null; ai_source: 'ai'|'fallback'|null;
}

export interface Vote { session_id: Uuid; user_id: Uuid; recommendation_id: Uuid; }

export interface GroupScoringInput {
  attendeeCount: number; yesCount: number; maybeCount: number; noCount: number;
  requiredDietary: DietaryTag[]; sharedCategories: FoodCategory[];
  budgetCap: number; groupTransport: TransportMode; maxWalkMinutes: number;
  commonWindow: { from: HHMM; to: HHMM } | null;
}
