// At each duration, the cheapest price dominates every more expensive state.
// Schema durations are multiples of 30, so there are at most nine live states.
export function minimumServicePrice(service) {
  if (service.bookingMode === "quote") return null;
  const bases = service.packageRequired
    ? service.packages || []
    : [service, ...(service.packages || [])];
  let states = new Map();
  for (const base of bases) {
    if (base.duration <= 240 && base.price <= 100000)
      states.set(
        base.duration,
        Math.min(states.get(base.duration) ?? Infinity, base.price),
      );
  }
  for (const group of service.optionGroups || []) {
    if (!group.required) continue;
    const next = new Map();
    for (const [duration, price] of states) {
      for (const option of group.options) {
        const totalDuration = duration + option.duration;
        const totalPrice = price + option.price;
        if (totalDuration <= 240 && totalPrice <= 100000)
          next.set(
            totalDuration,
            Math.min(next.get(totalDuration) ?? Infinity, totalPrice),
          );
      }
    }
    states = next;
  }
  return states.size ? Math.min(...states.values()) : null;
}
