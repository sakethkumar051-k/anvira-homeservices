import { Pressable, View } from "react-native";
import { useApp } from "../lib/context";
import { Icon, Row, T, c } from "./ui";

export function SectionHeading({
  title,
  detail,
  action,
  onPress,
}: {
  title: string;
  detail?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Row
      style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <T bold size={20}>
          {title}
        </T>
        {!!detail && (
          <T size={13} color={c.muted}>
            {detail}
          </T>
        )}
      </View>
      {!!action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <T size={13} bold color={c.green}>
            {action}
          </T>
        </Pressable>
      )}
    </Row>
  );
}

export function MenuRow({
  icon,
  label,
  detail,
  onPress,
  danger = false,
}: {
  icon: string;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { t } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        paddingVertical: 10,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Row>
        <View
          style={{
            backgroundColor: danger ? c.redbg : c.mint,
            width: 40,
            height: 40,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={20} color={danger ? c.red : c.green} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T bold size={14} color={danger ? c.red : c.ink}>
            {label}
          </T>
          {!!detail && (
            <T size={12} color={c.muted}>
              {detail}
            </T>
          )}
        </View>
        <Icon name="next" size={17} color={c.muted} />
      </Row>
    </Pressable>
  );
}

export function BookingSteps({ step }: { step: number }) {
  const labels = ["Your service", "Address & time", "Review & pay"];
  return (
    <Row style={{ gap: 8, alignItems: "flex-start" }}>
      {labels.map((label, index) => (
        <View key={label} style={{ flex: 1, gap: 8 }}>
          <View
            style={{
              height: 4,
              backgroundColor: index <= step ? c.green : c.line,
              borderRadius: 4,
            }}
          />
          <T
            size={11}
            bold={index === step}
            color={index <= step ? c.green : c.muted}
          >
            {label}
          </T>
        </View>
      ))}
    </Row>
  );
}
