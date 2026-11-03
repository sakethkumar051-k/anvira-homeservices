import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Service, money } from "../lib/model";
import {
  CatalogSort,
  filterServices,
  serviceCategories,
  servicePricing,
} from "../lib/service-catalog";
import { Badge, Button, Card, Empty, Icon, Input, Row, T, c } from "./ui";
export function servicePriceText(service: Service) {
  const price = servicePricing(service);
  return price.quoteOnly
    ? "Request a quote"
    : price.minimum === null
      ? "Ask the office for a price"
      : (price.from ? "From " : "") + money(price.minimum);
}
export function CatalogServiceCard({ service: s }: { service: Service }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"View service: " + s.name}
      onPress={() => router.push(("/service/" + s.id) as never)}
    >
      <Card>
        <Row>
          <View
            style={{ backgroundColor: c.mint, padding: 14, borderRadius: 16 }}
          >
            <Icon name={s.icon} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T bold size={18}>
              {s.name}
            </T>
            <T size={12} color={c.muted}>
              {s.category}
            </T>
            <T bold color={c.green}>
              {servicePriceText(s)}
            </T>
            <T size={12} color={c.muted}>
              {s.bookingMode === "quote"
                ? "Review the office's scope and price before paying."
                : s.priceUnit ||
                  (s.packageRequired
                    ? "Choose the package that matches your requirement."
                    : "Check the included work before booking.")}
            </T>
            {s.packageRequired && s.bookingMode !== "quote" && (
              <Badge label="Package selection required" />
            )}
          </View>
          <Icon name="next" />
        </Row>
      </Card>
    </Pressable>
  );
}
export function ServiceCatalog({
  initialCategory = "",
}: {
  initialCategory?: string;
}) {
  const { state } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(initialCategory),
    [sort, setSort] = useState<CatalogSort>("recommended");
  const services = state?.services || [];
  const rows = filterServices(services, { query, category, sort });
  const clear = () => {
    setQuery("");
    setCategory("");
    setSort("recommended");
  };
  return (
    <>
      <T color={c.muted}>
        Find the right service, then choose the scope and package for your
        requirement. The office confirms tailored work before payment.
      </T>
      <Input
        label="Search all services"
        value={query}
        onChangeText={setQuery}
        maxLength={100}
        placeholder="Search a service, appliance or package"
      />
      <T bold>Choose a category</T>
      <Row style={{ flexWrap: "wrap" }}>
        {["", ...serviceCategories(services)].map((value) => (
          <Button
            key={value || "all"}
            label={value || "All categories"}
            secondary={category.toLowerCase() !== value.toLowerCase()}
            onPress={() => setCategory(value)}
          />
        ))}
      </Row>
      <T bold>Sort services</T>
      <Row style={{ flexWrap: "wrap" }}>
        {(
          [
            ["recommended", "Recommended"],
            ["price_low", "Price: low to high"],
            ["price_high", "Price: high to low"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            label={label}
            secondary={sort !== value}
            onPress={() => setSort(value)}
          />
        ))}
      </Row>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <T accessibilityLiveRegion="polite">
          {rows.length +
            (rows.length === 1 ? " service" : " services") +
            (category ? " in " + category : "")}
        </T>
        {(!!query || !!category || sort !== "recommended") && (
          <Button label="Clear service filters" secondary onPress={clear} />
        )}
      </Row>
      {rows.map((s) => (
        <CatalogServiceCard key={s.id} service={s} />
      ))}
      {!rows.length && (
        <Empty
          title="No matching services"
          detail="Try another category or clear the filters. The office can help with work outside the published catalogue."
        />
      )}
      <Button
        label="Ask for a tailored quote"
        secondary
        onPress={() => router.push("/quotes")}
      />
    </>
  );
}
