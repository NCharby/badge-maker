import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ConfirmationPage } from '@/components/pages/ConfirmationPage';

interface EventConfirmationPageProps {
  params: {
    'event-name': string;
  };
}

export async function generateMetadata({ params }: EventConfirmationPageProps): Promise<Metadata> {
  const eventSlug = params['event-name'];
  
  // Fetch event data for metadata
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: event } = await supabase
    .from('events')
    .select('name, description')
    .eq('slug', eventSlug)
    .eq('is_active', true)
    .single();

  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'The requested event could not be found.',
    };
  }

  return {
    title: `${event.name} - Confirmation - Badge Maker`,
    description: `Badge creation confirmed for ${event.name}`,
  };
}

export default async function EventConfirmationPage({ params }: EventConfirmationPageProps) {
  const eventSlug = params['event-name'];
  
  // Validate event exists and is active
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', eventSlug)
    .eq('is_active', true)
    .single();

  if (error || !event) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#111111]">
      <div className="container mx-auto px-4 py-8">
        {/* Event Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-montserrat">
            BADGE-O-MATIC
          </h1>
          <div className="text-xl text-gray-300 mb-4 font-open-sans">
            {event.name} - Confirmation
          </div>
          {event.description && (
            <p className="text-gray-400 max-w-2xl mx-auto font-open-sans">
              {event.description}
            </p>
          )}
        </div>

        {/* Confirmation Content */}
        <div className="max-w-4xl mx-auto">
          <ConfirmationPage eventSlug={eventSlug} />
        </div>
      </div>
    </div>
  );
}
