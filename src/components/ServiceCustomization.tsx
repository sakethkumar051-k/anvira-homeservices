import { useState } from "react";
import { View } from "react-native";
import { Service, money } from "../lib/model";
import { T, Card, Button, Input, Row, c, Badge } from "./ui";
import { Choice } from "./Experience";
const lines = (v: string) =>
  v
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const uid = () =>
  "item-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
type Fields = Pick<
  Service,
  | "fulfillmentType"
  | "bookingFields"
  | "packages"
  | "optionGroups"
  | "faqs"
  | "preparation"
  | "warranty"
  | "checklist"
>;
export function ServiceCustomizationEditor({
  value,
  onChange,
}: {
  value: Fields;
  onChange: (key: string, v: unknown) => void;
}) {
  const [section, setSection] = useState("Packages");
  const packages = value.packages || [],
    groups = value.optionGroups || [],
    faqs = value.faqs || [];
  return (
    <View style={{ gap: 16 }}>
      <T bold>Fulfillment workflow</T>
      <Row>
        <Button
          label="Home visit"
          secondary={value.fulfillmentType === "laundry"}
          onPress={() => onChange("fulfillmentType", "visit")}
        />
        <Button
          label="Laundry pickup and delivery"
          secondary={value.fulfillmentType !== "laundry"}
          onPress={() => onChange("fulfillmentType", "laundry")}
        />
      </Row>
      <T color={c.muted}>
        Laundry requires collection, processing and delivery records before job
        completion. Set pickup/delivery terms and prices before publishing.
      </T>
      <T bold size={20}>
        Customize the experience
      </T>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          "Packages",
          "Choices",
          "Customer details",
          "Service care",
          "FAQs",
        ].map((s) => (
          <Button
            key={s}
            label={s}
            secondary={section !== s}
            onPress={() => setSection(s)}
          />
        ))}
      </Row>
      {section === "Packages" && (
        <>
          <T color={c.muted}>
            The base service remains available. Packages have their own complete
            price, duration and scope.
          </T>
          {packages.map((p, i) => {
            const update = (key: string, v: unknown) =>
              onChange(
                "packages",
                packages.map((x, j) => (j === i ? { ...x, [key]: v } : x)),
              );
            return (
              <Card key={p.id} style={{ backgroundColor: c.ivory }}>
                <Input
                  label="Package name"
                  value={p.name}
                  onChangeText={(v) => update("name", v)}
                />
                <Input
                  label="Package description"
                  value={p.description}
                  multiline
                  onChangeText={(v) => update("description", v)}
                />
                <Input
                  label="Package price (₹)"
                  value={String(p.price)}
                  keyboardType="number-pad"
                  onChangeText={(v) => update("price", Number(v))}
                />
                <Input
                  label="Package duration (30–240 minutes, steps of 30)"
                  value={String(p.duration)}
                  keyboardType="number-pad"
                  onChangeText={(v) => update("duration", Number(v))}
                />
                <Input
                  label="Package inclusions (one per line)"
                  value={p.includes.join("\n")}
                  multiline
                  onChangeText={(v) => update("includes", v.split("\n"))}
                />
                <Button
                  label="Remove package"
                  secondary
                  onPress={() =>
                    onChange(
                      "packages",
                      packages.filter((_, j) => j !== i),
                    )
                  }
                />
              </Card>
            );
          })}
          <Button
            label="Add package"
            disabled={packages.length >= 6}
            secondary
            onPress={() =>
              onChange("packages", [
                ...packages,
                {
                  id: uid(),
                  name: "",
                  description: "",
                  price: 100,
                  duration: 60,
                  includes: [],
                },
              ])
            }
          />
        </>
      )}
      {section === "Choices" && (
        <>
          <T color={c.muted}>
            Create choices such as home size, appliance type or cleaning
            intensity. Prices and extra minutes are added to the chosen package.
          </T>
          {groups.map((g, i) => {
            const update = (key: string, v: unknown) =>
              onChange(
                "optionGroups",
                groups.map((x, j) => (j === i ? { ...x, [key]: v } : x)),
              );
            return (
              <Card key={g.id} style={{ backgroundColor: c.ivory }}>
                <Input
                  label="Choice group name"
                  value={g.name}
                  onChangeText={(v) => update("name", v)}
                />
                <Choice
                  label="Customer must choose an option"
                  checked={g.required}
                  onPress={() => update("required", !g.required)}
                />
                {g.options.map((o, k) => {
                  const change = (key: string, v: unknown) =>
                    update(
                      "options",
                      g.options.map((x, j) =>
                        j === k ? { ...x, [key]: v } : x,
                      ),
                    );
                  return (
                    <View key={o.id} style={{ gap: 8 }}>
                      <Input
                        label="Choice name"
                        value={o.name}
                        onChangeText={(v) => change("name", v)}
                      />
                      <Input
                        label="Extra price (₹, zero allowed)"
                        value={String(o.price)}
                        keyboardType="number-pad"
                        onChangeText={(v) => change("price", Number(v))}
                      />
                      <Input
                        label="Extra minutes (0–120, steps of 30)"
                        value={String(o.duration)}
                        keyboardType="number-pad"
                        onChangeText={(v) => change("duration", Number(v))}
                      />
                      <Button
                        label="Remove choice"
                        secondary
                        onPress={() =>
                          update(
                            "options",
                            g.options.filter((_, j) => j !== k),
                          )
                        }
                      />
                    </View>
                  );
                })}
                <Button
                  label="Add choice"
                  disabled={g.options.length >= 8}
                  secondary
                  onPress={() =>
                    update("options", [
                      ...g.options,
                      { id: uid(), name: "", price: 0, duration: 0 },
                    ])
                  }
                />
                <Button
                  label="Remove group"
                  secondary
                  onPress={() =>
                    onChange(
                      "optionGroups",
                      groups.filter((_, j) => j !== i),
                    )
                  }
                />
              </Card>
            );
          })}
          <Button
            label="Add choice group"
            disabled={groups.length >= 6}
            secondary
            onPress={() =>
              onChange("optionGroups", [
                ...groups,
                { id: uid(), name: "", required: true, options: [] },
              ])
            }
          />
        </>
      )}
      {section === "Customer details" && (
        <>
          <T color={c.muted}>
            Ask only what is needed to deliver this service. Avoid identity
            documents, passwords or unnecessary personal information.
          </T>
          {(value.bookingFields || []).map((f, i) => {
            const change = (key: string, v: unknown) =>
              onChange(
                "bookingFields",
                (value.bookingFields || []).map((x, j) =>
                  j === i ? { ...x, [key]: v } : x,
                ),
              );
            return (
              <Card key={f.id}>
                <Input
                  label="Question label"
                  value={f.label}
                  onChangeText={(v) => change("label", v)}
                  maxLength={100}
                />
                <Input
                  label="Example answer"
                  value={f.placeholder}
                  onChangeText={(v) => change("placeholder", v)}
                  maxLength={160}
                />
                <Input
                  label="Why we ask"
                  value={f.help}
                  onChangeText={(v) => change("help", v)}
                  maxLength={300}
                />
                <Choice
                  label="Answer required before booking"
                  checked={f.required}
                  onPress={() => change("required", !f.required)}
                />
                <Button
                  label="Remove customer question"
                  secondary
                  onPress={() =>
                    onChange(
                      "bookingFields",
                      (value.bookingFields || []).filter((_, j) => i !== j),
                    )
                  }
                />
              </Card>
            );
          })}
          <Button
            label="Add customer question"
            secondary
            disabled={(value.bookingFields || []).length >= 8}
            onPress={() =>
              onChange("bookingFields", [
                ...(value.bookingFields || []),
                {
                  id: uid(),
                  label: "",
                  placeholder: "",
                  help: "",
                  required: false,
                },
              ])
            }
          />
        </>
      )}
      {section === "Service care" && (
        <>
          <Input
            label="Before we arrive (one instruction per line)"
            multiline
            value={(value.preparation || []).join("\n")}
            onChangeText={(v) => onChange("preparation", v.split("\n"))}
          />
          <Input
            label="Warranty or revisit terms"
            multiline
            placeholder="Only state guarantees your business can honour"
            value={value.warranty || ""}
            onChangeText={(v) => onChange("warranty", v)}
          />
          <Input
            label="Professional completion tasks (one per line)"
            multiline
            value={(value.checklist || []).join("\n")}
            onChangeText={(v) => onChange("checklist", v.split("\n"))}
          />
          <T size={12} color={c.muted}>
            These tasks join the standard completion checklist and must be
            checked before finishing a job.
          </T>
        </>
      )}
      {section === "FAQs" && (
        <>
          {faqs.map((f, i) => (
            <Card key={i}>
              <Input
                label="Customer question"
                value={f.question}
                onChangeText={(v) =>
                  onChange(
                    "faqs",
                    faqs.map((x, j) => (j === i ? { ...x, question: v } : x)),
                  )
                }
              />
              <Input
                label="Answer"
                value={f.answer}
                multiline
                onChangeText={(v) =>
                  onChange(
                    "faqs",
                    faqs.map((x, j) => (j === i ? { ...x, answer: v } : x)),
                  )
                }
              />
              <Button
                label="Remove FAQ"
                secondary
                onPress={() =>
                  onChange(
                    "faqs",
                    faqs.filter((_, j) => j !== i),
                  )
                }
              />
            </Card>
          ))}
          <Button
            label="Add FAQ"
            disabled={faqs.length >= 10}
            secondary
            onPress={() =>
              onChange("faqs", [...faqs, { question: "", answer: "" }])
            }
          />
        </>
      )}
    </View>
  );
}
export function cleanService<
  T extends Fields & { includes: string[]; excludes?: string[] },
