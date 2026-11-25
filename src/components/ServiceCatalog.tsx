import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Service, money } from "../lib/model";
import {
  CatalogSort,
  filterServices,
  serviceCategories,
  servicePricing,
} from "../lib/service-catalog";
import {
  serviceCategoryKey,
  serviceDurationText,
} from "../lib/service-presentation";
import { Button, Empty, Icon, Input, Row, T, c } from "./ui";
import { ServicePhoto } from "./ServicePhoto";

export function servicePriceText(service: Service) {
  if (service.billingPeriod === "monthly") return "Request a monthly plan";
  const price = servicePricing(service);
  const cheapest = service.packageRequired
    ? service.packages?.find((pack) => pack.price === price.minimum)
    : undefined;
  if (
    !price.quoteOnly &&
    cheapest &&
    /check-up|diagnosis|consultation/i.test(cheapest.name)
  )
    return "Check-up " + money(cheapest.price);
  return price.quoteOnly
    ? "Request a quote"
    : price.minimum === null
      ? "Price to be confirmed"
      : (price.from ? "From " : "") + money(price.minimum);
}

export function MonthlyCarCare({ services }: { services: Service[] }) {
  const { lang } = useApp();
  const car = services.find(
    (s) =>
      s.active &&
      s.billingPeriod === "monthly" &&
      serviceCategoryKey(s) === "car",
  );
  if (!car) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        lang === "te"
          ? "నెలవారీ కారు సంరక్షణను చూడండి"
          : "Explore monthly Car Care"
      }
      onPress={() =>
        router.push({ pathname: "/service/[id]", params: { id: car.id } })
      }
      style={({ pressed }) => ({
        backgroundColor: c.forest,
        borderRadius: 22,
        overflow: "hidden",
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Row style={{ gap: 0, alignItems: "stretch" }}>
        <View style={{ flex: 1, padding: 20, gap: 9 }}>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: "#285E4E",
              borderRadius: 8,
              paddingHorizontal: 9,
              paddingVertical: 5,
            }}
          >
            <T color="#DCEEDB" bold size={10}>
              Monthly subscription
            </T>
          </View>
          <T bold size={22} color={c.white}>
            {(lang === "te" && car.nameTe) || car.name}
          </T>
          <T size={12} color="#D5E5DD">
            The team confirms the monthly price and visit schedule
          </T>
          <Row style={{ marginTop: 6, gap: 6 }}>
            <T size={12} bold color={c.white}>
              Explore monthly Car Care
            </T>
            <Icon name="next" size={16} color={c.white} />
          </Row>
        </View>
        <ServicePhoto
          service={car}
          style={{ width: "29%", height: "100%", minHeight: 190 }}
        />
      </Row>
    </Pressable>
  );
}

