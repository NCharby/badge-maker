import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to default event landing page
  redirect('/default/landing');
}
