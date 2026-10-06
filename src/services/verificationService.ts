import type { OrganizationRegistrationInput, VerificationDocumentType, VerificationStatus, VerificationSubject } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { BUCKETS, TABLES } from '@/lib/appwrite/config';
import { listRows, Query } from '@/lib/appwrite/database';
import { uploadPrivateFile, type PickedFile } from '@/lib/appwrite/files';
import type { Organization, Verification } from '@/types/entities';

export interface SubmitVerificationInput {
  userId: string;
  subjectType: VerificationSubject;
  documentType: VerificationDocumentType;
  files: PickedFile[];
  note?: string;
  organization?: OrganizationRegistrationInput & { claimOrganizationId?: string };
  onUploadProgress?: (percent: number) => void;
}

export const verificationService = {
  /** Uploads private documents, then records the submission server-side. */
  async submit(input: SubmitVerificationInput) {
    const fileIds: string[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const id = await uploadPrivateFile(BUCKETS.verificationDocs, input.userId, input.files[i], (percent) => {
        input.onUploadProgress?.(Math.round(((i + percent / 100) / input.files.length) * 100));
      });
      fileIds.push(id);
    }
    return callApi<{ verification: Verification }>('verification.submit', {
      subjectType: input.subjectType,
      documentType: input.documentType,
      documentFileIds: fileIds,
      note: input.note,
      organization: input.organization,
    });
  },

  async listMine(userId: string): Promise<Verification[]> {
    const result = await listRows<Verification>(TABLES.verifications, [
      Query.equal('userId', [userId]),
      Query.orderDesc('$createdAt'),
      Query.limit(20),
    ]);
    return result.rows;
  },

  /** Admin review queue. */
  async listForReview(status: VerificationStatus | 'all' = 'pending'): Promise<Verification[]> {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(50)];
    if (status !== 'all') queries.push(Query.equal('status', [status]));
    return (await listRows<Verification>(TABLES.verifications, queries)).rows;
  },

  review(verificationId: string, decision: Extract<VerificationStatus, 'verified' | 'rejected' | 'needs_attention'>, note?: string) {
    return callApi<{ verification: Verification; organization: Organization | null }>('verification.review', {
      verificationId,
      decision,
      note,
    });
  },
};

/** The most recent verification for a subject, e.g. to show current status. */
export function latestFor(verifications: Verification[], subject: VerificationSubject): Verification | undefined {
  return verifications.find((v) => v.subjectType === subject);
}
