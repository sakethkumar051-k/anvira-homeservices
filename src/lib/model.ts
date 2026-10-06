export type Role = "customer" | "professional" | "owner" | "care";
export type Service = {
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
    cancelCutoffHours: number;
    assignmentDeadlineMinutes: number;
    termsVersion: string;
    termsUrl: string;
    privacyUrl: string;
    supportPhone: string;
    policyPublished: boolean;
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
