import type { Metadata } from 'next';
import EventDetailsClient from '@/components/events/EventDetailsClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Event Details #${id} | TiketHub`,
    description: 'Explore live event details, secure tickets, and view real-time availability on TiketHub.',
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  return <EventDetailsClient eventId={id} />;
}
