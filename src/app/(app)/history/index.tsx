import { useState } from 'react';

import { DonationHistoryList, RequestHistoryList } from '@/components/common/HistoryLists';
import { DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';

/** Request History and Donation History are separate on purpose (Milestone 02). */
export default function HistoryScreen() {
  const [tab, setTab] = useState<'requests' | 'donations'>('requests');
  return (
    <DonorLinkScreen header={{ title: 'History' }}>
      <DonorLinkSegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'requests', label: 'Requests' },
          { value: 'donations', label: 'Donations' },
        ]}
      />
      {tab === 'requests' ? <RequestHistoryList /> : <DonationHistoryList />}
    </DonorLinkScreen>
  );
}
