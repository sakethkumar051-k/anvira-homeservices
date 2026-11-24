import { View } from "react-native";
import { useApp } from "../lib/context";
import { ServiceAddon, Service } from "../lib/model";
import { addonId } from "./CatalogLibrary";
import { Button, Card, Input, Row, T, c } from "./ui";
import { Choice } from "./Experience";

export function ServiceAddonsEditor({
  form,
  onChange,
}: {
  form: Pick<Service, "addons" | "packages" | "packageRequired">;
  onChange: (next: ServiceAddon[]) => void;
}) {
  const { state } = useApp();
  const bases = [
    ...(form.packageRequired ? [] : [{ id: "", name: "Standard service" }]),
    ...(form.packages || []),
  ];
  const templates = (state?.catalogLibrary?.addons || []).filter(
    (a) =>
      a.enabled !== false &&
      !form.addons.some(
        (current) => current.name.trim().toLowerCase() === a.name.toLowerCase(),
      ),
  );
  function change(id: string, fields: Partial<ServiceAddon>) {
    onChange(form.addons.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  }
  return (
    <View style={{ gap: 14 }}>
      <T bold>Optional add-ons</T>
      <T color={c.muted}>
        Offer extra work only where the customer can benefit. Leave work already
        included in a package off its list.
      </T>
      {form.addons.map((a) => (
        <Card key={a.id} style={{ backgroundColor: c.ivory }}>
          <Input
            label="Add-on name"
            value={a.name}
            maxLength={100}
            onChangeText={(name) => change(a.id, { name })}
          />
          <Input
            label="Add-on price (₹)"
            value={a.price ? String(a.price) : ""}
            keyboardType="number-pad"
            onChangeText={(s) => change(a.id, { price: Number(s) })}
          />
          <Input
            label="Extra time in minutes (0–120, steps of 30)"
            value={String(a.duration || 0)}
            keyboardType="number-pad"
            onChangeText={(s) => change(a.id, { duration: Number(s) })}
          />
          <Choice
            label="Offer this add-on"
            checked={a.enabled !== false}
            onPress={() => change(a.id, { enabled: a.enabled === false })}
          />
          <Choice
            label="Available with every package"
            checked={!a.packageIds}
            onPress={() =>
              change(a.id, {
                packageIds: a.packageIds ? undefined : bases.map((p) => p.id),
              })
            }
          />
          {a.packageIds &&
            bases.map((p) => (
              <Choice
                key={p.id}
                label={p.name || "Unnamed package"}
                checked={a.packageIds!.includes(p.id)}
                onPress={() => {
                  const ids = a.packageIds!;
                  change(a.id, {
                    packageIds: ids.includes(p.id)
                      ? ids.filter((id) => id !== p.id)
                      : [...ids, p.id],
                  });
                }}
              />
            ))}
          <Button
            secondary
            label="Remove add-on from this service"
            onPress={() => onChange(form.addons.filter((x) => x.id !== a.id))}
          />
        </Card>
      ))}
      {form.addons.length < 10 && (
        <>
          <Button
            secondary
            label="Add an add-on"
            onPress={() =>
              onChange([...form.addons, { id: addonId(), name: "", price: 0 }])
            }
          />
          {!!templates.length && (
            <>
              <T bold>Choose from the library</T>
              <Row style={{ flexWrap: "wrap" }}>
                {templates.map((a) => (
                  <Button
                    secondary
                    key={a.id}
                    label={a.name}
                    onPress={() =>
                      onChange([...form.addons, { ...a, id: addonId() }])
                    }
                  />
                ))}
              </Row>
            </>
          )}
        </>
      )}
    </View>
  );
}
