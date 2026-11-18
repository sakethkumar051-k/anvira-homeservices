import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Service, money } from "../lib/model";
import {
  CatalogSort,
  filterServices,
  servicePricing,
} from "../lib/service-catalog";
import {
  mainServiceCategories,
  serviceCategoryKey,
  serviceDurationText,
} from "../lib/service-presentation";
import { Button, Empty, Icon, Input, Row, T, c } from "./ui";
import { ServicePhoto } from "./ServicePhoto";

export function servicePriceText(service: Service) {
  const price = servicePricing(service);
  return price.quoteOnly
    ? "Request a quote"
    : price.minimum === null
      ? "Ask the office for a price"
      : (price.from ? "From " : "") + money(price.minimum);
}

export function CatalogServiceCard({
  service: s,
  compact = false,
}: {
  service: Service;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"View service: " + s.name}
      onPress={() => router.push(("/service/" + s.id) as never)}
      style={({ pressed }) => ({
        backgroundColor: c.white,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.line,
        opacity: pressed ? 0.85 : 1,
        ...(compact ? { width: 258 } : {}),
      })}
    >
      <ServicePhoto service={s} style={{ height: compact ? 150 : 175 }} />
      <View style={{ padding: 18, gap: 9 }}>
        <T
          size={10}
          bold
          color={c.green}
          style={{ letterSpacing: 1.1, textTransform: "uppercase" }}
        >
          {s.category}
        </T>
        <T size={compact ? 17 : 20} bold numberOfLines={2}>
          {s.name}
        </T>
        <T size={12} color={c.muted} numberOfLines={2}>
          {s.description}
        </T>
        <Row style={{ gap: 5, marginTop: 3 }}>
          <Icon name="clock" size={14} color={c.muted} />
          <T size={11} color={c.muted}>
            {serviceDurationText(s)}
          </T>
        </Row>
        <View
          style={{ height: 1, backgroundColor: c.line, marginVertical: 3 }}
        />
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T bold size={16} color={c.green}>
              {servicePriceText(s)}
            </T>
            <T size={10} color={c.muted}>
              {s.bookingMode === "quote"
                ? "Scope & price confirmed first"
                : s.packageRequired
                  ? "Choose your package"
                  : "See included work"}
            </T>
          </View>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.mint,
            }}
          >
            <Icon name="next" size={18} />
          </View>
        </Row>
      </View>
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
  const services = (state?.services || []).filter(
    (service) => serviceCategoryKey(service) !== "other",
  );
  const mainCategory = mainServiceCategories.find(
    (item) =>
      item.id === category ||
      item.name.toLowerCase() === category.toLowerCase(),
  );
  const rows = filterServices(
    mainCategory
      ? services.filter(
          (service) => serviceCategoryKey(service) === mainCategory.id,
        )
      : services,
    { query, category: mainCategory ? "" : category, sort },
  );
  const categories = ["", ...mainServiceCategories.map((item) => item.name)];
  const clear = () => {
    setQuery("");
    setCategory("");
    setSort("recommended");
  };
  return (
    <>
      <View style={{ gap: 6 }}>
        <T size={25} bold>
          Good care starts here.
        </T>
        <T size={13} color={c.muted}>
          Find your service, compare the included work and choose what fits your
          home.
        </T>
      </View>
      <Input
        label="Search all services"
        value={query}
        onChangeText={setQuery}
        maxLength={100}
        placeholder="Try AC, bathroom or water purifier"
      />
      <View style={{ gap: 10 }}>
        <T bold size={12}>
          Choose a category
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row style={{ gap: 8 }}>
            {categories.map((value) => {
              const selected =
                category.toLowerCase() === value.toLowerCase() ||
                mainCategory?.name === value;
              return (
                <Pressable
                  key={value || "all"}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(value)}
                  style={{
                    paddingHorizontal: 16,
                    minHeight: 44,
                    justifyContent: "center",
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: selected ? c.forest : c.line,
                    backgroundColor: selected ? c.forest : c.white,
                  }}
                >
                  <T size={12} bold color={selected ? c.white : c.ink}>
                    {value || "All services"}
                  </T>
                </Pressable>
              );
            })}
          </Row>
        </ScrollView>
      </View>
      <View style={{ gap: 10 }}>
        <T bold size={12}>
          Sort services
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row style={{ gap: 8 }}>
            {(
              [
                ["recommended", "Recommended"],
                ["price_low", "Price: low to high"],
                ["price_high", "Price: high to low"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === value }}
                onPress={() => setSort(value)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 13,
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: sort === value ? c.mint : "transparent",
                  borderWidth: 1,
                  borderColor: sort === value ? c.green : c.line,
                }}
              >
                <T
                  size={11}
                  bold={sort === value}
                  color={sort === value ? c.green : c.muted}
                >
                  {label}
                </T>
              </Pressable>
            ))}
          </Row>
        </ScrollView>
      </View>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <T size={12} color={c.muted} accessibilityLiveRegion="polite">
          {rows.length +
            (rows.length === 1 ? " service" : " services") +
            (category
              ? " in " + (mainCategory?.name || category)
              : " for your home")}
        </T>
        {(!!query || !!category || sort !== "recommended") && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear service filters"
            onPress={clear}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <T size={12} bold color={c.green}>
              Clear filters
            </T>
          </Pressable>
        )}
      </Row>
      {rows.map((service) => (
        <CatalogServiceCard key={service.id} service={service} />
      ))}
      {!rows.length && (
        <Empty
          title="No matching services"
          detail="Try another category or clear the filters. The office can help with work outside the published catalogue."
        />
      )}
      <View
        style={{
          backgroundColor: c.mint,
          borderRadius: 20,
          padding: 20,
          gap: 12,
        }}
      >
        <Icon name="tool" size={27} />
        <T size={18} bold>
          Something a little different?
        </T>
        <T size={12} color={c.muted}>
          Share what you need. Review the office’s scope and price before
          paying.
        </T>
        <Button
          label="Ask for a tailored quote"
          secondary
          onPress={() => router.push("/quotes")}
        />
      </View>
    </>
  );
}
