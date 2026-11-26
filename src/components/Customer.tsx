import { ConfirmAction } from "./ConfirmAction";
import { ServiceMenu } from "./ServiceMenu";
import { BookingSteps, MenuRow, SectionHeading } from "./MobileUI";
import {
  cartSelection,
  createVisitEntryId,
  type VisitDraft,
} from "../lib/visit-cart";
import { checkoutPackageChoice } from "../lib/marketplace";
import { PromotionalCarousel } from "./PromotionalCarousel";
import { SelectedServiceScope } from "./SelectedServiceScope";
import {
  ServiceCatalog,
  CatalogServiceCard,
  CategoryGrid,
  MonthlyCarCare,
  servicePriceText,
} from "./ServiceCatalog";
import {
  availableServicePins,
  filterServices,
  selectionProblem,
  servicePricing,
} from "../lib/service-catalog";
import { LaundryProgress } from "./LaundryProgress";
import { StaffBookingActions } from "./StaffBookingActions";
import { canOperateInternalBooking, dispatchSummary } from "../lib/dispatch";
import * as Linking from "expo-linking";
import { loadDraft, saveDraft, removeDraft } from "../lib/drafts";
import { ProfessionalPhoto } from "./ProfessionalPhoto";
import { ServiceChoices, ServiceCare } from "./ServiceCustomization";
import React, { useState, useEffect } from "react";
import {
  View,
  Pressable,
  ScrollView,
  TextInput,
  BackHandler,
  Platform,
} from "react-native";
import { router, useLocalSearchParams, useIsFocused } from "expo-router";
import { NotificationCenter, PaymentButton } from "./Experience";
import { Shell } from "./Shell";
import { SupportReply } from "./Workbench";
import { Conversation } from "./Conversation";
import { usePagedRecords, PageControls } from "./PagedRecords";
import {
  T,
  c,
  Card,
  Row,
  Icon,
  Button,
  Input,
  Badge,
  Divider,
  Empty,
  styles,
} from "./ui";
import { useApp } from "../lib/context";
import { ServicePhoto } from "./ServicePhoto";
import { serviceDurationText } from "../lib/service-presentation";
import { SafeAreaView } from "react-native-safe-area-context";
import { WEBSITE_STAFF_ONLY } from "../lib/runtime";
import {
  Booking,
  Service,
  Ticket,
  money,
  dateLabel,
  statusLabel,
  slots,
  serviceDay,
  serviceHour,
  atHour,
} from "../lib/model";
const go = (href: string) => router.push(href as never);
export function Home() {
  const { state, t, lang } = useApp();
  const [search, setSearch] = useState("");
  if (!state) return null;
  const services = filterServices(state.services, {});
  const matches = filterServices(services, { query: search, translate: t });
  const packages = services.filter(
    (service) =>
      service.bookingMode !== "quote" && (service.packages?.length || 0) > 1,
  );
  const nextBooking = state.bookings
    .filter((booking) =>
      [
        "payment_pending",
        "assigned",
        "confirmed",
        "awaiting_assignment",
        "in_progress",
      ].includes(booking.status),
    )
    .sort((a, b) => a.slot - b.slot)[0];
  return (
    <Shell>
      <Row
        style={{ justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <T bold size={28} style={{ letterSpacing: -0.8 }}>
            Services for your home
          </T>
          <T size={13} color={c.muted}>
            What can we help with today?
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => go("/cart")}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            justifyContent: "center",
            backgroundColor: c.mint,
            borderRadius: 14,
          }}
        >
          <Row style={{ gap: 5 }}>
            <Icon name="bag" size={18} />
            <T bold color={c.green} size={12}>
              Cart
            </T>
          </Row>
        </Pressable>
      </Row>
      <Row
        style={{
          backgroundColor: c.white,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 16,
          minHeight: 54,
          paddingHorizontal: 16,
        }}
      >
        <Icon name="search" size={21} />
        <TextInput
          accessibilityLabel={t("Search services")}
          placeholder={t("Search for a service")}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={c.muted}
          maxLength={100}
          returnKeyType="search"
          style={{
            flex: 1,
            fontFamily: lang === "te" ? "Telugu" : "Manrope",
            fontSize: 14,
            color: c.ink,
            minHeight: 54,
          }}
        />
        {!!search && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Clear search")}
            onPress={() => setSearch("")}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T size={22} color={c.muted}>
              ×
            </T>
          </Pressable>
        )}
      </Row>
      {search.trim() ? (
        <>
          <T bold size={18}>
            Search results
          </T>
          {matches.map((service) => (
            <CatalogServiceCard key={service.id} service={service} />
          ))}
          {!matches.length && (
            <Empty
              title="No services found"
              detail="Try another search or browse all services."
            />
          )}
        </>
      ) : (
        <>
          {nextBooking && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View next booking"
              onPress={() => go("/booking/" + nextBooking.id)}
              style={{
                borderRadius: 18,
                padding: 18,
                gap: 8,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.white,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <T size={11} color={c.green} bold>
                  YOUR NEXT SERVICE
                </T>
                <Icon name="next" size={17} />
              </Row>
              <T bold size={17}>
                {nextBooking.serviceName}
              </T>
              <T size={12} color={c.muted}>
                {dateLabel(nextBooking.slot, lang)}
              </T>
              <Badge label={statusLabel(nextBooking.status)} />
            </Pressable>
          )}
          <View style={{ gap: 14 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T bold size={19}>
                Service categories
              </T>
              <Pressable
                accessibilityRole="button"
                onPress={() => go("/services")}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <T bold size={13} color={c.green}>
                  View all
                </T>
              </Pressable>
            </Row>
            <CategoryGrid
              services={services}
              onSelect={(category) =>
                go("/services?category=" + encodeURIComponent(category))
              }
            />
            {!services.length && (
              <Empty
                title="No services published yet"
                detail="Contact support for help with your request."
              />
            )}
          </View>
          <MonthlyCarCare services={services} />
          <PromotionalCarousel />
          {!!services.length && (
            <View style={{ gap: 14 }}>
              <SectionHeading
                title={
                  packages.length ? "Compare packages" : "Explore services"
                }
                detail="Find the right fit for your home."
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row style={{ gap: 12, alignItems: "stretch" }}>
                  {(packages.length ? packages : services)
                    .slice(0, 6)
                    .map((service) => (
                      <CatalogServiceCard
                        key={service.id}
                        service={service}
                        compact
                      />
                    ))}
                </Row>
              </ScrollView>
            </View>
          )}
          <Card style={{ paddingVertical: 8 }}>
            <MenuRow
              icon="phone"
              label="Need help choosing?"
              detail="Talk to the ANVIRA team"
              onPress={() => go("/support")}
            />
          </Card>
          {state.mode === "demo" && (
            <Button
              label="Five-minute client demo"
              secondary
              onPress={() => go("/demo")}
            />
          )}
        </>
      )}
    </Shell>
  );
}

function newBookingKey() {
  return "booking-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
export function Services() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return (
    <Shell title="All services" back>
      <ServiceCatalog
        key={category || "all"}
        initialCategory={category || ""}
      />
    </Shell>
  );
}

type PublicServiceCatalog = {
  services: Service[];
  pins: string[];
  mode: string;
};
function ServiceDetailFrame({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { state } = useApp();
  if (state)
    return (
      <Shell title={title} back footer={footer}>
        {children}
      </Shell>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 540,
          alignSelf: "center",
          minHeight: 0,
        }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 23, paddingBottom: 36 }}
          keyboardShouldPersistTaps="handled"
        >
          <Row>
            <Pressable
              accessibilityLabel="Back to services"
              accessibilityRole="button"
              onPress={() =>
                router.canGoBack() ? router.back() : go("/catalog")
              }
              style={{ width: 44, height: 44, justifyContent: "center" }}
            >
              <Icon name="back" />
            </Pressable>
            <T bold size={19}>
              {title}
            </T>
          </Row>
          {children}
        </ScrollView>
        {!!footer && (
          <View
            style={{
              backgroundColor: c.ivory,
              borderTopWidth: 1,
              borderTopColor: c.line,
              padding: 18,
            }}
          >
            {footer}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, read } = useApp();
  const [catalog, setCatalog] = useState<PublicServiceCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectedPackages, setSelectedPackages] = useState<
    Record<string, string>
  >({});
  const selectedPackage = selectedPackages[id] || "";
  const [addonChoices, setAddonChoices] = useState<Record<string, string[]>>(
    {},
  );
  const { lang, t } = useApp();
  useEffect(() => {
    let current = true;
    if (state) return;
    void read<PublicServiceCatalog>("/catalog")
      .then((data) => {
        if (current) {
          setCatalog(data);
          setCatalogError("");
        }
      })
      .catch((error) => {
        if (current)
          setCatalogError(error.message || "Services could not be loaded.");
      });
    return () => {
      current = false;
    };
  }, [read, state, retry]);
  const service = (state?.services || catalog?.services || []).find(
    (item) => item.id === id && item.active,
  );
  if (!service)
    return (
      <ServiceDetailFrame title="Service">
        {catalogError ? (
          <>
            <Empty
              title="We couldn’t load this service"
              detail={catalogError}
            />
            <Button
              label="Retry service"
              onPress={() => {
                setCatalogError("");
                setRetry((value) => value + 1);
              }}
            />
          </>
        ) : !state && !catalog ? (
          <T accessibilityLiveRegion="polite">Loading service details…</T>
        ) : (
          <>
            <Empty
              title="Service unavailable"
              detail="Browse the current services or ask the team about your requirement."
            />
            <Button
              label="Browse services"
              onPress={() => go(state ? "/services" : "/catalog")}
            />
          </>
        )}
      </ServiceDetailFrame>
    );
  const s = service;
  const isQuote = s.bookingMode === "quote";
  const monthly = s.billingPeriod === "monthly";
  const standardMenu = !isQuote && !!s.packageRequired && !!s.packages?.length;
  const selected = s.packages?.find((pack) => pack.id === selectedPackage);
  const availableAddons =
    s.bookingMode === "quote" || (s.packageRequired && !selected)
      ? []
      : s.addons.filter(
          (addon) =>
            addon.enabled !== false &&
            (!addon.packageIds ||
              addon.packageIds.includes(selected?.id || "")),
        );
  const chosenAddons = availableAddons.filter((addon) =>
    addonChoices[id]?.includes(addon.id),
  );
  const pricedSelection = servicePricing(
    selected
      ? { ...s, packageRequired: true, packages: [selected] }
      : s.packageRequired
        ? s
        : { ...s, packages: [] },
  );
  const minimum = pricedSelection.minimum;
  const showStartingPrice =
    (!selected && s.packageRequired) ||
    s.optionGroups?.some((group) => group.required);
  const included = selected?.includes?.length ? selected.includes : s.includes;
  const excluded = [
    ...new Set([...(s.excludes || []), ...(selected?.excludes || [])]),
  ];
  const detailPrice = monthly
    ? "Monthly price on request"
    : minimum === null
      ? servicePriceText(s)
      : (showStartingPrice ? "From " : "") +
        money(
          minimum + chosenAddons.reduce((sum, addon) => sum + addon.price, 0),
        );
  function choosePackage(packageId: string) {
    setSelectedPackages((previous) => ({ ...previous, [id]: packageId }));
    setAddonChoices((previous) => {
      if (!previous[id]) return previous;
      const retained = s.addons.filter(
        (addon) =>
          previous[id].includes(addon.id) &&
          addon.enabled !== false &&
          (!addon.packageIds || addon.packageIds.includes(packageId)),
      );
      return { ...previous, [id]: retained.map((addon) => addon.id) };
    });
  }
  const continueBooking = (
    packageId = selected?.id || "",
    entryId?: string,
  ) => {
    const chosenPackage = s.packages?.find((pack) => pack.id === packageId);
    if (!isQuote && s.packageRequired && !chosenPackage) return;
    const query: string[] = [];
    if (chosenPackage)
      query.push("packageId=" + encodeURIComponent(chosenPackage.id));
    if (standardMenu) {
      // A fresh Book action must win over a previously edited draft. Keeping
      // this ID in the URL still lets a reload restore that same checkout.
      query.push("addonIds=");
      query.push("entryId=" + entryId);
    } else if (addonChoices[id])
      query.push(
        "addonIds=" +
          chosenAddons
            .filter(
              (a) =>
                !a.packageIds || a.packageIds.includes(chosenPackage?.id || ""),
            )
            .map((a) => a.id)
            .join(","),
      );
    const destination =
      s.bookingMode === "quote"
        ? "/quotes?serviceId=" +
          s.id +
          (chosenPackage
            ? "&packageId=" + encodeURIComponent(chosenPackage.id)
            : "")
        : "/checkout/" + s.id + (query.length ? "?" + query.join("&") : "");
    go(
      state
        ? destination
        : "/sign-in?returnTo=" + encodeURIComponent(destination),
    );
  };
  return (
    <ServiceDetailFrame
      title={s.category}
      footer={
        standardMenu && !selected ? undefined : (
          <View style={{ gap: 10 }}>
            <Row
              style={{
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <View style={{ flex: 1 }}>
                <T size={18} bold color={c.green}>
                  {detailPrice}
                </T>
                <T size={10} color={c.muted}>
                  {monthly
                    ? "The team confirms the monthly price and visit schedule"
                    : isQuote
                      ? "Review the scope and price before accepting"
                      : selected
                        ? selected.name + " · Review total at checkout"
                        : s.packageRequired
                          ? "Choose a package to review your total"
                          : "Standard service · Review total at checkout"}
                </T>
              </View>
            </Row>
            <Button
              label={
                monthly
                  ? state
                    ? "Request a monthly plan"
                    : "Sign in to request a monthly plan"
                  : state
                    ? isQuote
                      ? "Request a tailored quote"
                      : "Continue"
                    : isQuote
                      ? "Sign in to request a quote"
                      : "Sign in to book"
              }
              onPress={() => continueBooking(undefined, createVisitEntryId())}
            />
          </View>
        )
      }
    >
      {!standardMenu && (
        <View style={{ borderRadius: 24, overflow: "hidden" }}>
          <ServicePhoto service={s} style={{ height: 200 }} />
        </View>
      )}
      <View style={{ gap: 9 }}>
        {monthly && <Badge label="Monthly subscription" />}
        <T
          size={10}
          bold
          color={c.green}
          style={{ letterSpacing: 1.4, textTransform: "uppercase" }}
        >
          {[s.category, s.subcategory].filter(Boolean).join(" · ")}
        </T>
        <T bold size={standardMenu ? 26 : 29} style={{ lineHeight: 37 }}>
          {(lang === "te" && s.nameTe) || s.name}
        </T>
        <T color={c.muted} size={13}>
          {(lang === "te" && s.descriptionTe) || s.description}
        </T>
        {!monthly && !standardMenu && (
          <Row style={{ flexWrap: "wrap", gap: 8, marginTop: 5 }}>
            <T bold size={21} color={c.green}>
              {servicePriceText(s)}
            </T>
            <T size={12} color={c.muted}>
              {"· "}
              {serviceDurationText(s)}
            </T>
          </Row>
        )}
        {(state?.mode === "demo" || catalog?.mode === "demo" || s.sample) && (
          <Badge
            label={
              monthly
                ? "Sample monthly plan"
                : "Sample service · fictional prices"
            }
            tone="amber"
          />
        )}
      </View>
      {standardMenu && (
        <ServiceMenu
          service={s}
          selectedId={selectedPackage}
          onSelect={choosePackage}
          onBook={continueBooking}
        />
      )}
      {!!s.priceUnit && (
        <View
          style={{
            padding: 18,
            backgroundColor: c.mint,
            borderRadius: 17,
            gap: 6,
          }}
        >
          <T bold size={13}>
            What one booking covers
          </T>
          <T size={12} color={c.green}>
            {s.priceUnit}
          </T>
        </View>
      )}
      {!standardMenu && !!s.packages?.length && (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 4 }}>
            <T bold size={21}>
              Compare packages
            </T>
            <T size={12} color={c.muted}>
              {isQuote
                ? "Choose a scope to discuss with the team."
                : s.packageRequired
                  ? "Choose a package for your home. You can review your selection at checkout."
                  : "Keep the standard service or choose a package below."}
            </T>
          </View>
          {!s.packageRequired && !isQuote && (
            <Pressable
              accessibilityRole="radio"
              aria-checked={!selected}
              accessibilityState={{ checked: !selected }}
              onPress={() => choosePackage("")}
              style={{
                borderRadius: 16,
                padding: 16,
                gap: 4,
                borderWidth: 1,
                borderColor: selected ? c.line : c.green,
                backgroundColor: selected ? c.white : c.mint,
              }}
            >
              <T bold>Standard service</T>
              <T size={12} color={c.muted}>
                {money(s.price) + " · " + s.duration + " min"}
              </T>
            </Pressable>
          )}
          {s.packages.map((pack) => {
            const active = selectedPackage === pack.id;
            return (
              <Pressable
                key={pack.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                aria-checked={active}
                accessibilityLabel={[
                  t(pack.name),
                  isQuote
                    ? t("Price and duration confirmed by quote")
                    : money(pack.price) + " " + t("package base price"),
                  isQuote ? "" : t(pack.duration + " min"),
                  t(pack.description),
                  t("Includes:") + " " + pack.includes.map(t).join("; "),
                  pack.excludes?.length
                    ? t("Not included:") + " " + pack.excludes.map(t).join("; ")
                    : "",
                ]
                  .filter(Boolean)
                  .join(". ")}
                accessibilityHint={t(
                  "Select this package, then continue to customize your booking.",
                )}
                onPress={() =>
                  choosePackage(
                    active && (!s.packageRequired || isQuote) ? "" : pack.id,
                  )
                }
                style={{
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? c.green : c.line,
                  borderRadius: 20,
                  backgroundColor: c.white,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 5,
                    backgroundColor: active ? c.green : c.mint,
                  }}
                />
                <View style={{ padding: 19, gap: 11 }}>
                  <Row
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <View style={{ flex: 1, gap: 5 }}>
                      <T bold size={18}>
                        {pack.name}
                      </T>
                      <T size={11} color={c.muted}>
                        {isQuote
                          ? "Scope and price confirmed by quote"
                          : pack.duration + " min · Package base price"}
                      </T>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? c.green : c.line,
                        backgroundColor: active ? c.green : c.white,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && (
                        <Icon name="check" color={c.white} size={16} />
                      )}
                    </View>
                  </Row>
                  <T size={12} color={c.muted}>
                    {pack.description}
                  </T>
                  {pack.includes.map((line, index) => (
                    <Row
                      key={index}
                      style={{ gap: 8, alignItems: "flex-start" }}
                    >
                      <Icon name="check" size={15} />
                      <T size={12} style={{ flex: 1 }}>
                        {line}
                      </T>
                    </Row>
                  ))}
                  {!!pack.excludes?.length && (
                    <T size={11} color={c.muted}>
                      {t("Not included:") +
                        " " +
                        pack.excludes.map(t).join("; ")}
                    </T>
                  )}
                  <Row
                    style={{
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                    }}
                  >
                    <T size={19} bold color={c.green}>
                      {isQuote ? "Tailored quote" : money(pack.price)}
                    </T>
                    <T bold size={12} color={c.green}>
                      {active ? "Selected" : "Select package"}
                    </T>
                  </Row>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {!standardMenu && (
        <View
          style={{
            padding: 21,
            borderRadius: 20,
            backgroundColor: c.white,
            borderWidth: 1,
            borderColor: c.line,
            gap: 14,
          }}
        >
          <T bold size={20}>
            {selected
              ? t("Included in") + " " + t(selected.name)
              : s.packageRequired
                ? "About the service"
                : "What’s included"}
          </T>
          {included.map((item) => (
            <Row key={item} style={{ alignItems: "flex-start", gap: 10 }}>
              <Icon name="check" size={18} />
              <T size={13} style={{ flex: 1 }}>
                {item}
              </T>
            </Row>
          ))}
        </View>
      )}
      {!standardMenu && !!excluded.length && (
        <View
          style={{
            padding: 20,
            borderRadius: 20,
            backgroundColor: c.soft,
            gap: 10,
          }}
        >
          <T bold size={17}>
            Not included
          </T>
          {excluded.map((item) => (
            <T key={item} color={c.muted} size={12}>
              {"• " + item}
            </T>
          ))}
        </View>
      )}
      {!!s.checklist?.length && (
        <Card>
          <T bold size={18}>
            During the visit
          </T>
          {s.checklist.map((step, index) => (
            <Row key={index} style={{ alignItems: "flex-start" }}>
              <Icon name="check" size={16} />
              <T style={{ flex: 1 }}>{step}</T>
            </Row>
          ))}
        </Card>
      )}
      {!standardMenu && !!availableAddons.length && (
        <Card>
          <T bold size={18}>
            Optional add-ons
          </T>
          {availableAddons.map((addon) => {
            const checked = chosenAddons.some((item) => item.id === addon.id);
            return (
              <Pressable
                key={addon.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                aria-checked={checked}
                onPress={() =>
                  setAddonChoices((previous) => {
                    const ids = previous[id] || [];
                    return {
                      ...previous,
                      [id]: ids.includes(addon.id)
                        ? ids.filter((value) => value !== addon.id)
                        : [...ids, addon.id],
                    };
                  })
                }
                style={{
                  paddingVertical: 10,
                  minHeight: 48,
                  borderTopWidth: 1,
                  borderColor: c.line,
                }}
              >
                <Row>
                  <View style={{ flex: 1 }}>
                    <T bold size={13}>
                      {addon.name}
                    </T>
                    <T size={12} color={c.muted}>
                      {money(addon.price) +
                        (addon.duration
                          ? " · +" + addon.duration + " min"
                          : "")}
                    </T>
                  </View>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: c.green,
                      backgroundColor: checked ? c.green : c.white,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {checked && <Icon name="check" size={16} color={c.white} />}
                  </View>
                </Row>
              </Pressable>
            );
          })}
        </Card>
      )}
      <ServiceCare service={s} />
      {state && (
        <Card>
          <T bold size={17}>
            Cancellations and rescheduling
          </T>
          <T size={13} color={c.muted}>
            {state.settings.cancelCutoffHours
              ? "Manage eligible bookings up to " +
                state.settings.cancelCutoffHours +
                " hours before the visit in Bookings."
              : "Manage eligible bookings in Bookings before the visit."}
          </T>
        </Card>
      )}
      {s.bookingMode !== "quote" && (
        <Button
          label="Need help or a bigger job?"
          secondary
          onPress={() => {
            const target = "/quotes?serviceId=" + s.id;
            go(
              state
                ? target
                : "/sign-in?returnTo=" + encodeURIComponent(target),
            );
          }}
        />
      )}
    </ServiceDetailFrame>
  );
}
export function SlotPicker({
  value,
  onChange,
  serviceId,
  bookingId,
  pin,
  selection,
  quoteId,
  onValidityChange,
}: {
  value: number;
  onChange: (n: number) => void;
  serviceId: string;
  bookingId?: string;
  pin?: string;
  selection?: string;
  quoteId?: string;
  onValidityChange: (value: boolean) => void;
}) {
  const { lang, read } = useApp(),
    day = serviceDay(value);
  const query =
    "/availability?serviceId=" +
    encodeURIComponent(serviceId) +
    "&date=" +
    day +
    (bookingId ? "&bookingId=" + encodeURIComponent(bookingId) : "") +
    (quoteId ? "&quoteId=" + encodeURIComponent(quoteId) : "") +
    (pin ? "&pin=" + encodeURIComponent(pin) : "") +
    (selection ? "&selection=" + encodeURIComponent(selection) : "");
  type AvailableTime = { slot: number; available: boolean };
  const [result, setResult] = useState<{
    query: string;
    times: AvailableTime[];
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  const current = result?.query === query ? result : undefined;
  const valid =
    current?.times.some((a) => a.slot === value && a.available) ?? false;
  useEffect(() => {
    onValidityChange(valid);
    return () => onValidityChange(false);
  }, [onValidityChange, valid]);
  useEffect(() => {
    let cancelled = false;
    void read<AvailableTime[]>(query)
      .then((times) => {
        if (!cancelled) setResult({ query, times });
      })
      .catch((e) => {
        if (!cancelled) setResult({ query, times: [], error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [query, read, attempt]);
  return (
    <View style={{ gap: 14 }}>
      <Row style={{ gap: 8 }}>
        <Icon name="calendar" size={20} />
        <T bold size={18}>
          Choose your slot
        </T>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row>
          {slots().map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={new Date(n).toLocaleDateString(
                lang === "te" ? "te-IN" : "en-IN",
                {
                  timeZone: "Asia/Kolkata",
                },
              )}
              accessibilityState={{ selected: serviceDay(n) === day }}
              onPress={() =>
                onChange(atHour(serviceDay(n), serviceHour(value)))
              }
              style={{
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: serviceDay(n) === day ? c.green : c.line,
                backgroundColor: serviceDay(n) === day ? c.green : c.white,
                minWidth: 66,
                gap: 3,
                alignItems: "center",
              }}
            >
              <T color={serviceDay(n) === day ? c.white : c.muted} size={11}>
                {new Date(n).toLocaleDateString(
                  lang === "te" ? "te-IN" : "en-IN",
                  { timeZone: "Asia/Kolkata", weekday: "short" },
                )}
              </T>
              <T bold color={serviceDay(n) === day ? c.white : c.ink} size={22}>
                {new Date(n).toLocaleDateString(
                  lang === "te" ? "te-IN" : "en-IN",
                  { timeZone: "Asia/Kolkata", day: "numeric" },
                )}
              </T>
              <T color={serviceDay(n) === day ? c.white : c.muted} size={10}>
                {new Date(n).toLocaleDateString(
                  lang === "te" ? "te-IN" : "en-IN",
                  { timeZone: "Asia/Kolkata", month: "short" },
                )}
              </T>
            </Pressable>
          ))}
        </Row>
      </ScrollView>
      <T bold>Available time</T>
      <T size={11} color={c.muted}>
        All service times are in Indian Standard Time.
      </T>
      <View style={styles.grid}>
        {[9, 12, 15, 18].map((h) => {
          const time = atHour(day, h),
            available = current?.times.some(
              (a) => a.slot === time && a.available,
            );
          return (
            <Pressable
              key={h}
              accessibilityRole="button"
              accessibilityLabel={
                lang === "te" ? `${h}:00 సమయం` : `${h}:00 slot`
              }
              accessibilityState={{
                disabled: !available,
                selected: available && time === value,
              }}
              disabled={!available}
              onPress={() => onChange(time)}
              style={{
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: available && time === value ? c.green : c.line,
                backgroundColor: available && time === value ? c.mint : c.white,
                width: "47%",
                minHeight: 58,
                justifyContent: "center",
                alignItems: "center",
                opacity: available ? 1 : 0.4,
              }}
            >
              <T bold color={c.green}>
                {h > 12 ? h - 12 : h}:00{" "}
                {lang === "te"
                  ? h < 12
                    ? "ఉదయం"
                    : h < 18
                      ? "మధ్యాహ్నం"
                      : "సాయంత్రం"
                  : h >= 12
                    ? "PM"
                    : "AM"}
              </T>
            </Pressable>
          );
        })}
      </View>
      {current?.error ? (
        <>
          <T color={c.red}>{current.error}</T>
          <Button
            label="Check again"
            secondary
            onPress={() => {
              setResult(undefined);
              setAttempt((n) => n + 1);
            }}
          />
        </>
      ) : !current ? (
        <T color={c.muted}>Checking availability…</T>
      ) : !current.times.some((t) => t.available) ? (
        <T color={c.muted}>
          No times are available for this date. Choose another day.
        </T>
      ) : !valid ? (
        <T color={c.muted}>Choose an available time to continue.</T>
      ) : null}
    </View>
  );
}
export function Checkout() {
  const { state } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!state)
    return (
      <Shell title="Your cart" back>
        <T>Loading your visit…</T>
      </Shell>
    );
  return <VisitCheckout key={state.user.id + ":" + id} />;
}
function VisitCheckout() {
  const {
      id,
      packageId: requestedPackageId,
      addonIds,
      entryId,
    } = useLocalSearchParams<{
      id: string;
      packageId?: string;
      addonIds?: string;
      entryId?: string;
    }>(),
    { state, request, busy, selectedAddress, refresh, lang, t } = useApp();
  const focused = useIsFocused();
  const s = state?.services.find((x) => x.id === id);
  const servicePins = availableServicePins(state?.settings.pins || [], s);
  const availablePackageIds = s?.packages?.map((p) => p.id).join(",") || "";
  const [step, setStep] = useState(0),
    [quantity, setQuantity] = useState(1),
    [validSlot, setValidSlot] = useState(false),
    [addon, setAddon] = useState<string[]>([]),
    [packageId, setPackageId] = useState(""),
    [options, setOptions] = useState<Record<string, string>>({}),
    [details, setDetails] = useState<Record<string, string>>({}),
    [instructions, setInstructions] = useState(""),
    [line, setLine] = useState(selectedAddress?.line || ""),
    [pin, setPin] = useState(
      selectedAddress?.pin || (servicePins.length === 1 ? servicePins[0] : ""),
    ),
    [slot, setSlot] = useState(() => slots()[0]),
    [validation, setValidation] = useState(""),
    [promoCode, setPromoCode] = useState(""),
    [quote, setQuote] = useState<{
      total: number;
      discount: number;
      subtotal: number;
      code: string;
    } | null>(null);
  useEffect(() => {
    if (Platform.OS !== "android" || !focused || step === 0) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setValidation("");
        setStep((current) => Math.max(0, current - 1));
        return true;
      },
    );
    return () => subscription.remove();
  }, [focused, step]);
  const [key, setKey] = useState(newBookingKey);
  const [editingPackage, setEditingPackage] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const draftUser = state?.user.id;
  const entrySelection = JSON.stringify([
    requestedPackageId,
    addonIds,
    entryId,
  ]);
  const pendingSave = React.useRef<(() => void) | null>(null);
  useEffect(() => () => pendingSave.current?.(), []);
  useEffect(() => {
    let current = true;
    if (!draftUser || !id) return;
    void loadDraft<VisitDraft>(draftUser, "checkout-" + id)
      .then((d) => {
        if (!current) return;
        const returning = d?.entrySelection === entrySelection;
        setAddon(
          !returning && addonIds !== undefined
            ? addonIds.split(",").filter(Boolean)
            : d?.addon || [],
        );
        if (d) {
          setQuantity(d.quantity || 1);
          setPromoCode(d.promoCode || "");

          setOptions(d.options);
          setDetails(d.details || {});
          setInstructions(d.instructions);
          setLine(d.line);
          setPin(d.pin);
          setSlot(d.slot > Date.now() + 3600000 ? d.slot : slots()[0]);
          setKey(d.key);
          setDraftStatus(
            "Your saved booking draft is ready. Please review the service and slot.",
          );
        }
        setPackageId(
          checkoutPackageChoice(
            availablePackageIds.split(","),
            returning ? undefined : requestedPackageId,
            d?.packageId,
          ),
        );
        setDraftReady(true);
      })
      .catch(() => {
        if (!current) return;
        setDraftStatus(
          "Your saved cart could not be opened. Review your selections before continuing.",
        );
        setDraftReady(true);
      });
    return () => {
      current = false;
    };
  }, [
    draftUser,
    id,
    requestedPackageId,
    availablePackageIds,
    addonIds,
    entrySelection,
  ]);
  useEffect(() => {
    if (!draftReady || !draftUser || !id) return;
    const persist = () => {
      pendingSave.current = null;
      void saveDraft(draftUser, "checkout-" + id, {
        addon,
        entrySelection,
        promoCode,
        quantity,
        packageId,
        options,
        details,
        instructions,
        line,
        pin,
        slot,
        key,
      })
        .then(() =>
          setDraftStatus(
            "Draft saved on this device. It does not reserve a service slot.",
          ),
        )
        .catch(() =>
          setDraftStatus(
            "Draft could not be saved. Keep this page open until you finish.",
          ),
        );
    };
    pendingSave.current = persist;
    const timeout = setTimeout(persist, 700);
    return () => clearTimeout(timeout);
  }, [
    draftReady,
    draftUser,
    id,
    addon,
    entrySelection,
    promoCode,
    quantity,
    packageId,
    options,
    details,
    instructions,
    line,
    pin,
    slot,
    key,
  ]);
  if (!s)
    return (
      <Shell title="Service unavailable" back>
        <T>Choose another service.</T>
      </Shell>
    );
  if (s.bookingMode === "quote")
    return (
      <Shell title={s.name} back>
        <Card>
          <T bold size={22}>
            {s.billingPeriod === "monthly"
              ? "Monthly subscription"
              : "Get an approved price first"}
          </T>
          <T>
            {s.billingPeriod === "monthly"
              ? "The team confirms the monthly price and visit schedule"
              : "This work is priced for your requirement. Send a request; the office will propose the included work and total. You pay only after accepting the quote."}
          </T>
          <Button
            label={
              s.billingPeriod === "monthly"
                ? "Request a monthly plan"
                : "Request a tailored quote"
            }
            onPress={() => go("/quotes?serviceId=" + s.id)}
          />
        </Card>
      </Shell>
    );
  const {
    pack,
    choices,
    availableAddons,
    chosenAddons,
    count,
    basePrice,
    duration,
    subtotal,
    complete,
  } = cartSelection(s, { addon, packageId, options, quantity });
  const selection = {
    packageId: pack?.id,
    options: Object.fromEntries(choices.map((o) => [o.groupId, o.id])),
    quantity: count,
    addons: chosenAddons.map((a) => a.id),
  };
  const offer =
      quote?.subtotal === subtotal &&
      quote.code === promoCode.trim().toUpperCase()
        ? quote
        : null,
    total = offer?.total ?? subtotal;
  async function next() {
    if (step === 0) {
      const problem = selectionProblem(s!, packageId, options, details);
      if (!complete || problem || duration > 240 || subtotal > 100000) {
        setValidation(
          problem || "Choose fewer extras to stay within the service limit.",
        );
        return;
      }
      setValidation("");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (line.trim().length < 8 || !servicePins.includes(pin)) {
        setValidation(
          "Enter a complete address and a supported PIN: " +
            servicePins.join(", ") +
            ".",
        );
        return;
      }
      if (!validSlot) {
        setValidation("Choose an available time for this address.");
        return;
      }
      setValidation("");
      setStep(2);
      return;
    }
    try {
      const b = await request<Booking>("/bookings", {
        serviceId: id,
        expectedTotal: total,
        ...selection,
        instructions,
        details: Object.fromEntries(
          (s?.bookingFields || [])
            .filter((f) => details[f.id])
            .map((f) => [f.id, details[f.id]]),
        ),
        ...(offer ? { promoCode: offer.code } : {}),
        address: {
          line,
          pin,
          label:
            state?.addresses.find((a) => a.line === line && a.pin === pin)
              ?.label || "Home",
        },
        slot,
        idempotencyKey: key,
      });
      pendingSave.current = null;
      setDraftReady(false);
      if (draftUser)
        await removeDraft(draftUser, "checkout-" + id).catch(() => {});
      router.replace(("/booking/" + b.id) as never);
    } catch (e) {
      const code = (e as { code?: string }).code;
      const latest = await refresh();
      // The request may have reached the server even though the reply was
      // lost (timeout or dropped network). Open that booking instead of
      // leaving the customer stuck behind a conflicting retry.
      const created = latest?.bookings.find(
        (b) =>
          (b as Booking & { idempotencyKey?: string }).idempotencyKey === key,
      );
      if (created) {
        pendingSave.current = null;
        setDraftReady(false);
        if (draftUser)
          await removeDraft(draftUser, "checkout-" + id).catch(() => {});
        router.replace(("/booking/" + created.id) as never);
        return;
      }
      setValidation((e as Error).message);
      if (code === "IDEMPOTENCY_CONFLICT") setKey(newBookingKey());
      if (code === "OFFER_UNAVAILABLE" || code === "PRICE_CHANGED") {
        setQuote(null);
        return;
      }
      setStep(1);
    }
  }
  return (
    <Shell
      title={["Your cart", "Address & schedule", "Booking summary"][step]}
      back
      onBack={
        step > 0
          ? () => {
              setValidation("");
              setStep(step - 1);
            }
          : undefined
      }
      scrollKey={step}
      footer={
        <View style={{ gap: 10 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={12} color={c.muted} style={{ flex: 1 }}>
              Service total
            </T>
            <T
              size={22}
              bold
              color={c.green}
              style={{ flexShrink: 1, textAlign: "right" }}
            >
              {s.packageRequired && !pack
                ? "Choose a package"
                : s.optionGroups?.some((g) => g.required && !options[g.id])
                  ? "Choose required options"
                  : money(total)}
            </T>
          </Row>
          <Button
            label={step === 2 ? "Continue to payment" : "Continue"}
            loading={busy}
            disabledReason={
              "Wait for the booking draft to load, then choose an available service time."
            }
            disabled={
              !draftReady ||
              (step === 1 &&
                line.trim().length >= 8 &&
                servicePins.includes(pin) &&
                !validSlot)
            }
            onPress={() => void next()}
          />
        </View>
      }
    >
      <BookingSteps step={step} />
      <View style={{ gap: 5 }}>
        <T bold size={24}>
          {
            [
              pack && requestedPackageId
                ? "Your service is selected"
                : "Make it your service",
              "Where and when?",
              "Review your booking",
            ][step]
          }
        </T>
        <T size={13} color={c.muted}>
          {
            [
              "Choose what you need. See your total as you go.",
              "Choose an address and an available time.",
              "Check the details before continuing to payment.",
            ][step]
          }
        </T>
      </View>
      <Row
        style={{
          backgroundColor: c.white,
          borderRadius: 18,
          padding: 12,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <ServicePhoto
          service={s}
          packageName={pack?.name}
          style={{ width: 58, height: 58, borderRadius: 12 }}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <T bold size={16}>
            {s.name}
          </T>
          <T size={12} color={c.muted}>
            {pack?.name || "Standard service"}
          </T>
        </View>
      </Row>
      {!!validation && (
        <T accessibilityRole="alert" color={c.red}>
          {validation}
        </T>
      )}
      {step === 0 ? (
        <>
          {(s.maxQuantity || 1) > 1 && (
            <Card>
              <T bold>Quantity · {s.quantityUnit}</T>
              <Row>
                <Button
                  label="−"
                  secondary
                  disabled={count <= 1}
                  onPress={() => setQuantity(count - 1)}
                />
                <T bold>{count}</T>
                <Button
                  label="+"
                  secondary
                  disabled={count >= (s.maxQuantity || 1)}
                  onPress={() => setQuantity(count + 1)}
                />
              </Row>
              <T size={12} color={c.muted}>
                The package and selected choices apply to each unit. Optional
                add-ons are charged once per visit.
              </T>
            </Card>
          )}
          {pack && !editingPackage && !s.optionGroups?.length ? (
            <Button
              label="Change service option"
              secondary
              onPress={() => setEditingPackage(true)}
            />
          ) : (
            <>
              <ServiceChoices
                service={s}
                packageId={packageId}
                options={options}
                onPackage={(value) => {
                  setPackageId(value);
                  setAddon((ids) =>
                    ids.filter((id) =>
                      s.addons.some(
                        (a) =>
                          a.id === id &&
                          a.enabled !== false &&
                          (!a.packageIds || a.packageIds.includes(value)),
                      ),
                    ),
                  );
                }}
                onOption={(id, value) =>
                  setOptions((o) => {
                    const next = { ...o };
                    if (value) next[id] = value;
                    else delete next[id];
                    return next;
                  })
                }
              />
              {!!pack && (
                <Button
                  label="Keep this option"
                  secondary
                  onPress={() => setEditingPackage(false)}
                />
              )}
            </>
          )}
          {availableAddons.length > 0 && (
            <Card>
              <Badge label="Optional" />
              <T bold size={18}>
                Useful extras for this job
              </T>
              <T size={12} color={c.muted}>
                Optional. Nothing is added unless you select it.
              </T>
              {availableAddons.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="checkbox"
                  aria-checked={addon.includes(a.id)}
                  accessibilityState={{ checked: addon.includes(a.id) }}
                  accessibilityLabel={t(a.name)}
                  style={{
                    minHeight: 56,
                    justifyContent: "center",
                    borderTopWidth: 1,
                    borderTopColor: c.line,
                    paddingVertical: 12,
                  }}
                  onPress={() =>
                    setAddon(
                      addon.includes(a.id)
                        ? addon.filter((x) => x !== a.id)
                        : [...addon, a.id],
                    )
                  }
                >
                  <Row>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderWidth: 1,
                        borderColor: c.green,
                        borderRadius: 6,
                        backgroundColor: addon.includes(a.id)
                          ? c.mint
                          : c.white,
                      }}
                    >
                      {addon.includes(a.id) && <Icon name="check" />}
                    </View>
                    <T style={{ flex: 1 }}>
                      {a.name}
                      {a.duration ? " · +" + a.duration + " min" : ""}
                    </T>
                    <T bold>{money(a.price)}</T>
                  </Row>
                </Pressable>
              ))}
            </Card>
          )}
          <SelectedServiceScope service={s} packageId={packageId} />
          {!!s.bookingFields?.length && (
            <Card>
              <T bold>Details for this service</T>
              {s.bookingFields.map((f) => (
                <View key={f.id} style={{ gap: 6 }}>
                  <Input
                    label={
                      f.label + (f.required ? " (required)" : " (optional)")
                    }
                    placeholder={f.placeholder}
                    value={details[f.id] || ""}
                    onChangeText={(v) =>
                      setDetails((d) => ({ ...d, [f.id]: v }))
                    }
                    maxLength={300}
                  />
                  {!!f.help && (
                    <T size={12} color={c.muted}>
                      {f.help}
                    </T>
                  )}
                </View>
              ))}
            </Card>
          )}
          <Input
            label="Instructions for your professional"
            placeholder="Access directions, pets, areas needing care (optional)"
            value={instructions}
            onChangeText={setInstructions}
            maxLength={1000}
            multiline
          />
        </>
      ) : step === 1 ? (
        <>
          <Card>
            <Row>
              <Icon name="home" size={20} />
              <T bold size={18}>
                Service address
              </T>
            </Row>
            {state?.addresses.map((a) => {
              const selected = a.line === line && a.pin === pin;
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityLabel={a.label + " · " + a.line}
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    setLine(a.line);
                    setPin(a.pin);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? c.green : c.line,
                    backgroundColor: selected ? c.mint : c.white,
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <Row>
                    <Icon name={selected ? "check" : "home"} size={18} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <T bold size={13}>
                        {a.label}
                      </T>
                      <T size={12} color={c.muted}>
                        {a.line + " · " + a.pin}
                      </T>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
            <Input
              label="Your address"
              placeholder="House / flat, street, landmark"
              value={line}
              onChangeText={setLine}
              multiline
            />
            <Input
              label="PIN code"
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <T color={c.muted} size={12}>
              Service area PINs: {servicePins.join(", ")}
            </T>
          </Card>
          {!!pin && pin.length === 6 && !servicePins.includes(pin) && (
            <T color={c.red} accessibilityRole="alert">
              This service is unavailable for that PIN code.
            </T>
          )}
          {servicePins.includes(pin) && (
            <Card>
              <SlotPicker
                onValidityChange={setValidSlot}
                value={slot}
                onChange={setSlot}
                serviceId={id}
                pin={pin}
                selection={JSON.stringify(selection)}
              />
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <T bold size={18}>
                Your visit
              </T>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <T bold size={12} color={c.green}>
                  Edit address or slot
                </T>
              </Pressable>
            </Row>
            <Row style={{ alignItems: "flex-start" }}>
              <Icon name="home" size={19} />
              <View style={{ flex: 1, gap: 3 }}>
                <T bold size={12}>
                  Your address
                </T>
                <T size={13} color={c.muted}>
                  {line + " · " + pin}
                </T>
              </View>
            </Row>
            <View style={{ height: 1, backgroundColor: c.line }} />
            <Row style={{ alignItems: "flex-start" }}>
              <Icon name="calendar" size={19} />
              <View style={{ flex: 1, gap: 3 }}>
                <T bold size={12}>
                  Visit time
                </T>
                <T size={13} color={c.muted}>
                  {dateLabel(slot, lang)}
                </T>
              </View>
            </Row>
          </Card>
          <Card>
            <T bold size={18}>
              Payment summary
            </T>
            <Row style={{ justifyContent: "space-between" }}>
              <T style={{ flex: 1 }}>
                {pack?.name || s.name}
                {count > 1 ? " × " + count : ""}
              </T>
              <T>{money(basePrice * count)}</T>
            </Row>
            {choices.map((o) => (
              <Row key={o.group} style={{ justifyContent: "space-between" }}>
                <T style={{ flex: 1 }}>
                  {o.name}
                  {count > 1 ? " × " + count : ""}
                </T>
                <T>{money(o.price * count)}</T>
              </Row>
            ))}
            {chosenAddons.map((a) => (
              <Row key={a.id} style={{ justifyContent: "space-between" }}>
                <T style={{ flex: 1 }}>{a.name}</T>
                <T>{money(a.price)}</T>
              </Row>
            ))}
            <Row style={{ justifyContent: "space-between" }}>
              <T>Subtotal</T>
              <T>{money(subtotal)}</T>
            </Row>
            {offer && (
              <Row style={{ justifyContent: "space-between" }}>
                <T>Discount · {offer.code}</T>
                <T>−{money(offer.discount)}</T>
              </Row>
            )}
            <T size={12} color={c.muted}>
              No extra tax or fee is added at checkout.
            </T>
            <Divider />
            <Row style={{ justifyContent: "space-between" }}>
              <T bold>Service total</T>
              <T bold size={23} color={c.green}>
                {s.packageRequired && !pack
                  ? "Choose a package"
                  : s.optionGroups?.some((g) => g.required && !options[g.id])
                    ? "Choose required options"
                    : money(total)}
              </T>
            </Row>
          </Card>
          <Input
            label="Offer code"
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
          />
          <Button
            label="Apply offer"
            secondary
            loading={busy}
            disabledReason={"Enter an offer code first."}
            disabled={!promoCode.trim()}
            onPress={() =>
              void request<{
                total: number;
                discount: number;
                subtotal: number;
              }>("/quote", { serviceId: id, ...selection, promoCode })
                .then((q) =>
                  setQuote({ ...q, code: promoCode.trim().toUpperCase() }),
                )
                .catch((e) => {
                  setQuote(null);
                  setValidation(e.message);
                })
            }
          />
          {offer && (
            <Badge
              label={"Offer applied · " + money(offer.discount) + " saved"}
            />
          )}
          <Card>
            <T bold>Included in this booking</T>
            {(pack?.includes?.length ? pack.includes : s.includes).map(
              (line, i) => (
                <T key={i}>{"✓ " + line}</T>
              ),
            )}
            {[...(s.excludes || []), ...(pack?.excludes || [])].length > 0 && (
              <>
                <T bold>Not included</T>
                {[
                  ...new Set([
                    ...(s.excludes || []),
                    ...(pack?.excludes || []),
                  ]),
                ].map((line, i) => (
                  <T key={i}>{"• " + line}</T>
                ))}
              </>
            )}
            {choices.map((o, i) => (
              <T key={i}>
                {o.group +
                  ": " +
                  o.name +
                  (o.price ? " · +" + money(o.price) : " · Included")}
              </T>
            ))}
            <T>{duration + " minutes"}</T>
            {s.bookingFields
              ?.filter((f) => details[f.id])
              .map((f) => (
                <T key={f.id}>{f.label + ": " + details[f.id]}</T>
              ))}
            {!!instructions && <T>{instructions}</T>}
            <Button secondary label="Edit cart" onPress={() => setStep(0)} />
          </Card>
          <T size={12} color={c.muted}>
            {state?.mode === "demo" ? "Sample policy: " : "Booking policy: "}{" "}
            cancel or reschedule up to {state?.settings.cancelCutoffHours ?? 2}{" "}
            hours before the slot. Later changes need Customer Care. Unfulfilled
            paid bookings receive a full refund.
          </T>
        </>
      )}
      {!!draftStatus && (
        <T size={11} color={c.muted}>
          {draftStatus}
        </T>
      )}
      {step > 0 && (
        <Button
          label="Previous step"
          secondary
          onPress={() => setStep(step - 1)}
        />
      )}
    </Shell>
  );
}
export function BookingCard({ b }: { b: Booking }) {
  const { lang, t, state } = useApp();
  const service = state?.services.find((service) => service.id === b.serviceId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        lang === "te"
          ? t(b.serviceName) + " బుకింగ్ తెరవండి"
          : "Open " + b.serviceName + " booking"
      }
      onPress={() => go("/booking/" + b.id)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card>
        <Row style={{ alignItems: "flex-start" }}>
          <ServicePhoto
            service={service}
            style={{ width: 64, height: 64, borderRadius: 14 }}
          />
          <View style={{ flex: 1, gap: 7 }}>
            <T bold size={17}>
              {b.serviceName}
            </T>
            <Badge
              label={statusLabel(b.status)}
              tone={
                b.status === "cancelled"
                  ? "red"
                  : b.status === "payment_pending"
                    ? "amber"
                    : "green"
              }
            />
          </View>
        </Row>
        <Row style={{ gap: 8 }}>
          <Icon name="calendar" size={16} color={c.muted} />
          <T size={12} color={c.muted} style={{ flex: 1 }}>
            {dateLabel(b.slot, lang)}
          </T>
        </Row>
        <View style={{ height: 1, backgroundColor: c.line }} />
        <Row style={{ justifyContent: "space-between" }}>
          <T bold size={17} color={c.green}>
            {money(b.total)}
          </T>
          <Row style={{ gap: 6 }}>
            <T bold size={12} color={c.green}>
              View booking
            </T>
            <Icon name="next" size={16} />
          </Row>
        </Row>
      </Card>
    </Pressable>
  );
}
export function Bookings() {
  const { state, read } = useApp(),
    [filter, setFilter] = useState("active"),
    [older, setOlder] = useState<Booking[]>([]),
    [more, setMore] = useState(true),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const last = older.at(-1) || state?.bookings.at(-1);
    if (!last) return;
    setLoading(true);
    setMessage("");
    try {
      const page = await read<{ rows: Booking[]; nextCursor: unknown }>(
        "/bookings?cursor=" +
          encodeURIComponent(JSON.stringify([last.createdAt, last.id])),
      );
      setOlder((rows) => [...rows, ...page.rows]);
      setMore(!!page.nextCursor);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const bookings =
    [
      ...new Map(
        [...older, ...(state?.bookings || [])].map((b) => [b.id, b]),
      ).values(),
    ]
      .filter((b) =>
        filter === "active"
          ? !["completed", "cancelled", "payment_expired"].includes(b.status)
          : ["completed", "cancelled", "payment_expired"].includes(b.status),
      )
      .sort((a, b) => b.createdAt - a.createdAt) || [];
  return (
    <Shell title="Bookings">
      <SectionHeading
        title="Your home, taken care of"
        detail="View upcoming visits and past services."
      />
      <Row
        style={{
          gap: 4,
          backgroundColor: c.soft,
          borderRadius: 16,
          padding: 4,
        }}
      >
        {["active", "past"].map((f) => (
          <Pressable
            key={f}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: filter === f ? c.white : "transparent",
            }}
          >
            <T bold color={c.green}>
              {f === "active" ? "Upcoming" : "Past bookings"}
            </T>
          </Pressable>
        ))}
      </Row>
      {bookings.map((b) => (
        <BookingCard key={b.id} b={b} />
      ))}
      {state?.hasMoreBookings && more && (
        <Button
          label="Load earlier bookings"
          secondary
          loading={loading}
          onPress={() => void load()}
        />
      )}
      {!!message && <T color={c.red}>{message}</T>}
      {!bookings.length && (
        <Empty
          title={
            filter === "active" ? "No upcoming visits" : "No past bookings"
          }
          detail={
            filter === "active"
              ? "Choose a service and we’ll help take care of the rest."
              : "Completed and cancelled services will appear here."
          }
        >
          <Button label="Browse services" onPress={() => go("/services")} />
        </Empty>
      )}
    </Shell>
  );
}
export function BookingDetail() {
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>(),
    { state, request, busy, lang, read, t } = useApp();
  const [loaded, setLoaded] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const current = state?.bookings.find((x) => x.id === id);
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    setLoaded(null);
    setLoadError("");
    if (state?.user.id && !current)
      void read<Booking>("/bookings/" + id)
        .then((b) => {
          if (!cancelled) setLoaded(b);
        })
        .catch((e) => {
          if (!cancelled) setLoadError((e as Error).message);
        });
    return () => {
      cancelled = true;
    };
  }, [id, state?.user.id, current, read, attempt, focused]);
  const b = current || loaded,
    p = state?.professionals.find((x) => x.id === b?.professionalId);
  const [edit, setEdit] = useState(false),
    [validSlot, setValidSlot] = useState(false),
    [slot, setSlot] = useState(() => slots()[0]),
    [cancel, setCancel] = useState(false),
    [rating, setRating] = useState(5),
    [review, setReview] = useState(""),
    [checks, setChecks] = useState([false, false, false]),
    [completionNotes, setCompletionNotes] = useState("");
  const [actionError, setActionError] = useState("");
  const changeDeadline = b
    ? b.slot - (state?.settings.cancelCutoffHours ?? 2) * 3600000
    : undefined;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!focused || !changeDeadline || state?.user.role !== "customer") return;
    let timer: ReturnType<typeof setTimeout>;
    function update(deadline: number) {
      const time = Date.now();
      setNow(time);
      if (time <= deadline)
        timer = setTimeout(
          () => update(deadline),
          Math.min(deadline - time + 1, 86400000),
        );
    }
    update(changeDeadline);
    return () => clearTimeout(timer);
  }, [focused, changeDeadline, state?.user.role]);
  useEffect(() => {
    setChecks([false, false, false]);
    setCompletionNotes("");
    setActionError("");
    setEdit(false);
    setCancel(false);
  }, [id]);
  if (!b)
    return (
      <Shell title="Booking details" back>
        <Empty
          title={loadError ? "Unable to load booking" : "Loading booking…"}
          detail={loadError || "Please wait while we retrieve your booking."}
        />
        {!!loadError && (
          <Button label="Try again" onPress={() => setAttempt((v) => v + 1)} />
        )}
      </Shell>
    );
  const role = state!.user.role;
  const internalStaff = canOperateInternalBooking(b, role);
  const progress = dispatchSummary(
    b,
    ["owner", "care"].includes(role) ? "staff" : "customer",
  );
  const canWork = role === "professional" || internalStaff;
  async function action(action: string, data = {}) {
    setActionError("");
    try {
      const result = await request<Booking>("/bookings/" + id + "/action", {
        action,
        ...(b?.dispatch ? { revision: b.dispatch.revision } : {}),
        ...data,
      });
      setLoaded(result);
      if (action === "decline") go("/jobs");
      setEdit(false);
      setCancel(false);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  const canChange = ["assigned", "confirmed", "awaiting_assignment"].includes(
    b.status,
  );
  const insideWindow = changeDeadline !== undefined && now <= changeDeadline;
  const customerCanCancel = b.payment !== "paid" || insideWindow;
  return (
    <Shell title="Booking details" back>
      <LaundryProgress booking={b} onUpdate={setLoaded} />
      <Badge
        label={progress?.label || statusLabel(b.status)}
        tone={b.status === "cancelled" ? "red" : "green"}
      />
      <T bold size={25}>
        {b.serviceName}
      </T>
      {!!progress && (
        <Card
          style={{ backgroundColor: progress.attention ? c.amberbg : c.mint }}
        >
          <T>{progress.detail}</T>
        </Card>
      )}
      {!!actionError && (
        <T accessibilityRole="alert" color={c.red}>
          {actionError}
        </T>
      )}
      {role === "customer" && b.status === "payment_pending" && (
        <Card style={{ backgroundColor: c.mint }}>
          <T bold size={20}>
            Payment
          </T>
          <T>
            {state?.mode === "demo"
              ? "No real charge. Demo payment only."
              : "Pay securely to reserve your home service."}
          </T>
          <PaymentButton booking={b} />
        </Card>
      )}
      <StaffBookingActions booking={b} onUpdate={setLoaded} />
      <Card>
        <Row>
          <Icon name="calendar" />
          <T style={{ flex: 1 }}>{dateLabel(b.slot, lang)}</T>
        </Row>
        <Divider />
        <Row>
          <Icon name="home" />
          <T style={{ flex: 1 }}>
            {b.address.line} · {b.address.pin}
          </T>
        </Row>
        {role === "professional" && (
          <Button
            label="Open address in Maps"
            secondary
            onPress={() =>
              void Linking.openURL(
                "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(
                    b.address.line + ", " + b.address.pin + ", India",
                  ),
              ).catch(() => {})
            }
          />
        )}
        <Divider />
        <Row style={{ justifyContent: "space-between" }}>
          <T>Service total</T>
          <T bold size={22} color={c.green}>
            {money(b.total)}
          </T>
        </Row>
        <T size={11} color={c.muted}>
          Booking #{b.id.slice(0, 8).toUpperCase()}
        </T>
      </Card>
      <Card>
        <T bold>Booking progress</T>
        {(
          [
            ["Booking created", b.createdAt],
            [
              b.professionalType === "In-house"
                ? "Team assigned by office"
                : "Professional assigned",
              b.assignedAt,
            ],
            [
              b.professionalType === "In-house" && b.dispatch
                ? "Office confirmed"
                : "Professional confirmed",
              b.acceptedAt,
            ],
            ["Team dispatched", b.dispatch?.dispatchedAt],
            ["Professional arrived", b.arrivedAt],
            ["Service started", b.startedAt],
            ["Service completed", b.completedAt],
            ["Booking cancelled", b.cancelledAt],
          ] as [string, number | undefined][]
        )
          .filter(([, at]) => !!at)
          .map(([label, at]) => (
            <Row key={label} style={{ alignItems: "flex-start", gap: 12 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.mint,
                }}
              >
                <Icon name="check" size={14} />
              </View>
              <View style={{ flex: 1, gap: 3, paddingBottom: 10 }}>
                <T size={13} bold>
                  {label}
                </T>
                <T size={11} color={c.muted}>
                  {dateLabel(at!, lang)}
                </T>
              </View>
            </Row>
          ))}
      </Card>
      {role !== "customer" && !!b.customerName && (
        <Card>
          <T bold>Customer</T>
          <Row>
            <Icon name="users" />
            <T bold size={18} style={{ flex: 1 }}>
              {b.customerName}
            </T>
          </Row>
          <T size={12} color={c.muted}>
            Use the booking conversation below to coordinate this visit.
          </T>
        </Card>
      )}
      {p && role !== "professional" && (
        <Card>
          <T bold>
            {role === "customer"
              ? "Your professional"
              : "Assigned professional"}
          </T>
          <Row>
            <ProfessionalPhoto professional={p} size={64} />
            <View style={{ flex: 1 }}>
              <T bold size={18}>
                {p.name}
              </T>
              <T color={c.muted} size={12}>
                {p.type} · ★ {p.rating}
              </T>
            </View>
            <Icon name="shield" />
          </Row>
          {!!p.bio && <T>{p.bio}</T>}
          {!!p.languages?.length && (
            <T color={c.muted}>{"Speaks " + p.languages.join(", ")}</T>
          )}
          <T size={12} color={c.muted}>
            {b.professionalType === "In-house" && b.dispatch
              ? "Your visit is managed by the ANVIRA office. Use Support below for help."
              : b.status === "assigned"
                ? "Your professional will confirm the job shortly."
                : "ANVIRA verified professional"}
          </T>
        </Card>
      )}
      <Conversation booking={b} />
      {role === "customer" && (canChange || b.status === "payment_pending") && (
        <>
          {canChange && (
            <T color={c.muted}>
              {insideWindow
                ? t("Self-service changes close at") +
                  " " +
                  dateLabel(changeDeadline!, lang) +
                  " IST"
                : "Contact Support to change this visit."}
            </T>
          )}
          {canChange && insideWindow && (
            <Button
              label="Reschedule"
              secondary
              disabled={busy}
              onPress={() => setEdit(!edit)}
            />
          )}
          {customerCanCancel && (
            <Button
              label="Cancel booking"
              secondary
              disabled={busy}
              onPress={() => setCancel(!cancel)}
            />
          )}
        </>
      )}
      {edit && (role !== "customer" || (canChange && insideWindow)) && (
        <Card>
          <SlotPicker
            onValidityChange={setValidSlot}
            value={slot}
            onChange={setSlot}
            serviceId={b.serviceId}
            bookingId={b.id}
            pin={b.address.pin}
          />
          <Button
            label="Save new slot"
            disabledReason={"Choose an available time before saving."}
            disabled={!validSlot}
            loading={busy}
            onPress={() => void action("reschedule", { slot })}
          />
        </Card>
      )}
      {cancel &&
        (role !== "customer" ||
          ((canChange || b.status === "payment_pending") &&
            customerCanCancel)) && (
          <Card style={{ backgroundColor: c.redbg }}>
            <T bold>Cancel this booking?</T>
            {b.payment === "paid" && (
              <T size={12}>
                {state?.mode === "demo"
                  ? "Paid bookings are refunded in full after ANVIRA review. This preview simulates the refund."
                  : "Paid bookings are refunded in full after ANVIRA review. The refund returns to your original payment method."}
              </T>
            )}
            <Button
              label="Confirm cancellation"
              danger
              loading={busy}
              onPress={() => void action("cancel")}
            />
            <Button
              label="Keep booking"
              secondary
              onPress={() => setCancel(false)}
            />
          </Card>
        )}
      {!!b.refund && (
        <Card>
          <Badge label={statusLabel(b.refund)} tone="amber" />
          <T size={12} color={c.muted}>
            Refund amount: {money(b.total)} ·{" "}
            {state?.mode === "demo" ? "Demo only" : "Original payment method"}
          </T>
        </Card>
      )}
      {role === "professional" && b.status === "assigned" && (
        <>
          <Button
            label="Accept job"
            loading={busy}
            onPress={() => void action("accept")}
          />
          <Button
            label="Decline job"
            secondary
            disabled={busy}
            onPress={() => void action("decline")}
          />
        </>
      )}
      {!!(
        b.packageName ||
        b.choices?.length ||
        b.details?.length ||
        b.instructions ||
        b.scope?.length
      ) && (
        <Card>
          <T bold>Service plan</T>
          {!!b.packageName && <T bold>{b.packageName}</T>}
          {b.choices?.map((x, i) => (
            <T key={i}>{x.group + ": " + x.name}</T>
          ))}
          {b.scope?.map((x, i) => (
            <T key={i}>{"• " + x}</T>
          ))}
          {b.details?.map((f) => (
            <T key={f.id}>{f.label + ": " + f.value}</T>
          ))}
          {!!b.instructions && (
            <>
              <T bold>Customer instructions</T>
              <T>{b.instructions}</T>
            </>
          )}
          {!!b.exclusions?.length && (
            <>
              <T bold>Not included in this booking</T>
              {b.exclusions.map((line, i) => (
                <T key={i}>{"• " + line}</T>
              ))}
            </>
          )}
          {!!b.warranty && (
            <>
              <T bold>Warranty & revisit terms</T>
              <T>{b.warranty}</T>
            </>
          )}
        </Card>
      )}
      {role === "customer" && b.status === "completed" && (
        <Button
          label="Request a revisit or report a concern"
          secondary
          onPress={() => go("/support?bookingId=" + b.id + "&topic=quality")}
        />
      )}
      {!!b.completionNotes && (
        <Card>
          <T bold>Professional handover notes</T>
          <T>{b.completionNotes}</T>
        </Card>
      )}
      {canWork &&
        b.status === "confirmed" &&
        (!internalStaff || b.dispatch?.state === "dispatched") &&
        (b.arrivedAt ? (
          <Badge label="Arrival recorded" />
        ) : (
          <Button
            label={internalStaff ? "Record team arrival" : "I have arrived"}
            secondary
            loading={busy}
            onPress={() => void action("arrive")}
          />
        ))}
      {canWork &&
        b.status === "confirmed" &&
        (!internalStaff || b.dispatch?.state === "dispatched") && (
          <Button
            label={internalStaff ? "Start internal service" : "Start service"}
            loading={busy}
            onPress={() => void action("start")}
          />
        )}
      {canWork && b.status === "in_progress" && (
        <Card>
          <T bold size={19}>
            Service checklist
          </T>
          {[
            ...(b.serviceChecklist || []),
            "Work completed as agreed",
            "Area cleaned and tools packed",
            "Customer walkthrough completed",
          ].map((x, i) => (
            <Pressable
              key={x}
              accessibilityRole="checkbox"
              accessibilityLabel={x}
              accessibilityState={{ checked: checks[i] }}
              onPress={() =>
                setChecks(
                  Array.from(
                    { length: 3 + (b.serviceChecklist?.length || 0) },
                    (_, j) => (j === i ? !checks[j] : !!checks[j]),
                  ),
                )
              }
            >
              <Row>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderWidth: 1,
                    borderColor: c.green,
                    borderRadius: 6,
                  }}
                >
                  {checks[i] && <Icon name="check" />}
                </View>
                <T style={{ flex: 1 }}>{x}</T>
              </Row>
            </Pressable>
          ))}
          <Input
            label="Handover notes for the customer"
            value={completionNotes}
            onChangeText={setCompletionNotes}
            maxLength={1000}
            multiline
            placeholder="Work completed, care advice, any follow-up (optional)"
          />
          <Button
            label="Complete service"
            loading={busy}
            disabledReason={
              "Complete every service checklist item before finishing the visit."
            }
            disabled={
              checks.length !== 3 + (b.serviceChecklist?.length || 0) ||
              !checks.every(Boolean)
            }
            onPress={() =>
              void action("complete", { checklist: checks, completionNotes })
            }
          />
        </Card>
      )}
      {role === "customer" && b.status === "completed" && !b.review && (
        <Card>
          <T bold size={19}>
            Rate your experience
          </T>
          <Row>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityLabel={`${n} stars`}
                onPress={() => setRating(n)}
                style={{ padding: 8 }}
              >
                <Icon
                  name="star"
                  color={n <= rating ? c.green : c.line}
                  size={26}
                />
              </Pressable>
            ))}
          </Row>
          <Input
            label="Your review"
            value={review}
            onChangeText={setReview}
            placeholder="Tell us about your service"
          />
          <Button
            label="Submit review"
            loading={busy}
            onPress={() => void action("review", { rating, text: review })}
          />
        </Card>
      )}
      {b.review && (
        <Card>
          <T bold>★ {b.review.rating} · Thank you for your review</T>
          <T>{b.review.text}</T>
          {b.review.rating <= 3 && (
            <T color={c.green}>
              We have opened a support request to follow up on your experience.
            </T>
          )}
        </Card>
      )}
      {b.payment !== "pending" && (
        <Card>
          <T bold>Receipt</T>
          <T size={12} color={c.muted}>
            {state?.mode === "demo"
              ? "Sample service receipt · not a tax invoice"
              : "Booking receipt · not a tax invoice"}
          </T>
          <Row style={{ justifyContent: "space-between" }}>
            <T>
              {b.packageName || "Service"}
              {(b.quantity || 1) > 1 ? " × " + b.quantity : ""}
            </T>
            <T>{money(b.price * (b.quantity || 1))}</T>
          </Row>
          {b.choices?.map((o, i) => (
            <Row key={i} style={{ justifyContent: "space-between" }}>
              <T style={{ flex: 1 }}>{o.group + ": " + o.name}</T>
              <T>{money(o.price * (b.quantity || 1))}</T>
            </Row>
          ))}
          {b.addons.map((a) => (
            <Row key={a.id} style={{ justifyContent: "space-between" }}>
              <T>{a.name}</T>
              <T>{money(a.price)}</T>
            </Row>
          ))}
          {!!b.discount && (
            <Row style={{ justifyContent: "space-between" }}>
              <T>Discount</T>
              <T color={c.green}>{"−" + money(b.discount)}</T>
            </Row>
          )}
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <T bold>Total paid</T>
            <T bold>{money(b.total)}</T>
          </Row>
          <Badge
            label={
              b.payment === "refunded"
                ? "Refund complete"
                : state?.mode === "demo"
                  ? "Demo payment recorded"
                  : "Payment captured"
            }
          />
        </Card>
      )}
      {["owner", "care"].includes(role) && canChange && (
        <Card>
          {!b.dispatch && <T bold>Assign a professional</T>}
          {!b.dispatch &&
            state?.professionals
              .filter(
                (p) =>
                  p.approved &&
                  !p.accountless &&
                  p.available !== false &&
                  p.skills.includes(b.serviceId) &&
                  (!p.pins?.length || p.pins.includes(b.address.pin)) &&
                  p.id !== b.professionalId,
              )
              .map((p) => (
                <Button
                  key={p.id}
                  label={"Assign " + p.name}
                  secondary
                  loading={busy}
                  onPress={() =>
                    void action("assign", { professionalId: p.id })
                  }
                />
              ))}
          <Button label="Reschedule" secondary onPress={() => setEdit(!edit)} />
          <Button
            label="Cancel booking"
            secondary
            onPress={() => setCancel(!cancel)}
          />
        </Card>
      )}
      {role === "owner" && b.refund === "requested" && (
        <ConfirmAction
          label="Approve full refund"
          confirmLabel={"Refund " + money(b.total)}
          message={"Refund " + money(b.total) + " to " + b.customerName + "?"}
          loading={busy}
          onConfirm={() => action("refund")}
        />
      )}
      {role === "customer" &&
        ["completed", "cancelled", "payment_expired"].includes(b.status) &&
        state?.services.some((s) => s.id === b.serviceId && s.active) && (
          <Button
            label="Book this service again"
            onPress={() => go("/service/" + b.serviceId)}
          />
        )}
      <Button
        label="Support"
        secondary
        onPress={() => go("/support?bookingId=" + encodeURIComponent(b.id))}
      />
    </Shell>
  );
}
export function Profile() {
  const { state, logout, lang, setLang, switchWorkspace, busy } = useApp();
  return (
    <Shell title="Profile">
      <Card>
        <Row>
          <View
            style={{ backgroundColor: c.mint, borderRadius: 40, padding: 16 }}
          >
            <Icon name="person" size={32} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T bold size={22}>
              {state?.user.name}
            </T>
            <T color={c.muted} size={12}>
              {state?.mode === "demo"
                ? "Demo account"
                : state?.user.phone || state?.user.email || "ANVIRA account"}
            </T>
          </View>
        </Row>
      </Card>
      <Card>
        <T bold>Language</T>
        <Row>
          {(["en", "te"] as const).map((l) => (
            <Pressable
              accessibilityLabel={l === "en" ? "English" : "Telugu"}
              accessibilityRole="radio"
              accessibilityState={{ checked: l === lang }}
              key={l}
              onPress={() => setLang(l)}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: l === lang ? c.mint : c.ivory,
              }}
            >
              <T bold color={c.green}>
                {l === "en" ? "English" : "తెలుగు"}
              </T>
            </Pressable>
          ))}
        </Row>
      </Card>
      {!WEBSITE_STAFF_ONLY && state?.user.primaryRole === "professional" && (
        <Button
          label={
            state.user.role === "professional"
              ? "Switch to customer app"
              : "Switch to professional app"
          }
          secondary
          loading={busy}
          onPress={() => {
            const role =
              state.user.role === "professional" ? "customer" : "professional";
            void switchWorkspace(role)
              .then(() =>
                router.replace(role === "customer" ? "/home" : "/jobs"),
              )
              .catch(() => {});
          }}
        />
      )}
      <View style={{ gap: 10 }}>
        <T bold size={12} color={c.muted}>
          YOUR ACCOUNT
        </T>
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          <MenuRow
            icon="person"
            label="Account settings"
            onPress={() => go("/account")}
          />
          {state?.user.role === "customer" && (
            <>
              <View
                style={{ height: 1, marginLeft: 52, backgroundColor: c.line }}
              />
              <MenuRow
                icon="home"
                label="Saved addresses"
                onPress={() => go("/addresses")}
              />
              <View
                style={{ height: 1, marginLeft: 52, backgroundColor: c.line }}
              />
              <MenuRow
                icon="calendar"
                label="My quotes"
                onPress={() => go("/quotes")}
              />
              <View
                style={{ height: 1, marginLeft: 52, backgroundColor: c.line }}
              />
              <MenuRow
                icon="shield"
                label="Home care passport"
                onPress={() => go("/care")}
              />
            </>
          )}
          {state?.user.role === "professional" && (
            <MenuRow
              icon="tool"
              label="Professional profile"
              onPress={() => go("/partner")}
            />
          )}
        </Card>
      </View>
      <View style={{ gap: 10 }}>
        <T bold size={12} color={c.muted}>
          HELP & UPDATES
        </T>
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          <MenuRow
            icon="bell"
            label="Notifications"
            onPress={() => go("/notifications")}
          />
          <View
            style={{ height: 1, marginLeft: 52, backgroundColor: c.line }}
          />
          <MenuRow
            icon="phone"
            label="Support"
            onPress={() => go("/support")}
          />
          {state?.user.role === "customer" && (
            <>
              <View
                style={{ height: 1, marginLeft: 52, backgroundColor: c.line }}
              />
              <MenuRow
                icon="tool"
                label="Become an ANVIRA professional"
                onPress={() => go("/partner")}
              />
            </>
          )}
        </Card>
      </View>
      <Card>
        <T bold>Privacy & booking policy</T>
        <T size={12} color={c.muted}>
          {state?.mode === "demo"
            ? "This development preview uses sample accounts. Final policies require business approval before launch."
            : "Read the published service terms and privacy policy in Account settings."}
        </T>
      </Card>
      <Button
        label="Sign out"
        secondary
        onPress={() => {
          logout();
          router.replace("/");
        }}
      />
    </Shell>
  );
}
export function Support() {
  const tickets = usePagedRecords<Ticket>("tickets");
  const { bookingId, topic } = useLocalSearchParams<{
    bookingId?: string;
    topic?: string;
  }>();
  const [category, setCategory] = useState(
    topic === "quality" ? "quality" : "general",
  );
  const { state, request, busy, lang, t: translate } = useApp(),
    [message, setMessage] = useState(""),
    [sent, setSent] = useState(false),
    [sendError, setSendError] = useState(""),
    [sendKey, setSendKey] = useState(
      () => "support-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
  async function submit() {
    setSendError("");
    setSent(false);
    if (message.trim().length < 2) {
      setSendError("Enter at least two characters to send a request.");
      return;
    }
    try {
      await request("/tickets", {
        message,
        idempotencyKey: sendKey,
        category,
        ...(bookingId ? { bookingId } : {}),
      });
      setMessage("");
      setSent(true);
      setSendKey(
        "support-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      );
    } catch (e) {
      setSendError((e as Error).message);
    }
  }
  return (
    <Shell title="Support" back>
      <SectionHeading
        title="How can we help?"
        detail="Tell us what you need. Find your replies here."
      />
      {state?.user.role === "customer" ||
      state?.user.role === "professional" ? (
        <Card>
          {!!bookingId && (
            <T bold>{"Booking #" + bookingId.slice(0, 8).toUpperCase()}</T>
          )}
          <T bold>What do you need help with?</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["general", "General"],
              ["quality", "Service quality"],
              ["schedule", "Schedule"],
              ["payment", "Payment"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={translate(label)}
                accessibilityState={{ checked: category === value }}
                onPress={() => setCategory(value)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: category === value ? c.green : c.soft,
                  borderWidth: 1,
                  borderColor: category === value ? c.green : c.line,
                }}
              >
                <T
                  size={12}
                  bold
                  color={category === value ? c.white : c.muted}
                >
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          <Input
            label="Describe your issue"
            placeholder="Tell us what happened"
            value={message}
            onChangeText={(v) => {
              setMessage(v);
              setSent(false);
            }}
            multiline
            style={{ minHeight: 130 }}
          />
          <Button
            label="Send request"
            disabled={busy}
            loading={busy}
            onPress={() => void submit()}
          />
          {!!sendError && (
            <T accessibilityRole="alert" color={c.red}>
              {sendError}
            </T>
          )}
          {sent && <Badge label="Request sent" />}
        </Card>
      ) : (
        <T color={c.muted}>
          Customer requests appear in the operations support workspace.
        </T>
      )}
      <SectionHeading title="Your requests" />
      <PageControls list={tickets} label="support" />
      {!tickets.busy && !tickets.error && !tickets.rows.length && (
        <Empty
          title="No support requests yet"
          detail="Your conversations and follow-ups will appear here."
        />
      )}
      {tickets.rows.map((t) => (
        <Card key={t.id}>
          <Badge label={t.status} />
          {!!(t.status === "open" && t.responseDueAt) && (
            <T size={12} color={c.muted}>
              {translate("Response target:") +
                " " +
                dateLabel(t.responseDueAt, lang) +
                ". " +
                translate(
                  "This is a support target, not a guaranteed resolution time.",
                )}
            </T>
          )}
          <T>{t.message}</T>
          {!!t.bookingId && (
            <Button
              label={"View booking #" + t.bookingId.slice(0, 8).toUpperCase()}
              secondary
              onPress={() => go("/booking/" + t.bookingId)}
            />
          )}
          <SupportReply ticket={t} />
          <T size={11} color={c.muted}>
            {dateLabel(t.createdAt, lang)}
          </T>
        </Card>
      ))}
    </Shell>
  );
}
export function Notifications() {
  return <NotificationCenter />;
}
