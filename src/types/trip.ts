export type TimeOfDay = "morning" | "afternoon" | "evening";
export type TripStatus = "planning" | "booked" | "completed";

export interface Activity {
  id: string;
  trip_day_id: string;
  time_of_day: TimeOfDay;
  title: string;
  notes: string | null;
  duration_mins: number | null;
  cost: number | null;
  sort_order: number;
  created_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string | null;
  label: string | null;
  created_at: string;
  activities: Activity[];
}

export interface Trip {
  id: string;
  user_id: string;
  destination_slug: string;
  destination_name: string | null;
  country: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  traveller_count: number | null;
  status: TripStatus;
  created_at: string;
  trip_days: TripDay[];
}
