import type { SupportTicketInput } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { listRows, Query } from '@/lib/appwrite/database';
import type { SupportTicket } from '@/types/entities';

export const supportService = {
  createTicket(input: SupportTicketInput) {
    return callApi<{ ticket: SupportTicket }>('support.create', input as unknown as Record<string, unknown>);
  },

  async listMine(userId: string): Promise<SupportTicket[]> {
    const result = await listRows<SupportTicket>(TABLES.supportTickets, [
      Query.equal('userId', [userId]),
      Query.orderDesc('$createdAt'),
      Query.limit(30),
    ]);
    return result.rows;
  },
};

export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'How does DonorLink find donors?',
    answer:
      'When a request is verified, DonorLink ranks donors who are marked available, whose blood group is conventionally compatible, and who are within range. You always see why a donor was suggested.',
  },
  {
    question: 'Is DonorLink medical advice?',
    answer:
      'No. DonorLink is a coordination tool. Final blood compatibility and donation eligibility must be confirmed by qualified healthcare professionals.',
  },
  {
    question: 'Why was my request not verified?',
    answer:
      'Requests are checked by the addressed hospital or a DonorLink administrator. If a request is not verified you will see the reason and can submit a new one with corrected details.',
  },
  {
    question: 'Who can see my location?',
    answer:
      'Only an approximate position (about 1 km) is stored. Other people see a rounded distance such as "2.4 km away", never your address. You can change this in Settings > Privacy.',
  },
  {
    question: 'How do I become verified?',
    answer:
      'Open Profile > Verification, choose what you want verified and upload a document. Documents are private and only visible to you and DonorLink reviewers.',
  },
];
