export type CareReminder = {
  id: string;
  serviceId: string;
  serviceName: string;
  addressId: string;
  intervalDays: number;
  dueAt: number;
  status: "active" | "paused";
  pauseReason?: string;
  lastNotifiedAt?: number;
};
export type HomeAsset = {
  id: string;
  addressId: string;
  label: string;
  category: string;
  model?: string;
  installedAt?: string;
  warrantyUntil?: string;
};
export type HomeCareState = {
  favorites: string[];
  reminders: CareReminder[];
  assets: HomeAsset[];
  history: {
    limit: number;
    hasMore: boolean;
    groups: {
      id: string;
      addressId?: string;
      address: { line: string; pin: string };
      bookings: {
        id: string;
        serviceId: string;
        serviceName: string;
        slot: number;
        completedAt: number;
      }[];
    }[];
  };
};