>(v: T): T {
  return {
    ...v,
    includes: lines(v.includes.join("\n")),
    excludes: lines((v.excludes || []).join("\n")),
    preparation: lines((v.preparation || []).join("\n")),
    checklist: lines((v.checklist || []).join("\n")),
    packages: (v.packages || []).map((p) => ({
      ...p,
      includes: lines(p.includes.join("\n")),
    })),
  };
}
export function ServiceCare({ service: s }: { service: Fields }) {
  const [question, setQuestion] = useState(-1);
  return (
    <>
      {!!s.preparation?.length && (
        <Card>
          <T bold>Before we arrive</T>
          {s.preparation.map((x, i) => (
            <T key={i}>{"• " + x}</T>
          ))}
        </Card>
      )}
      {!!s.warranty && (
        <Card>
          <T bold>Warranty & revisit terms</T>
          <T>{s.warranty}</T>
        </Card>
      )}
      {!!s.faqs?.length && (
        <Card>
          <T bold>Common questions</T>
          {s.faqs.map((f, i) => (
            <View key={i} style={{ gap: 8 }}>
              <Button
                label={f.question}
                secondary
                onPress={() => setQuestion(question === i ? -1 : i)}
              />
              {question === i && <T>{f.answer}</T>}
            </View>
          ))}
        </Card>
      )}
    </>
  );
}
export function ServiceChoices({
  service: s,
  packageId,
  options,
  onPackage,
  onOption,
}: {
  service: Service;
  packageId: string;
  options: Record<string, string>;
  onPackage: (id: string) => void;
  onOption: (id: string, value: string) => void;
}) {
  return (
    <>
      {!!s.packages?.length && (
        <Card>
          <T bold size={19}>
            Choose your package
          </T>
          <Choice
            label={"Standard · " + money(s.price) + " · " + s.duration + " min"}
            checked={!packageId}
            onPress={() => onPackage("")}
          />
          {s.packages.map((p) => (
            <View key={p.id} style={{ gap: 8 }}>
              <Choice
                label={
                  p.name + " · " + money(p.price) + " · " + p.duration + " min"
                }
                checked={packageId === p.id}
                onPress={() => onPackage(p.id)}
              />
              <T color={c.muted}>{p.description}</T>
              {packageId === p.id &&
                p.includes.map((x, i) => <T key={i}>{"• " + x}</T>)}
            </View>
          ))}
        </Card>
      )}
      {s.optionGroups?.map((g) => (
        <Card key={g.id}>
          <T bold>{g.name}</T>
          <Badge label={g.required ? "Required" : "Optional"} />
          {!g.required && (
            <Choice
              label="No extra option"
              checked={!options[g.id]}
              onPress={() => onOption(g.id, "")}
            />
          )}
          {g.options.map((o) => (
            <Choice
              key={o.id}
              label={
                o.name +
                " · " +
                (o.price ? "+" + money(o.price) : "Included") +
                (o.duration ? " · +" + o.duration + " min" : "")
              }
              checked={options[g.id] === o.id}
              onPress={() => onOption(g.id, o.id)}
            />
          ))}
        </Card>
      ))}
    </>
  );
}
