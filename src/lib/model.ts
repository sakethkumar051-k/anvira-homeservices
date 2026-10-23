export type Role = "customer" | "professional" | "owner" | "care";
export type CommissionTier = { minAmount: number; commissionBps: number };
export type CommissionForm = {
  mode: "flat" | "tiers";
  flatPercent: string;
  tiers: { minAmount: string; percent: string }[];
};
export const defaultCommissionTiers: CommissionTier[] = [
  { minAmount: 0, commissionBps: 1000 },
  { minAmount: 1000, commissionBps: 1500 },
  { minAmount: 10000, commissionBps: 2000 },
  { minAmount: 20000, commissionBps: 2500 },
];
export function parseCommissionForm(form: CommissionForm) {
  const percentage = (value: string) => {
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 50)
      throw new Error(
        "Enter a percentage from 0 to 50, with up to two decimal places.",
      );
    return Math.round(Number(value) * 100);
  };
  if (form.mode === "flat")
    return {
      commissionMode: form.mode,
      commissionBps: percentage(form.flatPercent),
    };
  if (!form.tiers.length || form.tiers.length > 10)
    throw new Error("Configure between 1 and 10 commission slabs.");
  const commissionTiers = form.tiers.map((tier) => {
    if (!/^\d+$/.test(tier.minAmount) || Number(tier.minAmount) > 100000)
      throw new Error("Slab starts must be whole rupees from 0 to 100000.");
    return {
      minAmount: Number(tier.minAmount),
      commissionBps: percentage(tier.percent),
    };
  });
  if (commissionTiers[0].minAmount !== 0)
    throw new Error("The first slab must start at ₹0.");
  if (
    commissionTiers.some(
      (tier, i) => i > 0 && tier.minAmount <= commissionTiers[i - 1].minAmount,
    )
  )
    throw new Error(
      "Slab starts must be strictly increasing, with no repeated boundaries.",
    );
  return { commissionMode: form.mode, commissionTiers };
}
export type Service = {
  fulfillmentType?: "visit" | "laundry";
  id: string;
  name: string;
  sample?: boolean;
  sampleReviewed?: boolean;
  nameTe?: string;
  descriptionTe?: string;
  excludes?: string[];
  order?: number;
  category: string;
  icon: string;
  price: number;
  duration: number;
  headline: string;
  description: string;
  active: boolean;
  includes: string[];
  packages?: {
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
    includes: string[];
  }[];
  optionGroups?: {
    id: string;
    name: string;
    required: boolean;
    options: { id: string; name: string; price: number; duration: number }[];
  }[];
  bookingFields?: {
    id: string;
    label: string;
    placeholder: string;
    help: string;
    required: boolean;
  }[];
  faqs?: { question: string; answer: string }[];
  preparation?: string[];
  warranty?: string;
  checklist?: string[];
  addons: { id: string; name: string; price: number }[];
};
export type Booking = {
  commissionBps?: number;
  professionalType?: "In-house" | "Partner";
  commissionPolicy?:
    | { mode: "flat"; commissionBps: number }
    | { mode: "tiers"; tiers: CommissionTier[] };
  fulfillmentType?: "visit" | "laundry";
  laundry?: {
    stage: string;
    returnNote?: string;
    returnedAt?: number;
    revision: number;
    history: { stage: string; note: string; at: number; actor: string }[];
  };
  id: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  packageId?: string;
  packageName?: string;
  options?: Record<string, string>;
  choices?: { group: string; name: string; price: number; duration: number }[];
  scope?: string[];
  serviceChecklist?: string[];
  instructions?: string;
  details?: { id: string; label: string; value: string }[];
  warranty?: string;
  duration: number;
  price: number;
  total: number;
  slot: number;
  address: { line: string; pin: string };
  status: string;
  payment: string;
  refund?: string;
  professionalId?: string;
  createdAt: number;
  completedAt?: number;
  assignedAt?: number;
  acceptedAt?: number;
  arrivedAt?: number;
  completionNotes?: string;
  startedAt?: number;
  cancelledAt?: number;
  addons: { id: string; name: string; price: number }[];
  review?: { rating: number; text: string };
  checklist: boolean[];
  discount?: number;
  subtotal?: number;
  orderId?: string;
  lastPaymentFailure?: string;
  refundId?: string;
};
export type Professional = {
  id: string;
  name: string;
  rating: number;
  jobs: number;
  type: string;
  approved: boolean;
  available?: boolean;
  skills: string[];
  pins?: string[];
  bio?: string;
  photoUpdatedAt?: number;
  languages?: string[];
  experienceYears?: number;
  status?: string;
  reviewReason?: string;
  bankLast4?: string;
  bankHolderName?: string;
  bankRegisteredName?: string;
  bankIfsc?: string;
  bankVerification?:
    | "unverified"
    | "processing"
    | "unknown"
    | "needs_review"
    | "verified"
    | "failed";
  bankEligibleAt?: number;
  bankVerifiedAt?: number;
  documents?: {
    id: string;
    kind: string;
    contentType: string;
    size: number;
    uploadedAt: number;
  }[];
  schedule?: { days: number[]; hours: number[]; blockedDates: string[] };
};
export type Ticket = {
  id: string;
  bookingId?: string;
  category?: string;
  priority?: string;
  resolvedAt?: number;
  responseDueAt?: number;
  firstResponseAt?: number;
  awaitingResponse?: boolean;
  escalatedAt?: number;
  customerName: string;
  message: string;
  status: string;
  createdAt: number;
  messages?: { message: string; at: number; sender: string }[];
};
export type AppState = {
  user: {
    id: string;
    name: string;
    role: Role;
    primaryRole?: Role;
    email?: string;
    emailVerified?: boolean;
    signInProvider?: string;
    phone?: string;
  };
  hasMoreBookings?: boolean;
  features?: {
    payouts: boolean;
    bankVerification?: boolean;
    paymentEnvironment?: "simulated" | "test" | "live";
  };
  mode?: "demo" | "firebase";
  addresses: { id: string; label: string; line: string; pin: string }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    bookingId?: string;
    createdAt: number;
    read: boolean;
  }[];
  staff: {
    id: string;
    name: string;
    email?: string;
    role: Role;
    active: boolean;
  }[];
  wallet: { available: number; held: number; paid: number };
  ledger: {
    id: string;
    bookingId: string;
    gross: number;
    commission: number;
    amount: number;
    createdAt: number;
  }[];
  payouts: {
    id: string;
    professionalId: string;
    professionalName: string;
    amount: number;
    status: string;
    createdAt: number;
    bankLast4?: string;
    source?: "manual" | "scheduled";
    providerStatus?: string;
    utr?: string;
    scheduledFor?: number;
  }[];
  financialJobs: {
    id: string;
    type: string;
    bookingId?: string;
    payoutId?: string;
    status: string;
    errorCode?: string;
  }[];
  settings: {
    name: string;
    pins: string[];
    commissionBps: number;
    commissionMode?: "flat" | "tiers";
    commissionTiers?: CommissionTier[];
    cancelCutoffHours: number;
    assignmentDeadlineMinutes: number;
    termsVersion: string;
    termsUrl: string;
    privacyUrl: string;
    supportPhone: string;
    policyPublished: boolean;
    policyEnvironment?: "test" | "production";
  };
  promotions: {
    id: string;
    discountAmount: number;
    minAmount: number;
    maxUses: number;
    expiresAt: number;
    active: boolean;
  }[];
  services: Service[];
  bookings: Booking[];
  professionals: Professional[];
  tickets: Ticket[];
  audit: {
    id: string;
    at: string;
    actor: string;
    action: string;
    target: string;
  }[];
};
export const money = (n: number) => "₹" + n.toLocaleString("en-IN");
export const statusLabel = (s: string) =>
  ({
    payment_pending: "Payment pending",
    assigned: "Professional assigned",
    confirmed: "Confirmed",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    awaiting_assignment: "Finding your professional",
    requested: "Refund requested",
    refunded: "Refund complete",
    processing: "Processing",
    payment_expired: "Payment expired",
    failed: "Failed",
    paid: "Paid",
    review_pending: "Review pending",
    changes_required: "Changes requested",
    documents_required: "Documents required",
  })[s] || s;
export const dateLabel = (n: number, lang = "en") =>
  new Date(n).toLocaleString(lang === "te" ? "te-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
export const serviceDay = (n: number) =>
  new Date(n + 330 * 60000).toISOString().slice(0, 10);
export const serviceHour = (n: number) =>
  new Date(n + 330 * 60000).getUTCHours();
export const atHour = (date: string, hour: number) =>
  Date.parse(date + "T00:00:00Z") + (hour * 60 - 330) * 60000;
export function slots() {
  const now = new Date(Date.now() + 330 * 60000);
  return Array.from({ length: 7 }, (_, i) =>
    atHour(
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + i + 1,
        ),
      )
        .toISOString()
        .slice(0, 10),
      9,
    ),
  );
}
