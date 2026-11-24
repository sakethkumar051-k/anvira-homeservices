import { useState } from "react";
import { Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useApp } from "../lib/context";
import type { PromotionalBanner } from "../lib/model";
import { Button, Card, Input, Row, T, c } from "./ui";
import { ServicePhoto } from "./ServicePhoto";
import { API_BASE } from "../lib/runtime";

const blank = {
  title: "",
  subtitle: "",
  serviceId: "",
  startsOn: "",
  endsOn: "",
  active: false,
  order: "0",
  photo: "",
  id: "",
  revision: 0,
  hasPhoto: false,
};
export function BannerManager() {
  const { state, request } = useApp();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = [...(state?.banners || [])].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  const service = state?.services.find((s) => s.id === form?.serviceId);
  function edit(b?: PromotionalBanner) {
    setForm(
      b
        ? { ...blank, ...b, order: String(b.order) }
        : {
            ...blank,
            order: String(Math.min(999, (rows.at(-1)?.order ?? -1) + 1)),
          },
    );
    setNotice("");
    setError("");
  }
  function change<K extends keyof typeof blank>(
    key: K,
    value: (typeof blank)[K],
  ) {
    setForm((f) => f && { ...f, [key]: value });
    setError("");
  }
  async function photo() {
    setBusy(true);
    setError("");
    try {
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
      });
      if (pick.canceled) return;
      const a = pick.assets[0];
      const side = Math.min(a.width, a.height);
      const ctx = ImageManipulator.manipulate(a.uri);
      ctx
        .crop({
          originX: Math.floor((a.width - side) / 2),
          originY: Math.floor((a.height - side) / 2),
          width: side,
          height: side,
        })
        .resize({ width: 480, height: 480 });
      const img = await ctx.renderAsync();
      for (const compress of [0.74, 0.5, 0.32, 0.2]) {
        const saved = await img.saveAsync({
          format: SaveFormat.JPEG,
          compress,
          base64: true,
        });
        if (saved.base64 && saved.base64.length <= 43688) {
          change("photo", "data:image/jpeg;base64," + saved.base64);
          return;
        }
      }
      throw Error("Choose a simpler photo that can be compressed to 32 KB.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!form || busy) return;
    setBusy(true);
    setError("");
    try {
      if (form.title.trim().length < 2 || !form.serviceId)
        throw Error("Enter a title and choose a destination service.");
      if (!/^\d{1,3}$/.test(form.order))
        throw Error("Enter a display order from 0 to 999.");
      for (const date of [form.startsOn, form.endsOn])
        if (
          date &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !Number.isFinite(Date.parse(date)) ||
            new Date(date).toISOString().slice(0, 10) !== date)
        )
          throw Error("Enter dates as YYYY-MM-DD.");
      if (form.startsOn && form.endsOn && form.startsOn > form.endsOn)
        throw Error("The end date must follow the start date.");
      const { id, revision, photo, hasPhoto: _, ...fields } = form;
      await request(
        "/banners",
        {
          ...fields,
          order: Number(fields.order),
          ...(photo ? { photo } : {}),
          ...(id ? { id, revision } : {}),
        },
        "PUT",
      );
      setForm(null);
      setNotice("Banner saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <T bold size={23}>
          Promotional banners
        </T>
        <T color={c.muted}>
          Choose which services to feature on the customer home screen. Dates
          follow Indian Standard Time.
        </T>
        {!form && <Button label="Create banner" onPress={() => edit()} />}
        {!!notice && <T color={c.green}>{notice}</T>}
      </Card>
      {form ? (
        <Card>
          <Input
            label="Banner title"
            value={form.title}
            maxLength={60}
            onChangeText={(v) => change("title", v)}
          />
          <Input
            label="Subtitle (optional)"
            value={form.subtitle}
            maxLength={110}
            onChangeText={(v) => change("subtitle", v)}
          />
          <T bold>Destination service</T>
          {(state?.services || [])
            .filter((s) => s.active || s.id === form.serviceId)
            .map((s) => (
              <Button
                key={s.id}
                label={(form.serviceId === s.id ? "✓ " : "") + s.name}
                secondary={form.serviceId !== s.id}
                onPress={() => change("serviceId", s.id)}
              />
            ))}
          <T bold>Banner image</T>
          <T size={13} color={c.muted}>
            Use the service photo or upload your own. Uploaded images are
            cropped to a square.
          </T>
          {form.photo ||
          (form.hasPhoto && rows.find((b) => b.id === form.id)?.active) ? (
            <Image
              source={{
                uri:
                  form.photo ||
                  API_BASE +
                    "/api/banners/" +
                    form.id +
                    "/photo?v=" +
                    form.revision,
              }}
              style={{ width: 104, height: 104, borderRadius: 12 }}
            />
          ) : form.hasPhoto ? (
            <T>Saved custom photo</T>
          ) : (
            service && (
              <ServicePhoto
                service={service}
                style={{ width: 104, height: 104, borderRadius: 12 }}
              />
            )
          )}
          <Button
            label="Upload banner photo"
            secondary
            disabled={busy}
            onPress={() => void photo()}
          />
          <Input
            label="Display order (lowest first)"
            keyboardType="number-pad"
            value={form.order}
            onChangeText={(v) => change("order", v)}
          />
          <Input
            label="Start date (optional)"
            placeholder="YYYY-MM-DD"
            value={form.startsOn}
            onChangeText={(v) => change("startsOn", v.trim())}
          />
          <Input
            label="End date (optional)"
            placeholder="YYYY-MM-DD"
            value={form.endsOn}
            onChangeText={(v) => change("endsOn", v.trim())}
          />
          <Button
            label={
              form.active
                ? "Active · Tap to deactivate"
                : "Inactive · Tap to activate"
            }
            secondary
            onPress={() => change("active", !form.active)}
          />
          {!!error && (
            <T accessibilityRole="alert" color={c.red}>
              {error}
            </T>
          )}
          <Button
            label="Save banner"
            loading={busy}
            onPress={() => void save()}
          />
          <Button
            label="Cancel editing"
            secondary
            disabled={busy}
            onPress={() => setForm(null)}
          />
        </Card>
      ) : (
        rows.map((b) => (
          <Card key={b.id}>
            <Row>
              <View style={{ flex: 1, gap: 4 }}>
                <T bold>{b.title}</T>
                <T size={13}>
                  {b.active ? "Active" : "Inactive"} · Order {b.order} ·{" "}
                  {state?.services.find((s) => s.id === b.serviceId)?.name ||
                    "Unavailable destination"}
                </T>
              </View>
            </Row>
            <Button
              label={"Edit " + b.title}
              secondary
              onPress={() => edit(b)}
            />
          </Card>
        ))
      )}
      {!form && !rows.length && (
        <T color={c.muted}>
          Create your first banner when you have a service to feature.
        </T>
      )}
    </>
  );
}
