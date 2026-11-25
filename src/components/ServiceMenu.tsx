import { createVisitEntryId } from "../lib/visit-cart";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Service } from "../lib/model";
import { servicePricing } from "../lib/service-catalog";
import { money } from "../lib/model";
import { useApp } from "../lib/context";
import { ServicePhoto } from "./ServicePhoto";
import { Card, Icon, Row, T, c, styles } from "./ui";

export function ServiceMenu({
  service,
  selectedId,
  onSelect,
  onBook,
}: {
  service: Service;
  selectedId: string;
  onSelect: (id: string) => void;
  onBook: (id: string, entryId: string) => void;
}) {
  const { t } = useApp();
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 5 }}>
        <T bold size={22} accessibilityRole="header">
          What do you need?
        </T>
        <T size={13} color={c.muted}>
          Choose the work. See the price. Book a time.
        </T>
      </View>
      {(service.packages || []).map((pack) => {
        const priced = servicePricing({
          ...service,
          packageRequired: true,
          packages: [pack],
        });
        const hasChoices = !!service.optionGroups?.length;
        const displayPrice =
          priced.minimum === null
            ? "Price to be confirmed"
            : (hasChoices ? "From " : "") + money(priced.minimum);
        const open = expanded.includes(pack.id),
          selected = selectedId === pack.id;
        const photoKey = /bathroom/.test(pack.id)
          ? "bathroom"
          : /kitchen/.test(pack.id)
            ? "kitchen"
            : /sofa/.test(pack.id)
              ? "sofa"
              : service.photoKey;
        return (
          <Card
            key={pack.id}
            style={{ borderColor: selected ? c.green : c.line, gap: 12 }}
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={t(pack.name) + ", " + t(displayPrice)}
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(pack.id)}
            >
              <Row style={{ alignItems: "flex-start" }}>
                <ServicePhoto
                  service={{ ...service, photoKey }}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <T bold size={17} style={{ flex: 1 }}>
                  {pack.name}
                </T>
                {selected && <Icon name="check" size={18} />}
              </Row>
            </Pressable>
            <T size={13} color={c.muted}>
              {pack.description}
            </T>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={23} bold color={c.green}>
                {displayPrice}
              </T>
              <Row style={{ gap: 5 }}>
                <Icon name="clock" size={15} color={c.muted} />
                <T size={12} color={c.muted}>
                  {hasChoices
                    ? "Duration depends on your choices"
                    : pack.duration + " min"}
                </T>
              </Row>
            </Row>
            <Row
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  t("See included work") + ": " + t(pack.name)
                }
                accessibilityState={{ expanded: open }}
                onPress={() =>
                  setExpanded((previous) =>
                    open
                      ? previous.filter((id) => id !== pack.id)
                      : [...previous, pack.id],
                  )
                }
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  flexShrink: 1,
                }}
              >
                <T size={12} bold color={c.green}>
                  {open ? "Hide details" : "See included work"}
                </T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Book") + " " + t(pack.name)}
                disabled={priced.minimum === null}
                accessibilityState={{ disabled: priced.minimum === null }}
                onPress={() => onBook(pack.id, createVisitEntryId())}
                style={({ pressed }) => [
                  styles.button,
                  {
                    minHeight: 48,
                    minWidth: 92,
                    paddingHorizontal: 18,
                    backgroundColor: c.green,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <T bold size={14} color={c.white}>
                  Book
                </T>
              </Pressable>
            </Row>
            {open && (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: c.line,
                  paddingTop: 14,
                  gap: 10,
                }}
              >
                <T bold size={13}>
                  Included in this booking
                </T>
                {pack.includes.map((line) => (
                  <Row key={line} style={{ gap: 8, alignItems: "flex-start" }}>
                    <Icon name="check" size={16} />
                    <T size={12} style={{ flex: 1 }}>
                      {line}
                    </T>
                  </Row>
                ))}
                {!!pack.excludes?.length && (
                  <>
                    <T bold size={13}>
                      Not included
                    </T>
                    {pack.excludes.map((line) => (
                      <T key={line} size={12} color={c.muted}>
                        {"• " + t(line)}
                      </T>
                    ))}
                  </>
                )}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}
