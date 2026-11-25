import { useState } from "react";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Card, T, Button, Input, Badge, c } from "./ui";
import { View } from "react-native";
import { Choice } from "./Experience";

export default function OfficeDispatchSettings() {
  const { state, request, busy } = useApp();
  const [mode, setMode] = useState(state?.settings.dispatchMode || "automatic");
  const [assignment, setAssignment] = useState(
    state?.settings.internalAssignmentMode || "manual",
  );
  const [pauses, setPauses] = useState(
    state?.settings.internalCoveragePauses || [],
  );
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
    <View style={{ gap: 20 }}>
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
          Assign ANVIRA first. If nobody can cover the service, area and time,
          offer it to approved outside professionals.
        </T>
        <T size={12} color={c.muted}>
          Closing the admin site does not stop dispatch or change availability.
          Existing assigned visits keep their team.
        </T>
        <Button
          label="Use recommended automatic flow"
          secondary
          onPress={() => {
            setMode("office_first");
            setAssignment("automatic");
            setExternal(true);
            setSeconds("90");
            setSaved(false);
          }}
        />
        <T bold>
          {assignment === "automatic" && mode === "office_first"
            ? "Automatic assignment selected"
            : "Manual assignment selected"}
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
        {mode === "office_first" && (
          <>
            <Choice
              label="Assign ANVIRA workers automatically"
              checked={assignment === "automatic"}
              onPress={() => {
                setAssignment(
                  assignment === "automatic" ? "manual" : "automatic",
                );
                setSaved(false);
              }}
            />
            <T color={c.muted}>
              {assignment === "automatic"
                ? "Paid bookings are assigned without waiting for the office. Outside offers go to five professionals at a time, with at most two rounds and a three-minute deadline."
                : "Paid bookings wait for the office to choose an ANVIRA worker. Outside offers can still open when no ANVIRA worker is available."}
            </T>
          </>
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
          permits external fulfilment. The first eligible partner to accept
          wins.
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
              "/dispatch/policy",
              {
                internalAssignmentMode: assignment,
                internalCoveragePauses: pauses,
                dispatchMode: mode,
                externalPartnersEnabled: external,
                partnerOfferSeconds,
              },
              "PATCH",
            )
              .then(() => setSaved(true))
              .catch((e) => setError(e.message));
          }}
        />
      </Card>
      <Card>
        <T bold size={20}>
          ANVIRA team availability by service
        </T>
        <T color={c.muted}>
          Pause only ANVIRA handling for a service and area. Customers can still
          book when eligible outside professionals are available and fallback is
          enabled. Save dispatch settings to apply.
        </T>
        {state?.services
          .filter((s) => s.active && s.billingPeriod !== "monthly")
          .map((service) => (
            <View
              key={service.id}
              style={{
                gap: 8,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <T bold>{service.name}</T>
              {state.settings.pins
                .filter(
                  (pin) =>
                    !service.coveragePins?.length ||
                    service.coveragePins.includes(pin),
                )
                .map((pin) => {
                  const paused = pauses.some(
                    (p) => p.serviceId === service.id && p.pin === pin,
                  );
                  return (
                    <Choice
                      key={pin}
                      label={
                        "Pause ANVIRA team · " + service.name + " · " + pin
                      }
                      checked={paused}
                      onPress={() => {
                        setPauses((current) =>
                          paused
                            ? current.filter(
                                (p) =>
                                  !(
                                    p.serviceId === service.id && p.pin === pin
                                  ),
                              )
                            : [...current, { serviceId: service.id, pin }],
                        );
                        setSaved(false);
                      }}
                    />
                  );
                })}
            </View>
          ))}
        <Button
          label="Save team availability rules"
          loading={busy}
          onPress={() => {
            setError("");
            setSaved(false);
            void request(
              "/dispatch/policy",
              { internalCoveragePauses: pauses },
              "PATCH",
            )
              .then(() => setSaved(true))
              .catch((e) => setError(e.message));
          }}
        />
        {!!error && <T color={c.red}>{error}</T>}
        {saved && <T color={c.green}>Team availability rules saved</T>}
      </Card>
    </View>
  );
}
