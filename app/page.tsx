import { HomePage } from './components/pages/HomePage';
import OnboardingTour from './components/onboarding/OnboardingTour';

// Force dynamic rendering - skip static generation to avoid SSR issues
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <HomePage />
      <OnboardingTour />
    </>
  );
}
