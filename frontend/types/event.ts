export interface EventOrganizer {
  id: number;
  name: string;
  email: string;
}

export interface EventItem {
  id: number;
  title: string;
  category: string;
  description: string | null;
  location: string;
  event_date: string;
  ticket_price: number | string;
  total_tickets: number;
  available_tickets: number;
  status: 'active' | 'sold_out' | 'draft' | 'cancelled';
  image_url: string | null;
  organizer_id: number;
  created_at?: string | null;
  organizer?: EventOrganizer | null;
}

export interface EventsResponse {
  events: EventItem[];
}

export interface EventDetailsResponse {
  event: EventItem;
}

