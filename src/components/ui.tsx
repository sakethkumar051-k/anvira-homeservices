import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from "react-native";
import Svg, { Path, SvgXml } from "react-native-svg";
import { useApp } from "../lib/context";
import { ART, PATHS } from "../lib/art";
export const c = {
  ivory: "#F7F7F2",
  white: "#FFFFFF",
  ink: "#172E29",
  muted: "#63736B",
  green: "#12634F",
  forest: "#073F32",
  mint: "#E4F1E9",
  line: "#DCE4DE",
  gold: "#D8C39D",
  amber: "#8F5B19",
  amberbg: "#FFF0D8",
  red: "#B23B37",
  redbg: "#FCEBE8",
  soft: "#EEF1EC",
};
export function T({
  children,
  size = 14,
  bold = false,
  color = c.ink,
  style,
  ...rest
}: {
  children: React.ReactNode;
  size?: number;
  bold?: boolean;
  color?: string;
  style?: TextStyle;
} & React.ComponentProps<typeof Text>) {
  const { lang, t } = useApp();
  const rendered = React.Children.map(children, (child) =>
    typeof child === "string" ? t(child) : child,
  );
  const telugu =
    lang === "te" ||
    /[\u0c00-\u0c7f]/.test(
      React.Children.toArray(rendered)
        .filter((x) => typeof x === "string")
        .join(""),
    );
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: telugu
            ? bold
              ? "TeluguSemi"
              : "Telugu"
            : bold
              ? "ManropeSemi"
              : "Manrope",
          fontSize: size,
          lineHeight: size * (telugu ? 1.6 : 1.45),
          color,
        },
        style,
      ]}
    >
      {rendered}
    </Text>
  );
}
export function Icon({
  name,
  size = 22,
  color = c.green,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={PATHS[name] || PATHS.grid}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
export function Art({ height = 164 }: { height?: number }) {
  return <SvgXml xml={ART} width="100%" height={height} />;
}
export function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { t } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: danger ? c.red : secondary ? c.mint : c.green,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? c.green : c.white} />
      ) : (
        <T bold color={secondary ? c.green : c.white}>
          {label}
        </T>
      )}
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Input({ label, ...props }: { label: string } & TextInputProps) {
  const { t, lang } = useApp();
  return (
    <View style={{ gap: 8 }}>
      <T bold size={12} color={c.muted}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={t(label)}
        placeholderTextColor={c.muted}
        {...props}
        placeholder={props.placeholder ? t(props.placeholder) : undefined}
        style={[
          styles.input,
          { fontFamily: lang === "te" ? "Telugu" : "Manrope" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Badge({
  label,
  tone = "green",
}: {
  label: string;
  tone?: "green" | "amber" | "red";
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor:
          tone === "red" ? c.redbg : tone === "amber" ? c.amberbg : c.mint,
      }}
    >
      <T
        size={10}
        bold
        color={tone === "red" ? c.red : tone === "amber" ? c.amber : c.green}
      >
        {label}
      </T>
    </View>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}
    >
      {children}
    </View>
  );
}
export function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: c.line, marginVertical: 12 }} />
  );
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <Card style={{ padding: 28, gap: 16, alignItems: "center" }}>
      <Icon name="spark" size={36} />
      <T bold size={20}>
        {title}
      </T>
      <T color={c.muted} style={{ textAlign: "center" }}>
        {detail}
      </T>
      {children}
    </Card>
  );
}
export const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  card: { backgroundColor: c.white, borderRadius: 22, padding: 20, gap: 12 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 16,
    padding: 16,
    color: c.ink,
    fontSize: 14,
    backgroundColor: c.white,
  },
  link: { minHeight: 44, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  page: { padding: 24, gap: 24 },
  title: { fontSize: 25 },
});
