import React, { useState } from "react";
import { View, Pressable, Linking, ScrollView } from "react-native";
import { useApp } from "../lib/context";
import { dateLabel, type Booking } from "../lib/model";
import { T, c, Row, Icon, Card } from "./ui";
import { openWhatsApp } from "../lib/share";

/** Call and WhatsApp shortcuts to the ANVIRA care team. */
export function ContactShortcuts() {
  const { state, t } = useApp();
  const phone = state?.settings.supportPhone || "";
  if (!phone) return null;
  const action = (
    icon: string,
    label: string,
    detail: string,
    onPress: () => void,
    primary = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: 18,
        padding: 14,
        gap: 8,
        backgroundColor: primary ? c.forest : c.white,
        borderWidth: 1,
        borderColor: primary ? c.forest : c.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} size={22} color={primary ? c.gold : c.green} />
      <View>
        <T bold size={14} color={primary ? c.white : c.ink}>
          {label}
        </T>
        <T size={11} color={primary ? "#B7CEC4" : c.muted}>
          {detail}
        </T>
      </View>
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ alignItems: "stretch" }}>
        {action(
          "phone",
          "Call us",
          phone.replace(/^\+91/, "+91 "),
          () => void Linking.openURL("tel:" + phone).catch(() => {}),
          true,
        )}
        {action("chat", "WhatsApp", "Chat with the care team", () =>
          void openWhatsApp(
            "Hello ANVIRA, I need help with my booking.",
            phone,
          ),
        )}
      </Row>
      <T size={11} color={c.muted}>
        We acknowledge every request within 48 hours.
      </T>
    </View>
  );
}

/** Lets a customer attach one of their recent bookings to a request. */
export function BookingPicker({
  bookings,
  selected,
  onSelect,
}: {
  bookings: Booking[];
  selected?: string;
  onSelect: (id?: string) => void;
}) {
  const { lang, t } = useApp();
  const recent = [...bookings]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);
  if (!recent.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <T bold size={12} color={c.muted}>
        Is this about a booking?
      </T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {recent.map((b) => {
          const on = selected === b.id;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t("About booking") + ": " + t(b.serviceName)}
              onPress={() => onSelect(on ? undefined : b.id)}
              style={{
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: on ? c.green : c.line,
                backgroundColor: on ? c.mint : c.white,
                maxWidth: 200,
              }}
            >
              <T bold size={12} color={on ? c.green : c.ink} numberOfLines={1}>
                {b.serviceName}
              </T>
              <T size={10} color={c.muted}>
                {dateLabel(b.slot, lang)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SupportFaq() {
  const { state, t } = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const cutoff = state?.settings.cancelCutoffHours ?? 2;
  const faqs: [string, string][] = [
    [
      "How do I reschedule or cancel?",
      t(
        "Open the booking and choose Reschedule or Cancel booking. You can make changes up to",
      ) +
        " " +
        cutoff +
        " " +
        t("hours before the visit."),
    ],
    [
      "When will I get my refund?",
      "Paid bookings are refunded in full after ANVIRA review. The refund returns to your original payment method.",
    ],
    [
      "What if I am not happy with the service?",
      "Raise it from your booking or here within 7 days. We review every concern and may arrange a revisit, a refund or another fair resolution.",
    ],
    [
      "Are ANVIRA professionals verified?",
      "Yes. Professionals are ANVIRA team members or independent partners whose documents and skills we verify before they can accept visits.",
    ],
    [
      "How do I pay?",
      "Pay securely in the app through Razorpay. You see the full price before you pay and no extra fee is added at checkout.",
    ],
  ];
  return (
    <Card style={{ gap: 0, paddingVertical: 6 }}>
      {faqs.map(([q, a], i) => (
        <View
          key={q}
          style={{
            borderTopWidth: i ? 1 : 0,
            borderTopColor: c.line,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
            accessibilityLabel={t(q)}
            onPress={() => setOpen(open === i ? null : i)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 52,
              paddingVertical: 10,
            }}
          >
            <T bold size={13} style={{ flex: 1 }}>
              {q}
            </T>
            <View
              style={{ transform: [{ rotate: open === i ? "90deg" : "0deg" }] }}
            >
              <Icon name="next" size={16} color={c.muted} />
            </View>
          </Pressable>
          {open === i && (
            <T size={13} color={c.muted} style={{ paddingBottom: 14 }}>
              {a}
            </T>
          )}
        </View>
      ))}
    </Card>
  );
}
