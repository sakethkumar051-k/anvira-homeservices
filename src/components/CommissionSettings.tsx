import React from "react";
import { View } from "react-native";
import {
  CommissionForm,
  defaultCommissionTiers,
  money,
  parseCommissionForm,
} from "../lib/model";
import { Choice } from "./Experience";
import { T, Input, Button, c } from "./ui";

export default function CommissionSettings({
  form,
  onChange,
}: {
  form: CommissionForm;
  onChange: (form: CommissionForm) => void;
}) {
  let error = "";
  try {
    parseCommissionForm(form);
  } catch (e) {
    error = e instanceof Error ? e.message : "Check the commission fields.";
  }
  const setTier = (
    index: number,
    key: "minAmount" | "percent",
    value: string,
  ) =>
    onChange({
      ...form,
      tiers: form.tiers.map((tier, i) =>
        i === index ? { ...tier, [key]: value } : tier,
      ),
    });
  return (
    <View style={{ gap: 12 }}>
      <T bold size={18}>
        Partner commission per completed booking
      </T>
      <T color={c.muted}>
        Partners, including part-time professionals, earn the booking total less
        commission after completion. In-house salaries are managed outside the
        partner wallet.
      </T>
      <Choice
        label="Flat percentage"
        checked={form.mode === "flat"}
        onPress={() => onChange({ ...form, mode: "flat" })}
      />
      <Choice
        label="Booking value slabs"
        checked={form.mode === "tiers"}
        onPress={() => onChange({ ...form, mode: "tiers" })}
      />
      {form.mode === "flat" ? (
        <Input
          label="Partner commission (%)"
          keyboardType="decimal-pad"
          value={form.flatPercent}
          onChangeText={(flatPercent) => onChange({ ...form, flatPercent })}
        />
      ) : (
        <>
          <Button
            label="Use 10%, 15%, 20%, 25% preset"
            secondary
            onPress={() =>
              onChange({
                ...form,
                tiers: defaultCommissionTiers.map((tier) => ({
                  minAmount: String(tier.minAmount),
                  percent: String(tier.commissionBps / 100),
                })),
              })
            }
          />
          <T color={c.muted}>
            Each start is inclusive. A slab ends just below the next start; the
            last has no upper limit. Starts: ₹0–₹1,00,000. Rates: 0–50%. Up to
            10 slabs.
          </T>
          {form.tiers.map((tier, i) => (
            <View
              key={i}
              style={{
                gap: 8,
                padding: 12,
                backgroundColor: c.ivory,
                borderRadius: 12,
              }}
            >
              <T bold>Slab {i + 1}</T>
              <Input
                label={`Slab ${i + 1} starts at (₹, inclusive)`}
                value={tier.minAmount}
                editable={i !== 0}
                keyboardType="number-pad"
                onChangeText={(value) => setTier(i, "minAmount", value)}
              />
              <Input
                label={`Slab ${i + 1} commission (%)`}
                value={tier.percent}
                keyboardType="decimal-pad"
                onChangeText={(value) => setTier(i, "percent", value)}
              />
              {!error && (
                <T>
                  {money(Number(tier.minAmount))}
                  {i + 1 < form.tiers.length
                    ? ` to ${money(Number(form.tiers[i + 1].minAmount) - 1)} inclusive`
                    : " and above"}
                  : {tier.percent}% of the entire booking
                </T>
              )}
              {i > 0 && (
                <Button
                  label={`Remove slab ${i + 1}`}
                  secondary
                  onPress={() =>
                    onChange({
                      ...form,
                      tiers: form.tiers.filter((_, index) => index !== i),
                    })
                  }
                />
              )}
            </View>
          ))}
          <Button
            label="Add commission slab"
            secondary
            disabled={form.tiers.length >= 10}
            onPress={() =>
              onChange({
                ...form,
                tiers: [...form.tiers, { minAmount: "", percent: "" }],
              })
            }
          />
        </>
      )}
      {error ? (
        <T color={c.red} accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <T color={c.muted}>
        Commission uses the paid booking total after discounts. Taxes, materials
        and tips are not recorded separately, so no separate deductions apply.
        One slab rate applies to the whole booking, not progressively.
        Commission is rounded to the nearest whole rupee; the partner receives
        the remaining amount.
      </T>
      <T color={c.muted}>
        Save company settings to apply this policy to new bookings. Existing
        bookings keep the policy recorded at checkout, including after
        reassignment.
      </T>
    </View>
  );
}
