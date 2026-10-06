import type { DonationStatus, RequestStatus, ResponseStatus } from './statuses';

/**
 * Allowed state transitions. The Appwrite Function enforces these on the
 * server; the client uses the same table to decide which actions to offer.
 *
 * request:  draft → submitted → pending_verification → verified → matching →
 *           donors_contacted → partially_fulfilled → fulfilled → completed
 *           (any non-terminal state may also be cancelled or expire; a request
 *           that fails verification is rejected)
 */
export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['pending_verification', 'verified', 'rejected', 'cancelled'],
  pending_verification: ['verified', 'rejected', 'cancelled', 'expired'],
  verified: ['matching', 'cancelled', 'expired'],
  matching: ['donors_contacted', 'cancelled', 'expired'],
  donors_contacted: ['partially_fulfilled', 'fulfilled', 'cancelled', 'expired'],
  // A confirmed donor withdrawing can move a request back a step.
  partially_fulfilled: ['donors_contacted', 'fulfilled', 'cancelled', 'expired'],
  fulfilled: ['partially_fulfilled', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
  rejected: [],
};

export const RESPONSE_TRANSITIONS: Record<ResponseStatus, readonly ResponseStatus[]> = {
  pending: ['accepted', 'declined', 'expired'],
  accepted: ['withdrawn', 'completed', 'expired'],
  declined: [],
  withdrawn: [],
  completed: [],
  expired: [],
};

export const DONATION_TRANSITIONS: Record<DonationStatus, readonly DonationStatus[]> = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function canTransitionResponse(from: ResponseStatus, to: ResponseStatus): boolean {
  return RESPONSE_TRANSITIONS[from].includes(to);
}

export function canTransitionDonation(from: DonationStatus, to: DonationStatus): boolean {
  return DONATION_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  readonly from: string;
  readonly to: string;

  constructor(entity: string, from: string, to: string) {
    super(`Cannot change ${entity} from "${from}" to "${to}".`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function assertRequestTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransitionRequest(from, to)) throw new InvalidTransitionError('request', from, to);
}

export function assertResponseTransition(from: ResponseStatus, to: ResponseStatus): void {
  if (!canTransitionResponse(from, to)) throw new InvalidTransitionError('response', from, to);
}

export function assertDonationTransition(from: DonationStatus, to: DonationStatus): void {
  if (!canTransitionDonation(from, to)) throw new InvalidTransitionError('donation', from, to);
}

/** True when the requester may still cancel. */
export function canCancelRequest(status: RequestStatus): boolean {
  return canTransitionRequest(status, 'cancelled');
}
