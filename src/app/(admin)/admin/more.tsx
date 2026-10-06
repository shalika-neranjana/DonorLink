import { useRouter } from 'expo-router';

import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkListGroup, DonorLinkListRow } from '@/components/ui/DonorLinkSection';

export default function AdminMoreScreen() {
  const router = useRouter();
  return (
    <DonorLinkScreen inTabs header={{ title: 'More', subtitle: 'Admin console', onBack: false, size: 'large' }}>
      <DonorLinkListGroup>
        <DonorLinkListRow icon="business" title="Organizations" subtitle="Hospitals, blood banks, directory" onPress={() => router.push('/admin/organizations')} />
        <DonorLinkListRow icon="cube" title="Inventory oversight" subtitle="Stock across organizations" onPress={() => router.push('/admin/inventory')} />
        <DonorLinkListRow icon="stats-chart" title="Analytics" subtitle="Requests, responses, fulfilment" onPress={() => router.push('/admin/analytics')} />
        <DonorLinkListRow icon="receipt" title="Audit log" subtitle="Who did what, and when" onPress={() => router.push('/admin/audit')} />
        <DonorLinkListRow icon="chatbubbles" title="Support tickets" onPress={() => router.push('/admin/tickets')} />
        <DonorLinkListRow icon="settings" title="Platform settings" subtitle="Matching, expiry, maintenance" onPress={() => router.push('/admin/settings')} last />
      </DonorLinkListGroup>
      <DonorLinkListGroup>
        <DonorLinkListRow icon="home" title="Back to personal app" onPress={() => router.replace('/')} last />
      </DonorLinkListGroup>
    </DonorLinkScreen>
  );
}
