import type { Service } from "./model";

// Called for a user Book action, never while rendering a component. The URL
// carries this identity so reloading can resume that checkout, while another
// Book action takes precedence over an older saved selection.
export function createVisitEntryId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

export type VisitDraft = {
  addon: string[];
  packageId: string;
  options: Record<string, string>;
  details: Record<string, string>;
  instructions: string;
  line: string;
  pin: string;
  slot: number;
  key: string;
  quantity?: number;
  entrySelection?: string;
  promoCode?: string;
};

export function cartSelection(
  service: Service,
  draft: Pick<VisitDraft, "addon" | "packageId" | "options" | "quantity">,
) {
  const pack = service.packages?.find((p) => p.id === draft.packageId);
  const choices = (service.optionGroups || []).flatMap((group) =>
    group.options
      .filter((option) => option.id === draft.options[group.id])
      .map((option) => ({ ...option, group: group.name, groupId: group.id })),
  );
  const availableAddons = service.addons.filter(
    (addon) =>
      addon.enabled !== false &&
      (!addon.packageIds || addon.packageIds.includes(pack?.id || "")),
  );
  const chosenAddons = availableAddons.filter((addon) =>
    draft.addon.includes(addon.id),
  );
  const count = Math.max(
    1,
    Math.min(draft.quantity || 1, service.maxQuantity || 1),
  );
  const basePrice = pack?.price ?? service.price;
  const subtotal =
    count * (basePrice + choices.reduce((n, option) => n + option.price, 0)) +
    chosenAddons.reduce((n, addon) => n + addon.price, 0);
  const duration =
    count *
      ((pack?.duration ?? service.duration) +
        choices.reduce((n, option) => n + option.duration, 0)) +
    chosenAddons.reduce((n, addon) => n + (addon.duration || 0), 0);
  const complete =
    (!service.packageRequired || !!pack) &&
    (service.optionGroups || []).every(
      (group) =>
        !group.required ||
        choices.some((choice) => choice.groupId === group.id),
    );
  return {
    pack,
    choices,
    count,
    availableAddons,
    chosenAddons,
    basePrice,
    duration,
    subtotal,
    complete,
  };
}
