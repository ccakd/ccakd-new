/** hi.events public API client */

export interface HiEventImage {
  id: number;
  url: string;
  type: string;
  file_name: string;
  mime_type: string;
  lqip_base64: string | null;
}

export interface HiEvent {
  id: number;
  title: string;
  description: string;
  description_preview: string;
  start_date: string;
  end_date: string | null;
  slug: string;
  status: string;
  lifecycle_status: string;
  timezone: string;
  location_details: Record<string, any> | null;
  images: HiEventImage[];
  currency: string;
}

const HIEVENTS_API = import.meta.env.HIEVENTS_API_URL || 'https://events.ccakd.ca/api';
const ORGANIZER_ID = import.meta.env.HIEVENTS_ORGANIZER_ID || '1';

export function getCoverImage(event: HiEvent): HiEventImage | null {
  return event.images?.find(img => img.type === 'EVENT_COVER') ?? event.images?.[0] ?? null;
}

export async function getUpcomingEvents(limit = 6): Promise<HiEvent[]> {
  try {
    const res = await fetch(
      `${HIEVENTS_API}/public/organizers/${ORGANIZER_ID}/events?per_page=${limit}&sort_by=start_date&sort_direction=asc&includes[]=images`
    );
    if (!res.ok) throw new Error(`hi.events API returned ${res.status}`);
    const data = await res.json();
    return (data.data ?? []).filter((e: HiEvent) =>
      e.lifecycle_status === 'UPCOMING' || e.lifecycle_status === 'ONGOING'
    );
  } catch (error) {
    console.error('Failed to fetch hi.events:', error);
    return [];
  }
}

export async function getAllEvents(): Promise<HiEvent[]> {
  try {
    const res = await fetch(
      `${HIEVENTS_API}/public/organizers/${ORGANIZER_ID}/events?per_page=50&sort_by=start_date&sort_direction=desc&includes[]=images`
    );
    if (!res.ok) throw new Error(`hi.events API returned ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
  } catch (error) {
    console.error('Failed to fetch hi.events:', error);
    return [];
  }
}
