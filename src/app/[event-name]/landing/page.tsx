import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { LandingForm } from '@/components/organisms/LandingForm';
import { ProgressSteps } from '@/components/molecules/ProgressSteps';

interface EventLandingPageProps {
  params: {
    'event-name': string;
  };
}

export async function generateMetadata({ params }: EventLandingPageProps): Promise<Metadata> {
  const eventSlug = params['event-name'];
  
  // Fetch event data for metadata
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    title: `${event.name} - Badge Maker`,
    description: event.description || `Create your badge for ${event.name}`,
  };
}

export default async function EventLandingPage({ params }: EventLandingPageProps) {
  const eventSlug = params['event-name'];
  
  // Validate event exists and is active
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
            {event.name}
          </div>
          {event.description && (
            <p className="text-gray-400 max-w-2xl mx-auto font-open-sans">
              {event.description}
            </p>
          )}
          {event.start_date && event.end_date && (
            <div className="text-sm text-gray-500 mt-2 font-open-sans">
              {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <ProgressSteps />
        </div>

        {/* Landing Form */}
        <div className="max-w-2xl mx-auto">
          <LandingForm eventSlug={eventSlug} />
        </div>
      </div>
    </div>
  );
}
