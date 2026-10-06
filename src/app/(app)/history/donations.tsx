import { DonationHistoryList } from '@/components/common/HistoryLists';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';

export default function DonationHistoryScreen() {
  return (
    <DonorLinkScreen header={{ title: 'Donation history' }}>
      <DonationHistoryList />
    </DonorLinkScreen>
  );
}
