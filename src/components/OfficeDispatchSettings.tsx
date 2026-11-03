import { useState } from "react";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Card, T, Button, Input, Badge, c } from "./ui";
import { Choice } from "./Experience";

export default function OfficeDispatchSettings() {
  const { state, request, busy } = useApp();
  const [mode, setMode] = useState(state?.settings.dispatchMode || "automatic");
  const [external, setExternal] = useState(
    state?.settings.externalPartnersEnabled === true,
  );
  const [seconds, setSeconds] = useState(
    String(state?.settings.partnerOfferSeconds || 120),
  );
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const currentOffice = state?.settings.dispatchMode === "office_first";
  return (
    <Card style={{ backgroundColor: c.mint }}>
      <T bold size={22}>
        Office dispatch
      </T>
      <Badge
        label={
          currentOffice
            ? "Office dispatch active"
            : "Legacy automatic assignment active"
        }
        tone={currentOffice ? "green" : "amber"}
      />
      <T>
        Receive paid orders at the office, assign an internal worker and record
        dispatch through completion. Internal workers have no app login.
      </T>
      <T bold>Set up your office workflow</T>
      <T color={c.muted}>
        Publish your services, confirm service PIN codes below, then add your
        internal team’s skills and schedules before taking orders.
      </T>
      <Button
        label="Manage services"
        secondary
        onPress={() => router.push("/dashboard/services")}
      />
      <Button
        label="Manage internal team"
        secondary
        onPress={() => router.push("/dashboard/workers")}
      />
      <T bold>Dispatch mode</T>
      <Choice
        label="Enable office dispatch"
        checked={mode === "office_first"}
        onPress={() => {
          setMode(mode === "office_first" ? "automatic" : "office_first");
          setSaved(false);
        }}
      />
      {mode !== "office_first" && (
        <T color={c.muted}>
          Automatic assignment keeps the existing workflow, where an assigned
          professional confirms in the app. Enable office dispatch for your
          internal team.
        </T>
      )}
      <Choice
        label="External partner fallback"
        checked={external}
        onPress={() => {
          setExternal(!external);
          setSaved(false);
        }}
      />
      <T color={c.muted}>
        Off unless you enable it. In office mode, offers can reach approved
        partners only when no internal worker is available and the service
        permits external fulfilment. The first eligible partner to accept wins.
      </T>
      {external && (
        <Input
          label="Partner offer window (seconds)"
          value={seconds}
          keyboardType="number-pad"
          onChangeText={(v) => {
            setSeconds(v);
            setSaved(false);
          }}
        />
      )}
      {!!error && (
        <T accessibilityRole="alert" color={c.red}>
          {error}
        </T>
      )}
      {saved && (
        <T accessibilityLiveRegion="polite" bold>
          Dispatch settings saved
        </T>
      )}
      <Button
        label="Save dispatch settings"
        loading={busy}
        onPress={() => {
          const partnerOfferSeconds = Number(seconds);
          setError("");
          setSaved(false);
          if (
            !Number.isInteger(partnerOfferSeconds) ||
            partnerOfferSeconds < 60 ||
            partnerOfferSeconds > 300
          ) {
            setError("Choose an offer window from 60 to 300 seconds.");
            return;
          }
          void request(
            "/settings",
            {
              ...state!.settings,
              dispatchMode: mode,
              externalPartnersEnabled: external,
              partnerOfferSeconds,
            },
            "PUT",
          )
            .then(() => setSaved(true))
            .catch((e) => setError(e.message));
        }}
      />
    </Card>
  );
}
