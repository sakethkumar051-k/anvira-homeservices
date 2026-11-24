import { useEffect, useState } from "react";
import { router, useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { loadDraft, removeDraft } from "../lib/drafts";
import { money } from "../lib/model";
import { cartSelection, type VisitDraft } from "../lib/visit-cart";
import { Shell } from "./Shell";
import { Button, Card, Empty, T, c } from "./ui";

export function VisitCart() {
  const { state } = useApp();
  const focused = useIsFocused();
  const userId = state?.user.id;
  const serviceIds = JSON.stringify(
    (state?.services || [])
      .filter((s) => s.active && s.bookingMode !== "quote")
      .map((s) => s.id),
  );
  const [drafts, setDrafts] = useState<Record<string, VisitDraft> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!focused || !userId) return;
    const ids: string[] = JSON.parse(serviceIds);
    void Promise.all(
      ids.map(async (id) => {
        const draft = await loadDraft<VisitDraft>(userId, "checkout-" + id);
        return draft ? [[id, draft] as const] : [];
      }),
    )
      .then((rows) => {
        if (active) {
          setError("");
          setDrafts(Object.fromEntries(rows.flat()));
        }
      })
      .catch(() => {
        if (active) setError("Your saved cart could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [serviceIds, userId, focused, attempt]);
  async function remove(id: string) {
    if (!userId) return;
    try {
      await removeDraft(userId, "checkout-" + id);
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch {
      setError("Could not remove this visit. Try again.");
    }
  }
  return (
    <Shell title="Your cart" back>
      {error ? (
        <Card>
          <T color={c.red}>{error}</T>
          <Button label="Try again" onPress={() => setAttempt((n) => n + 1)} />
        </Card>
      ) : !drafts ? (
        <T>Loading your cart…</T>
      ) : Object.keys(drafts).length === 0 ? (
        <Empty
          title="Your cart is empty"
          detail="Choose a service and configure your visit to get started."
        />
      ) : (
        <>
          <T color={c.muted}>
            Each visit has its own appointment, price and payment. Choose a
            visit to continue.
          </T>
          {state?.services.map((service) => {
            const draft = drafts[service.id];
            if (!draft) return null;
            const cart = cartSelection(service, draft);
            return (
              <Card key={service.id}>
                <T bold size={20}>
                  {service.name}
                </T>
                <T>
                  {[
                    cart.pack?.name,
                    cart.count > 1
                      ? cart.count + " × " + service.quantityUnit
                      : "",
                    ...cart.choices.map((o) => o.name),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Standard visit"}
                </T>
                {cart.chosenAddons.map((a) => (
                  <T key={a.id}>
                    {a.name} · {money(a.price)}
                  </T>
                ))}
                <T bold>
                  {cart.complete
                    ? money(cart.subtotal) + " · " + cart.duration + " min"
                    : "Choose the required options"}
                </T>
                <Button
                  label="Review visit"
                  onPress={() =>
                    router.push(("/checkout/" + service.id) as never)
                  }
                />
                <Button
                  label="Remove from cart"
                  secondary
                  onPress={() => void remove(service.id)}
                />
              </Card>
            );
          })}
        </>
      )}
      <Button
        label="Browse services"
        secondary
        onPress={() => router.push("/services")}
      />
    </Shell>
  );
}
