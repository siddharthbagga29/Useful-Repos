import { DashboardLayout } from '@/components/DashboardLayout';
import { properties, complianceChecks, cleanScore, totalEquity } from '@/lib/data';

// Server Component: data is fetched here (swap the static import for your DB call),
// then handed to the pure presentational DashboardLayout.
export default function Page() {
  return (
    <DashboardLayout
      properties={properties}
      compliance={{ score: cleanScore, checks: complianceChecks }}
      metrics={{ totalEquity, blendedIrr: '16.8%' }}
    />
  );
}
