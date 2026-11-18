import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { CareReminder, HomeAsset, HomeCareState } from "../lib/home-care-model";
import { Shell } from "./Shell";
import { Button, Card, Input, Row, T, c } from "./ui";

const dateLabel = (value: number) =>
  new Date(value + 330 * 60000).toISOString().slice(0, 10);
const newKey = () => Date.now() + "-" + Math.random().toString(36).slice(2);
const emptyAsset = {
  label: "",
  category: "",
  model: "",
  addressId: "",
  installedAt: "",
  warrantyUntil: "",
};
function reminderDate(value: string) {
  const parsed = Date.parse(value + "T09:00:00+05:30");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed) ||
    dateLabel(parsed) !== value
  )
    throw new Error("Enter a real reminder date as YYYY-MM-DD.");
  return parsed;
}
function Choices({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <T bold>{title}</T>
      {options.map((option) => (
        <Button
          key={option.id}
          secondary={selected !== option.id}
          label={(selected === option.id ? "✓ " : "") + option.label}
          onPress={() => onSelect(option.id)}
        />
      ))}
    </View>
  );
}

export default function HomeCare() {
  const { state, read, request, busy } = useApp();
  const focused = useIsFocused();
  const [loaded, setLoaded] = useState<{
    userId: string;
    value: HomeCareState;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const assetKey = useRef(newKey());
  const reminderKey = useRef(newKey());
  const [search, setSearch] = useState("");
  const [favoritePicker, setFavoritePicker] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [asset, setAsset] = useState(emptyAsset);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderId, setReminderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [interval, setInterval] = useState("30");
  const [due, setDue] = useState(() => dateLabel(Date.now() + 86400000));
  const [confirmRemove, setConfirmRemove] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<string[]>([]);
  const userId = state?.user.id;
  const customer = state?.user.role === "customer";
  const data = loaded?.userId === userId ? loaded?.value : null;
  useEffect(() => {
    if (!focused || !customer || !userId) return;
    let current = true;
    void read<HomeCareState>("/home-care")
      .then((result) => {
        if (current) {
          setLoaded({ userId, value: result });
          setError("");
        }
      })
      .catch((failure) => {
        if (current) setError((failure as Error).message);
      });
    return () => {
      current = false;
    };
  }, [focused, customer, userId, read, revision, state]);

  async function act(operation: () => Promise<unknown>, success: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setMessage("");
    setError("");
    try {
      await operation();
      setRevision((value) => value + 1);
      setMessage(success);
      setConfirmRemove("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }
  const services = state?.services.filter((service) => service.active) || [];
  const visibleServices = services
    .filter((service) =>
      service.name.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 12);
  const serviceOptions = visibleServices.map((service) => ({
    id: service.id,
    label: service.name,
  }));
  const addressOptions = (state?.addresses || []).map((location) => ({
    id: location.id,
    label: location.label + " · " + location.line,
  }));
  const addressName = (id: string) =>
    state?.addresses.find((location) => location.id === id)?.line ||
    "Saved address no longer available";
  function editAsset(value?: HomeAsset) {
    assetKey.current = newKey();
    setAssetId(value?.id || "");
    setAsset(
      value
        ? {
            label: value.label,
            category: value.category,
            model: value.model || "",
            addressId: value.addressId,
            installedAt: value.installedAt || "",
            warrantyUntil: value.warrantyUntil || "",
          }
        : { ...emptyAsset, addressId: state?.addresses[0]?.id || "" },
    );
    setAssetOpen(true);
  }
  function editReminder(value?: CareReminder) {
    reminderKey.current = newKey();
    setReminderId(value?.id || "");
    setServiceId(value?.serviceId || services[0]?.id || "");
    setAddressId(value?.addressId || state?.addresses[0]?.id || "");
    setInterval(String(value?.intervalDays || 30));
    setDue(dateLabel(value?.dueAt || Date.now() + 86400000));
    setReminderOpen(true);
  }
  const disabled = busy || working;
  const removeButton = (kind: "assets" | "reminders", id: string) =>
    confirmRemove === id ? (
      <Row>
        <Button
          label="Confirm removal"
          danger
          disabled={disabled}
          onPress={() =>
            void act(
              () => request(`/home-care/${kind}/${id}`, undefined, "DELETE"),
              "Home-care record removed.",
            )
          }
        />
        <Button
          label="Keep record"
          secondary
          onPress={() => setConfirmRemove("")}
        />
      </Row>
    ) : (
      <Button
        label="Remove"
        secondary
        disabled={disabled}
        onPress={() => setConfirmRemove(id)}
      />
    );

  return (
    <Shell title="Home care passport" back>
      {!customer ? (
        <Card>
          <T bold>Customer access required</T>
          <T>Open your customer workspace to manage your home care.</T>
        </Card>
      ) : (
        <>
          <Card style={{ backgroundColor: c.mint }}>
            <T bold size={24}>
              A little history. Better care.
            </T>
            <T>
              Keep your home essentials, care dates and completed services
              together.
            </T>
            <T size={12} color={c.muted}>
              Your private records are entered by you. Dates do not verify
              installation or create an ANVIRA warranty. Reminders do not book
              services or charge you.
            </T>
          </Card>
          {!!error && (
            <Card>
              <T color={c.red} accessibilityRole="alert">
                {error}
              </T>
              <Button
                label="Retry home-care loading"
                secondary
                onPress={() => setRevision((value) => value + 1)}
              />
            </Card>
          )}
          {!!message && (
            <T accessibilityLiveRegion="polite" color={c.green}>
              {message}
            </T>
          )}
          {!data && !error && <T>Loading your home care…</T>}
          <Card>
            <T bold size={20}>
              Saved services
            </T>
            {data?.favorites.length === 0 && (
              <T color={c.muted}>Save the services you come back to.</T>
            )}
            {data?.favorites.map((id) => {
              const service = services.find((item) => item.id === id);
              return (
                <View key={id} style={{ gap: 8 }}>
                  <T bold>{service?.name || "Service currently unavailable"}</T>
                  {service && (
                    <Button
                      label="View service"
                      secondary
                      onPress={() => router.push(("/service/" + id) as never)}
                    />
                  )}
                  <Button
                    label="Remove saved service"
                    secondary
                    disabled={disabled}
                    onPress={() =>
                      void act(
                        () =>
                          request(
                            "/home-care/favorites/" + id,
                            undefined,
                            "DELETE",
                          ),
                        "Service removed from saved.",
                      )
                    }
                  />
                </View>
              );
            })}
            <Button
              label={favoritePicker ? "Close service picker" : "Save a service"}
              secondary
              onPress={() => setFavoritePicker(!favoritePicker)}
            />
            {favoritePicker && (
              <>
                <Input
                  label="Find a service"
                  value={search}
                  onChangeText={setSearch}
                />
                {visibleServices
                  .filter((service) => !data?.favorites.includes(service.id))
                  .map((service) => (
                    <Button
                      key={service.id}
                      label={"Save " + service.name}
                      secondary
                      disabled={disabled}
                      onPress={() =>
                        void act(
                          () =>
                            request(
                              "/home-care/favorites/" + service.id,
                              {},
                              "PUT",
                            ),
                          "Service saved.",
                        )
                      }
                    />
                  ))}
                <T size={12} color={c.muted}>
                  Showing up to 12 matching services. Search to narrow the list.
                </T>
              </>
            )}
          </Card>
          <Card>
            <T bold size={20}>
              My home assets
            </T>
            <T color={c.muted}>
              Your own record of appliances and other home essentials.
            </T>
            {!state?.addresses.length && (
              <Button
                label="Add a saved address first"
                secondary
                onPress={() => router.push("/addresses")}
              />
            )}
            {data?.assets.map((item) => (
              <Card key={item.id} style={{ backgroundColor: c.ivory }}>
                <T bold>{item.label}</T>
                <T>
                  {item.category}
                  {item.model ? " · " + item.model : ""}
                </T>
                <T size={12} color={c.muted}>
                  {addressName(item.addressId)}
                </T>
                {item.installedAt && (
                  <T size={12}>Installation date entered: {item.installedAt}</T>
                )}
                {item.warrantyUntil && (
                  <T size={12}>Warranty end entered: {item.warrantyUntil}</T>
                )}
                <Button
                  label="Edit asset"
                  secondary
                  onPress={() => editAsset(item)}
                />
                {removeButton("assets", item.id)}
              </Card>
            ))}
            {!data?.assets.length && (
              <T color={c.muted}>No home assets recorded yet.</T>
            )}
            <Button
              label="Add home asset"
              secondary
              disabled={!state?.addresses.length}
              onPress={() => editAsset()}
            />
            {assetOpen && (
              <View style={{ gap: 12 }}>
                <T bold>{assetId ? "Edit home asset" : "New home asset"}</T>
                <Input
                  label="Asset name"
                  value={asset.label}
                  onChangeText={(label) => setAsset({ ...asset, label })}
                  placeholder="Example: bedroom AC"
                />
                <Input
                  label="Category"
                  value={asset.category}
                  onChangeText={(category) => setAsset({ ...asset, category })}
                  placeholder="Example: air conditioner"
                />
                <Input
                  label="Make / model (optional)"
                  value={asset.model}
                  onChangeText={(model) => setAsset({ ...asset, model })}
                />
                <Choices
                  title="Saved address"
                  options={addressOptions}
                  selected={asset.addressId}
                  onSelect={(id) => setAsset({ ...asset, addressId: id })}
                />
                <Input
                  label="Installed on (optional, YYYY-MM-DD)"
                  value={asset.installedAt}
                  onChangeText={(installedAt) =>
                    setAsset({ ...asset, installedAt })
                  }
                  autoCapitalize="none"
                />
                <Input
                  label="Warranty ends (optional, YYYY-MM-DD)"
                  value={asset.warrantyUntil}
                  onChangeText={(warrantyUntil) =>
                    setAsset({ ...asset, warrantyUntil })
                  }
                  autoCapitalize="none"
                />
                <Button
                  label="Save home asset"
                  loading={disabled}
                  onPress={() =>
                    void act(async () => {
                      const body = {
                        ...asset,
                        installedAt:
                          asset.installedAt || (assetId ? null : undefined),
                        warrantyUntil:
                          asset.warrantyUntil || (assetId ? null : undefined),
                      };
                      await request(
                        "/home-care/assets/" + (assetId || assetKey.current),
                        body,
                        assetId ? "PATCH" : "POST",
                      );
                      setAssetOpen(false);
                    }, "Home asset saved.")
                  }
                />
                <Button
                  label="Cancel asset editing"
                  secondary
                  onPress={() => setAssetOpen(false)}
                />
              </View>
            )}
          </Card>
          <Card>
            <T bold size={20}>
              Care reminders
            </T>
            <T color={c.muted}>
              Choose your own 7–365 day interval. Each visit needs a separate
              booking, available slot and payment.
            </T>
            {data?.reminders.map((item) => (
              <Card key={item.id} style={{ backgroundColor: c.ivory }}>
                <T bold>{item.serviceName}</T>
                <T size={12}>{addressName(item.addressId)}</T>
                <T>
                  Every {item.intervalDays} days ·{" "}
                  {item.status === "paused"
                    ? "Paused"
                    : "Next: " + dateLabel(item.dueAt)}
                </T>
                {!!item.pauseReason && (
                  <T size={12} color={c.amber}>
                    {item.pauseReason}
                  </T>
                )}
                <Button
                  label="Choose a new visit"
                  secondary
                  disabled={
                    !services.some((service) => service.id === item.serviceId)
                  }
                  onPress={() =>
                    router.push(("/service/" + item.serviceId) as never)
                  }
                />
                <Button
                  label={
                    item.status === "active"
                      ? "Pause reminder"
                      : "Resume reminder"
                  }
                  secondary
                  disabled={disabled}
                  onPress={() =>
                    void act(
                      () =>
                        request(
                          "/home-care/reminders/" + item.id,
                          {
                            status:
                              item.status === "active" ? "paused" : "active",
                          },
                          "PATCH",
                        ),
                      "Reminder updated.",
                    )
                  }
                />
                <Button
                  label="Edit reminder"
                  secondary
                  onPress={() => editReminder(item)}
                />
                {removeButton("reminders", item.id)}
              </Card>
            ))}
            {!data?.reminders.length && (
              <T color={c.muted}>You decide when a little care is due.</T>
            )}
            <Button
              label="Add care reminder"
              secondary
              disabled={!state?.addresses.length || !services.length}
              onPress={() => editReminder()}
            />
            {reminderOpen && (
              <View style={{ gap: 12 }}>
                <T bold>
                  {reminderId ? "Edit care reminder" : "New care reminder"}
                </T>
                {!reminderId && (
                  <>
                    <Input
                      label="Find a service for your reminder"
                      value={search}
                      onChangeText={setSearch}
                    />
                    <Choices
                      title="Service (up to 12 matches)"
                      options={serviceOptions}
                      selected={serviceId}
                      onSelect={setServiceId}
                    />
                    <Choices
                      title="Saved address"
                      options={addressOptions}
                      selected={addressId}
                      onSelect={setAddressId}
                    />
                  </>
                )}
                <Input
                  label="Repeat every (7–365 days)"
                  value={interval}
                  onChangeText={setInterval}
                  keyboardType="number-pad"
                />
                <Input
                  label="Next reminder (YYYY-MM-DD, 09:00 IST)"
                  value={due}
                  onChangeText={setDue}
                  autoCapitalize="none"
                />
                <Button
                  label="Save care reminder"
                  loading={disabled}
                  onPress={() =>
                    void act(async () => {
                      const body = {
                        intervalDays: Number(interval),
                        dueAt: reminderDate(due),
                        ...(!reminderId ? { serviceId, addressId } : {}),
                      };
                      await request(
                        "/home-care/reminders/" +
                          (reminderId || reminderKey.current),
                        body,
                        reminderId ? "PATCH" : "POST",
                      );
                      setReminderOpen(false);
                    }, "Reminder saved. No booking or charge was created.")
                  }
                />
                <Button
                  label="Cancel reminder editing"
                  secondary
                  onPress={() => setReminderOpen(false)}
                />
              </View>
            )}
          </Card>
          <Card>
            <T bold size={20}>
              Care history by home
            </T>
            <T size={12} color={c.muted}>
              The latest {data?.history.limit || 200} completed bookings across
              your addresses.{" "}
              {data?.history.hasMore
                ? "More completed bookings exist. Open booking history for later pages."
                : "Open booking history for all statuses and pages."}
            </T>
            {data?.history.groups.map((group) => (
              <Card key={group.id} style={{ backgroundColor: c.ivory }}>
                <T bold>{group.address.line}</T>
                <T size={12}>{group.address.pin}</T>
                {group.bookings
                  .slice(0, expandedHistory.includes(group.id) ? undefined : 5)
                  .map((booking) => (
                    <View key={booking.id} style={{ gap: 8 }}>
                      <T>
                        {booking.serviceName} · {dateLabel(booking.completedAt)}
                      </T>
                      <Button
                        label="View completed visit"
                        secondary
                        onPress={() =>
                          router.push(("/booking/" + booking.id) as never)
                        }
                      />
                    </View>
                  ))}
                {group.bookings.length > 5 && (
                  <Button
                    label={
                      expandedHistory.includes(group.id)
                        ? "Show fewer visits"
                        : "Show more visits at this home"
                    }
                    secondary
                    onPress={() =>
                      setExpandedHistory((previous) =>
                        previous.includes(group.id)
                          ? previous.filter((id) => id !== group.id)
                          : [...previous, group.id],
                      )
                    }
                  />
                )}
              </Card>
            ))}
            {!data?.history.groups.length && (
              <T color={c.muted}>Completed visits will appear here.</T>
            )}
            <Button
              label="Open booking history"
              secondary
              onPress={() => router.push("/bookings")}
            />
          </Card>
        </>
      )}
    </Shell>
  );
}
