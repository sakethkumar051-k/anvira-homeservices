// Small, dependency-free data display pieces shared by the admin overview,
// reports and growth pages. Bars are plain Views so labels always line up.
import React from "react";
import { View } from "react-native";
import { useApp } from "../lib/context";
import { T, c, Icon, Row } from "./ui";

export function percentChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** "+12% vs last week" pill. `inverse` treats a rise as bad (cancellations). */
export function DeltaPill({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  const { t } = useApp();
  const change = percentChange(current, previous);
  if (change === null)
    return (
      <T size={11} color={c.green} bold>
        {t("New this week")}
      </T>
    );
  const flat = change === 0;
  const good = inverse ? change < 0 : change > 0;
  const tone = flat ? c.muted : good ? c.green : c.red;
  return (
    <Row style={{ gap: 4 }}>
      {!flat && <Icon name={change > 0 ? "up" : "down"} size={14} color={tone} />}
      <T size={11} bold color={tone}>
        {(change > 0 ? "+" : "") + change + "% " + t("vs last week")}
      </T>
    </Row>
  );
}

export function StatTile({
  label,
  value,
  icon,
  children,
  wide,
  tone = "plain",
}: {
  label: string;
  value: string;
  icon: string;
  children?: React.ReactNode;
  wide?: boolean;
  tone?: "plain" | "forest";
}) {
  const forest = tone === "forest";
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: wide ? 260 : 170,
        minWidth: 150,
        backgroundColor: forest ? c.forest : c.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: forest ? c.forest : c.line,
        padding: 18,
        gap: 8,
      }}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <T size={12} color={forest ? "#B7CEC4" : c.muted} style={{ flex: 1 }}>
          {label}
        </T>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: forest ? "#205045" : c.mint,
          }}
        >
          <Icon name={icon} size={18} color={forest ? c.gold : c.green} />
        </View>
      </Row>
      <T
        bold
        size={30}
        color={forest ? c.white : c.ink}
        style={{ letterSpacing: -1 }}
      >
        {value}
      </T>
      {children}
    </View>
  );
}

/** Vertical bars with a value above and a label below each bar. */
export function BarChart({
  data,
  height = 170,
  format = (n: number) => String(n),
  highlightLast = true,
}: {
  data: { label: string; value: number; detail?: string }[];
  height?: number;
  format?: (n: number) => string;
  highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ alignItems: "flex-end", gap: 10, height: height + 24 }}>
        {data.map((d, i) => {
          const last = highlightLast && i === data.length - 1;
          const barHeight = d.value ? Math.max(6, (d.value / max) * height) : 3;
          return (
            <View
              key={d.label + i}
              style={{ flex: 1, alignItems: "center", gap: 6 }}
              accessible
              accessibilityLabel={d.label + ": " + format(d.value)}
            >
              <T size={10} bold color={d.value ? c.ink : c.muted}>
                {d.value ? format(d.value) : "–"}
              </T>
              <View
                style={{
                  width: "100%",
                  maxWidth: 56,
                  height: barHeight,
                  borderRadius: 8,
                  backgroundColor: last ? c.green : d.value ? "#9CCBB4" : c.line,
                }}
              />
            </View>
          );
        })}
      </Row>
      <Row style={{ gap: 10 }}>
        {data.map((d, i) => (
          <View key={d.label + i} style={{ flex: 1, alignItems: "center" }}>
            <T
              size={10}
              bold={highlightLast && i === data.length - 1}
              color={highlightLast && i === data.length - 1 ? c.green : c.muted}
            >
              {d.label}
            </T>
            {!!d.detail && (
              <T size={9} color={c.muted}>
                {d.detail}
              </T>
            )}
          </View>
        ))}
      </Row>
    </View>
  );
}

/** Ranked horizontal bars, e.g. top services by revenue. */
export function RankBars({
  rows,
  format = (n: number) => String(n),
}: {
  rows: { id: string; label: string; value: number; detail?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r, i) => (
        <View key={r.id} style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between", gap: 8 }}>
            <Row style={{ gap: 8, flex: 1 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: i === 0 ? c.forest : c.soft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T size={10} bold color={i === 0 ? c.gold : c.muted}>
                  {String(i + 1)}
                </T>
              </View>
              <T size={13} bold style={{ flex: 1 }} numberOfLines={1}>
                {r.label}
              </T>
            </Row>
            <T size={13} bold color={c.green}>
              {format(r.value)}
            </T>
          </Row>
          <View
            style={{ height: 8, borderRadius: 4, backgroundColor: c.soft }}
          >
            <View
              style={{
                height: 8,
                borderRadius: 4,
                width: `${Math.max(4, (r.value / max) * 100)}%`,
                backgroundColor: i === 0 ? c.green : "#9CCBB4",
              }}
            />
          </View>
          {!!r.detail && (
            <T size={11} color={c.muted}>
              {r.detail}
            </T>
          )}
        </View>
      ))}
    </View>
  );
}

/** Compact "₹1.2L" style for chart labels. */
export function shortMoney(n: number) {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "₹" + n;
}
