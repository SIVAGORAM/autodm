import { redirect } from 'next/navigation';

// Canonical landing lives at "/". This route just forwards there.
export default function LandingRedirect() {
  redirect('/');
}
