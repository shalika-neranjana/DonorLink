import { RequestHistoryList } from '@/components/common/HistoryLists';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';

export default function RequestHistoryScreen() {
  return (
    <DonorLinkScreen header={{ title: 'Request history' }}>
      <RequestHistoryList />
    </DonorLinkScreen>
  );
}
