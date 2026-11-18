import { useState } from "react";
import { Linking } from "react-native";
import { Card, T, Button, c } from "./ui";

export default function WebsiteConfiguration() {
  const [error, setError] = useState("");
  return (
    <Card style={{ backgroundColor: c.mint }}>
      <T bold>Business configuration is on the website</T>
      <T>
        Use the Admin / Owner website to manage services, prices, commissions,
        policies and staff access. Orders, dispatch and customer support are
        available here.
      </T>
      <Button
        label="Open website configuration"
        secondary
        onPress={() => {
          setError("");
          void Linking.openURL("https://anviraservices.com/staff").catch(() =>
            setError(
              "Open anviraservices.com/staff in your browser to manage your business.",
            ),
          );
        }}
      />
      {!!error && (
        <T accessibilityRole="alert" color={c.red}>
          {error}
        </T>
      )}
    </Card>
  );
}
