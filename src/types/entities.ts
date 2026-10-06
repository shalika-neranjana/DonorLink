import type {
  Availability,
  BloodGroup,
  BloodComponent,
  DonationStatus,
  MatchQuality,
  NotificationCategory,
  NotificationType,
  OrganizationMemberRole,
  OrganizationType,
  RequestStatus,
  ResponseStatus,
  SupportCategory,
  SupportStatus,
  Urgency,
  VerificationDocumentType,
  VerificationStatus,
  VerificationSubject,
} from '@/domain';

/** System fields Appwrite adds to every row. */
export interface RowBase {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
}

export interface Profile extends RowBase {
  userId: string;
  displayName: string;
  phone?: string | null;
  bloodGroup?: BloodGroup | null;
  district?: string | null;
  city?: string | null;
  approxLat?: number | null;
  approxLng?: number | null;
  isDonor: boolean;
  locationConsent: boolean;
  onboardingComplete: boolean;
  verificationStatus: VerificationStatus;
  notificationPrefs?: string | null;
  privacyPrefs?: string | null;
  avatarFileId?: string | null;
}

export interface NotificationPrefs {
  emergencyRequests: boolean;
  requestUpdates: boolean;
  donationUpdates: boolean;
  accountAlerts: boolean;
  reminders: boolean;
}

export interface PrivacyPrefs {
  anonymousDonor: boolean;
  shareApproxLocation: boolean;
}

export interface DonorProfile extends RowBase {
  donorId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  availability: Availability;
  availabilityUpdatedAt?: string | null;
  availableUntil?: string | null;
  radiusKm: number;
  emergencyAlerts: boolean;
  lastDonationDate?: string | null;
  donationCount: number;
  district?: string | null;
  verificationStatus: VerificationStatus;
}

export interface BloodRequest extends RowBase {
  requesterId: string;
  requesterName: string;
  bloodGroup: BloodGroup;
  units: number;
  unitsAccepted: number;
  unitsCompleted: number;
  contactedCount: number;
  urgency: Urgency;
  status: RequestStatus;
  verificationStatus: VerificationStatus;
  hospitalId?: string | null;
  hospitalName: string;
  district: string;
  city?: string | null;
  wardUnit?: string | null;
  approxLat?: number | null;
  approxLng?: number | null;
  requiredBy?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  relationship?: string | null;
  statusHistory?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  cancelledReason?: string | null;
}

export interface RequestResponse extends RowBase {
  requestId: string;
  donorId: string;
  donorName: string;
  donorBloodGroup: BloodGroup;
  requesterId: string;
  hospitalId?: string | null;
  status: ResponseStatus;
  matchQuality?: MatchQuality | null;
  distanceKm?: number | null;
  declineReason?: string | null;
  respondedAt?: string | null;
}

export interface Donation extends RowBase {
  requestId: string;
  responseId: string;
  donorId: string;
  donorName: string;
  requesterId: string;
  hospitalId?: string | null;
  hospitalName: string;
  bloodGroup: BloodGroup;
  units: number;
  status: DonationStatus;
  scheduledFor?: string | null;
  completedAt?: string | null;
  confirmedBy?: string | null;
  coordinationNote?: string | null;
}

export interface Organization extends RowBase {
  name: string;
  type: OrganizationType;
  district: string;
  city?: string | null;
  address?: string | null;
  approxLat?: number | null;
  approxLng?: number | null;
  phone?: string | null;
  registrationNumber?: string | null;
  verificationStatus: VerificationStatus;
  claimed: boolean;
}

export interface OrganizationMember extends RowBase {
  organizationId: string;
  userId: string;
  displayName: string;
  role: OrganizationMemberRole;
  active: boolean;
}

export interface InventoryItem extends RowBase {
  organizationId: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsAvailable: number;
  unitsReserved: number;
  lowStockThreshold: number;
  updatedBy?: string | null;
}

export interface AppNotification extends RowBase {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  route: string;
  actionLabel?: string | null;
  requestId?: string | null;
  read: boolean;
  readAt?: string | null;
}

export interface Verification extends RowBase {
  subjectType: VerificationSubject;
  userId: string;
  organizationId?: string | null;
  displayName: string;
  status: VerificationStatus;
  documentType?: VerificationDocumentType | null;
  documentFileIds?: string[] | null;
  note?: string | null;
  reviewerNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  payload?: string | null;
}

export interface AuditLog extends RowBase {
  actorId: string;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: string | null;
}

export interface SupportTicket extends RowBase {
  userId: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  reply?: string | null;
  repliedBy?: string | null;
}

export interface SystemSettings extends RowBase {
  defaultRadiusKm: number;
  requestExpiryHours: number;
  maxDonorsContacted: number;
  requireVerifiedDonors: boolean;
  maintenanceMode: boolean;
}

export interface MatchedDonor {
  donorId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  exactGroup: boolean;
  distanceKm: number | null;
  availability: Availability;
  availableUntil: string | null;
  verificationStatus: VerificationStatus;
  recentlyDonated: boolean;
  donationCount: number;
  score: number;
  quality: MatchQuality;
  reasons: string[];
  responseStatus: ResponseStatus | null;
}

export interface MatchesResult {
  matches: MatchedDonor[];
  searchedRadiusKm: number;
  totalCandidates: number;
  disclaimer: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  emailVerified: boolean;
  labels: string[];
  registeredAt: string;
}

export interface AnalyticsSummary {
  generatedAt: string;
  users: number;
  requests: {
    total: number;
    active: number;
    completed: number;
    byStatus: Record<RequestStatus, number>;
    last7Days: { date: string; count: number }[];
  };
  donors: { registered: number; availableNow: number; verified: number };
  responses: { total: number; pending: number; accepted: number; declined: number; acceptanceRate: number | null };
  donations: { completed: number; open: number };
  organizations: { verified: number; total: number };
  verifications: { pending: number };
  notifications: { sent: number; read: number };
  inventory: { items: number; lowStock: number; outOfStock: number };
}
