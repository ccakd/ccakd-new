export interface HiEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  slug: string;
  images: { url: string }[];
}

const HIEVENTS_API = import.meta.env.HIEVENTS_API_URL || 'https://events.ccakd.ca/api';

export async function getUpcomingEvents(limit = 3): Promise<HiEvent[]> {
  try {
    const res = await fetch(`${HIEVENTS_API}/events?status=upcoming&limit=${limit}`);
    if (!res.ok) throw new Error(`hi.events API returned ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
  } catch (error) {
    console.error('Failed to fetch hi.events:', error);
    return []; // Fallback: empty array, homepage shows fallback message
  }
}
