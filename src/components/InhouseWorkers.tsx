import { useState } from "react";
import { View, Platform, Pressable } from "react-native";
import { useApp } from "../lib/context";
import { Professional } from "../lib/model";
import { workerFormPayload, WorkerForm } from "../lib/office-ui";
import { Card, T, Input, Button, Badge, Row, c } from "./ui";
import { Choice } from "./Experience";
import { usePagedRecords, PageControls } from "./PagedRecords";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function InhouseWorkers() {
  const { state, request, busy } = useApp();
  const list = usePagedRecords<Professional>("professionals");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const empty = (): WorkerForm => ({
    name: "",
    phone: "",
    skills: [],
    pins: state?.settings.pins.join(", ") || "",
    active: true,
    available: true,
    days: [1, 2, 3, 4, 5, 6],
    hours: [9, 12, 15, 18],
    blockedDates: "",
  });
  const [form, setForm] = useState<WorkerForm>(empty);
  const ownerWeb = state?.user.role === "owner" && Platform.OS === "web";
  const workers = list.rows.filter((p) => p.accountless === true);
  const set = <K extends keyof WorkerForm>(key: K, value: WorkerForm[K]) => {
    setForm((old) => ({ ...old, [key]: value }));
    setError("");
  };
  return (
    <>
      <Card style={{ backgroundColor: c.mint }}>
        <T bold size={22}>
          Internal workers
        </T>
        <T>
          Your salaried team is assigned and dispatched by the office. Adding a
          worker creates a roster record with no email, password or app login.
        </T>
        <T color={c.muted}>
          Update availability here. The Admin / Owner website manages worker
          details, skills, coverage and schedules.
        </T>
        {ownerWeb && editing === null && (
          <Button
            label="Add internal worker"
            onPress={() => {
              setForm(empty());
              setEditing("");
              setError("");
              setMessage("");
            }}
          />
        )}
      </Card>
      {editing !== null && ownerWeb && (
        <Card>
          <T bold size={20}>
            {editing ? "Edit internal worker" : "New internal worker"}
          </T>
          <Input
            label="Worker name"
            value={form.name}
            onChangeText={(value) => set("name", value)}
            maxLength={100}
          />
          <Input
            label="Office contact number (optional)"
            value={form.phone}
            onChangeText={(value) => set("phone", value)}
            keyboardType="phone-pad"
          />
          <T size={12} color={c.muted}>
            Visible only to staff. This number cannot be used to sign in.
          </T>
          <T bold>Services this worker can fulfil</T>
          {state?.services.map((service) => (
            <Choice
              key={service.id}
              label={service.name}
              checked={form.skills.includes(service.id)}
              onPress={() =>
                set(
                  "skills",
                  form.skills.includes(service.id)
                    ? form.skills.filter((id) => id !== service.id)
                    : [...form.skills, service.id],
                )
              }
            />
          ))}
          <Input
            label="Worker service PIN codes"
            value={form.pins}
            onChangeText={(value) => set("pins", value)}
            placeholder="509216, 500001"
          />
          <T bold>Working days</T>
          <Row style={{ flexWrap: "wrap" }}>
            {days.map((day, i) => (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityLabel={"Works " + day}
                accessibilityState={{ checked: form.days.includes(i) }}
                onPress={() =>
                  set(
                    "days",
                    form.days.includes(i)
                      ? form.days.filter((v) => v !== i)
                      : [...form.days, i],
                  )
                }
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: form.days.includes(i) ? c.mint : c.soft,
                }}
              >
                <T>{day}</T>
              </Pressable>
            ))}
          </Row>
          <T bold>Available start times</T>
          <Row style={{ flexWrap: "wrap" }}>
            {[9, 12, 15, 18].map((hour) => (
              <Button
                key={hour}
                label={`${hour}:00`}
                secondary={!form.hours.includes(hour)}
                onPress={() =>
                  set(
                    "hours",
                    form.hours.includes(hour)
                      ? form.hours.filter((v) => v !== hour)
                      : [...form.hours, hour],
                  )
                }
              />
            ))}
          </Row>
          <Input
            label="Leave dates (optional, YYYY-MM-DD)"
            value={form.blockedDates}
            onChangeText={(value) => set("blockedDates", value)}
            placeholder="2026-11-10, 2026-11-11"
          />
          <Choice
            label="Worker active"
            checked={form.active !== false}
            onPress={() => set("active", form.active === false)}
          />
          <Choice
            label="Available for assignments"
            checked={form.available !== false}
            onPress={() => set("available", form.available === false)}
          />
          {!!error && (
            <T accessibilityRole="alert" color={c.red}>
              {error}
            </T>
          )}
          <Button
            label="Save internal worker"
            loading={busy}
            onPress={() => {
              let payload;
              try {
                payload = workerFormPayload(form);
              } catch (e) {
                setError((e as Error).message);
                return;
              }
              void request(
                "/inhouse-workers" + (editing ? "/" + editing : ""),
                payload,
                editing ? "PATCH" : "POST",
              )
                .then(() => {
                  setEditing(null);
                  setMessage(
                    "Internal worker saved. No login account was created.",
                  );
                })
                .catch((e) => setError(e.message));
            }}
          />
          <Button
            label="Cancel worker changes"
            secondary
            disabled={busy}
            onPress={() => {
              setEditing(null);
              setError("");
            }}
          />
        </Card>
      )}
      {!!message && (
        <T accessibilityLiveRegion="polite" color={c.green}>
          {message}
        </T>
      )}
      {editing === null && !!error && (
        <T accessibilityRole="alert" color={c.red}>
          {error}
        </T>
      )}
      <PageControls list={list} label="worker roster" />
      {workers.map((worker) => (
        <Card key={worker.id}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <T bold size={18}>
              {worker.name}
            </T>
            <Badge
              label={
                worker.active === false
                  ? "Inactive"
                  : worker.available === false
                    ? "Unavailable"
                    : "Available"
              }
              tone={
                worker.active === false || worker.available === false
                  ? "amber"
                  : "green"
              }
            />
          </Row>
          <T>
            {worker.skills
              .map(
                (id) =>
                  state?.services.find((service) => service.id === id)?.name ||
                  id,
              )
              .join(" · ")}
          </T>
          <T size={12} color={c.muted}>
            Coverage: {worker.pins?.join(", ")}
          </T>
          {!!worker.phone && <T size={12}>Office contact: {worker.phone}</T>}
          <Button
            label={
              (worker.available === false
                ? "Make available: "
                : "Mark unavailable: ") + worker.name
            }
            secondary
            disabled={busy || worker.active === false}
            onPress={() => {
              setError("");
              setMessage("");
              void request(
                "/inhouse-workers/" + worker.id + "/availability",
                { available: worker.available === false },
                "PATCH",
              )
                .then(() =>
                  setMessage("Availability updated for " + worker.name + "."),
                )
                .catch((e) => setError(e.message));
            }}
          />
          {ownerWeb && (
            <Button
              label={"Edit worker: " + worker.name}
              secondary
              disabled={busy}
              onPress={() => {
                setEditing(worker.id);
                setError("");
                setForm({
                  name: worker.name,
                  phone: worker.phone || "",
                  skills: worker.skills,
                  pins: worker.pins?.join(", ") || "",
                  active: worker.active !== false,
                  available: worker.available !== false,
                  days: worker.schedule?.days || [1, 2, 3, 4, 5, 6],
                  hours: worker.schedule?.hours || [9, 12, 15, 18],
                  blockedDates: worker.schedule?.blockedDates.join(", ") || "",
                });
              }}
            />
          )}
        </Card>
      ))}
      {!list.busy && !list.error && !workers.length && (
        <View>
          <T color={c.muted}>
            No internal workers on this page.{" "}
            {ownerWeb
              ? "Add your team to begin office dispatch."
              : "Ask your Admin / Owner to add your internal team on the website."}
          </T>
        </View>
      )}
    </>
  );
}
