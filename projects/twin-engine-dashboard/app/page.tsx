import { DashboardLayout } from '@/components/DashboardLayout';
import { properties, complianceChecks } from '@/lib/data';
import { computeMetrics } from '@/lib/metrics';

// Server Component: data enters here (swap the static import for your DB call). Every number the
// layout shows is derived from these records by computeMetrics — nothing is hard-coded.
export default function Page() {
  return <DashboardLayout properties={properties} checks={complianceChecks} metrics={computeMetrics(properties, complianceChecks)} sample />;
}
