import { useState } from "react";
import { View } from "react-native";
import { Button, T, c } from "./ui";

/**
 * A button for irreversible actions (refunds, payouts). The first press asks
 * for confirmation with a plain description of what will happen.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  message,
  loading,
  secondary,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  message: string;
  loading?: boolean;
  secondary?: boolean;
  onConfirm: () => Promise<unknown>;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  if (!asking)
    return (
      <Button
        label={label}
        secondary={secondary}
        loading={loading}
        onPress={() => {
          setError("");
          setAsking(true);
        }}
      />
    );
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 14,
        backgroundColor: c.redbg,
      }}
    >
      <T bold>{message}</T>
      <T size={12} color={c.muted}>
        This cannot be undone.
      </T>
      <Button
        label={confirmLabel}
        danger
        loading={loading}
        onPress={() =>
          void onConfirm()
            .then(() => setAsking(false))
            .catch((e) => setError((e as Error).message))
        }
      />
      <Button label="Go back" secondary onPress={() => setAsking(false)} />
      {!!error && (
        <T color={c.red} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}