export function CategoryGrid({
  services,
  onSelect,
}: {
  services: Service[];
  onSelect: (name: string) => void;
}) {
  const { t } = useApp();
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: "3%", rowGap: 14 }}
    >
      {serviceCategories(services).map((category) => (
        <Pressable
          key={category}
          accessibilityRole="button"
          accessibilityLabel={t("Browse") + " " + t(category)}
          onPress={() => onSelect(category)}
          style={({ pressed }) => ({
            width: "31%",
            gap: 8,
            backgroundColor: c.white,
            borderRadius: 18,
            padding: 8,
            borderWidth: 1,
            borderColor: c.line,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <View style={{ borderRadius: 14, overflow: "hidden" }}>
            <ServicePhoto
              service={services.find(
                (s) => s.active && s.category.trim() === category,
              )}
              style={{ height: 74, borderRadius: 12 }}
            />
          </View>
          <T bold size={11} style={{ textAlign: "center", paddingBottom: 4 }}>
            {category}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

export function CatalogServiceCard({
  service,
  compact = false,
}: {
  service: Service;
  compact?: boolean;
}) {
  const { lang, t } = useApp();
  const name = (lang === "te" && service.nameTe) || service.name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("View service:") + " " + t(name)}
      onPress={() => router.push(("/service/" + service.id) as never)}
      style={({ pressed }) => ({
        backgroundColor: c.white,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 18,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
        flexDirection: compact ? "column" : "row",
        ...(compact ? { width: 226 } : {}),
      })}
    >
      <ServicePhoto
        service={service}
        style={
          compact
            ? { height: 124 }
            : { width: 100, height: "100%", minHeight: 158 }
        }
      />
      <View style={{ padding: 16, gap: 7, flex: 1, minWidth: 0 }}>
        <T bold size={16}>
          {name}
        </T>
        <T size={12} color={c.muted} numberOfLines={2}>
          {(lang === "te" && service.descriptionTe) || service.description}
        </T>
        <T
          size={12}
          color={service.billingPeriod === "monthly" ? c.green : c.muted}
          bold={service.billingPeriod === "monthly"}
        >
          {service.billingPeriod === "monthly"
            ? "Monthly subscription"
            : serviceDurationText(service)}
        </T>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <T size={14} bold color={c.green} style={{ flex: 1 }}>
            {servicePriceText(service)}
          </T>
          <Icon name="next" size={17} />
        </Row>
      </View>
    </Pressable>
  );
}

export function ServiceCatalog({
  initialCategory = "",
  services: source,
}: {
  initialCategory?: string;
  services?: Service[];
}) {
  const { state, t } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(initialCategory),
    [sort, setSort] = useState<CatalogSort>("recommended");
  const services = source || state?.services || [];
  const categories = serviceCategories(services);
  const rows = filterServices(services, {
    query,
    category,
    sort,
    translate: t,
  });
  const groups = new Map<string, Service[]>();
  for (const service of rows) {
    const key =
      category && sort === "recommended"
        ? service.subcategory?.trim() || ""
        : "";
    const group = groups.get(key);
    if (group) group.push(service);
    else groups.set(key, [service]);
  }
  return (
    <>
      <Input
        label="Search all services"
        value={query}
        onChangeText={setQuery}
        maxLength={100}
        placeholder="Search services or packages"
      />
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Row style={{ gap: 8 }}>
            {["", ...categories].map((value) => {
              const selected = category.toLowerCase() === value.toLowerCase();
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(value)}
                  style={{
                    paddingHorizontal: 15,
                    minHeight: 44,
                    justifyContent: "center",
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: selected ? c.forest : c.line,
                    backgroundColor: selected ? c.forest : c.white,
                  }}
                >
                  <T bold size={12} color={selected ? c.white : c.ink}>
                    {value || "All services"}
                  </T>
                </Pressable>
              );
            })}
          </Row>
        </ScrollView>
      )}
      {rows.filter((s) => servicePricing(s).minimum !== null).length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row style={{ gap: 6 }}>
            {(
              [
                ["recommended", "Featured order"],
                ["price_low", "Price ↑"],
                ["price_high", "Price ↓"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={
                  value === "price_low"
                    ? "Price: low to high"
                    : value === "price_high"
                      ? "Price: high to low"
                      : label
                }
                accessibilityState={{ selected: sort === value }}
                onPress={() => setSort(value)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  backgroundColor: sort === value ? c.mint : "transparent",
                }}
              >
                <T size={12} bold={sort === value}>
                  {label}
                </T>
              </Pressable>
            ))}
          </Row>
        </ScrollView>
      )}
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <T bold size={17} accessibilityLiveRegion="polite">
          {t(category || "All services")} · {rows.length}
        </T>
        {(!!query || !!category || sort !== "recommended") && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setQuery("");
              setCategory("");
              setSort("recommended");
            }}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <T bold size={12} color={c.green}>
              Clear filters
            </T>
          </Pressable>
        )}
      </Row>
      {Array.from(groups, ([name, items]) => (
        <View key={name} style={{ gap: 12 }}>
          {!!name && <T bold>{name}</T>}
          {items.map((service) => (
            <CatalogServiceCard key={service.id} service={service} />
          ))}
        </View>
      ))}
      {!rows.length && (
        <Empty
          title="No matching services"
          detail="Try a different search or clear your filters."
        />
      )}
      {state?.user.role === "customer" && (
        <Button
          label="Ask for a tailored quote"
          secondary
          onPress={() => router.push("/quotes")}
        />
      )}
    </>
  );
}
