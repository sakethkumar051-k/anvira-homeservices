import { useState } from "react";
import { View } from "react-native";
import { useApp } from "../lib/context";
import { CatalogLibrary as Library, ServiceAddon, money } from "../lib/model";
import { Badge, Button, Card, Input, Row, T, c } from "./ui";

export const emptyLibrary: Library = {
  revision: 0,
  categories: [],
  addons: [],
};
export const addonId = () =>
  "addon-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function CatalogLibrary({
  section,
}: {
  section: "Categories" | "Add-on library";
}) {
  const { state, request, busy } = useApp();
  const library = state?.catalogLibrary || emptyLibrary;
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<ServiceAddon | null>(null);
  const [feedback, setFeedback] = useState("");
  const categories = Array.from(
    new Set([
      ...library.categories,
      ...(state?.services || []).map((s) => s.category),
    ]),
  ).sort();
  async function save(next: Library) {
    try {
      await request("/catalog-library", next, "PUT");
      setTemplate(null);
      setName("");
      setFeedback("Library saved.");
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }
  return (
    <Card>
      <T size={20} bold>
        {section}
      </T>
      {section === "Categories" ? (
        <>
          <T color={c.muted}>
            Choose these categories when editing a service. Customers see a
            category once it has a published service.
          </T>
          {categories.map((category) => (
            <Row key={category}>
              <T bold>{category}</T>
              <Badge
                label={
                  String(
                    state?.services.filter((s) => s.category === category)
                      .length || 0,
                  ) + " services"
                }
              />
            </Row>
          ))}
          <Input
            label="New category name"
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
          <Button
            label="Create category"
            loading={busy}
            disabled={name.trim().length < 2}
            onPress={() => {
              if (
                categories.some(
                  (c) => c.toLowerCase() === name.trim().toLowerCase(),
                )
              ) {
                setFeedback("This category already exists.");
                return;
              }
              void save({
                ...library,
                categories: [...library.categories, name.trim()],
              });
            }}
          />
        </>
      ) : (
        <>
          <T color={c.muted}>
            Save commonly offered extras here. In a service’s Add-ons step,
            choose a template and set its price and eligible packages. Updating
            a template applies to future assignments.
          </T>
          {library.addons.map((a) => (
            <Row key={a.id} style={{ flexWrap: "wrap" }}>
              <View style={{ flex: 1 }}>
                <T bold>{a.name}</T>
                <T size={12}>
                  {money(a.price)} · {a.duration || 0} extra min ·{" "}
                  {a.enabled === false ? "Archived" : "Available"}
                </T>
              </View>
              <Button
                secondary
                label={"Edit " + a.name}
                onPress={() => {
                  setTemplate({ ...a });
                  setFeedback("");
                }}
              />
            </Row>
          ))}
          {!template ? (
            <Button
              secondary
              label="Create add-on template"
              onPress={() => {
                setTemplate({
                  id: addonId(),
                  name: "",
                  price: 0,
                  duration: 0,
                  enabled: true,
                });
                setFeedback("");
              }}
            />
          ) : (
            <>
              <Input
                label="Template name"
                value={template.name}
                onChangeText={(name) => setTemplate({ ...template, name })}
                maxLength={100}
              />
              <Input
                label="Template price (₹)"
                value={template.price ? String(template.price) : ""}
                onChangeText={(s) =>
                  setTemplate({ ...template, price: Number(s) })
                }
                keyboardType="number-pad"
              />
              <Input
                label="Extra minutes (0–120, steps of 30)"
                value={String(template.duration || 0)}
                onChangeText={(s) =>
                  setTemplate({ ...template, duration: Number(s) })
                }
                keyboardType="number-pad"
              />
              <Button
                secondary
                label={
                  template.enabled === false
                    ? "Enable template"
                    : "Archive template"
                }
                onPress={() =>
                  setTemplate({
                    ...template,
                    enabled: template.enabled === false,
                  })
                }
              />
              <Button
                label="Save template"
                loading={busy}
                onPress={() => {
                  if (
                    template.name.trim().length < 2 ||
                    !Number.isInteger(template.price) ||
                    template.price < 1 ||
                    template.price > 100000
                  ) {
                    setFeedback(
                      "Enter a name and a whole-rupee price between ₹1 and ₹1,00,000.",
                    );
                    return;
                  }
                  void save({
                    ...library,
                    addons: [
                      ...library.addons.filter((a) => a.id !== template.id),
                      { ...template, name: template.name.trim() },
                    ],
                  });
                }}
              />
              <Button
                secondary
                label="Cancel changes"
                onPress={() => setTemplate(null)}
              />
            </>
          )}
        </>
      )}
      {!!feedback && <T accessibilityRole="alert">{feedback}</T>}
    </Card>
  );
}
