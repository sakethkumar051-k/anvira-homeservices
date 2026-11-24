import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import type { PromotionalBanner, Service } from "../lib/model";
import { API_BASE } from "../lib/runtime";
import { ServicePhoto } from "./ServicePhoto";
import { Row, T, c } from "./ui";

export function PromotionalCarousel({
  banners,
  services,
  onOpen,
}: {
  banners?: PromotionalBanner[];
  services?: Service[];
  onOpen?: (service: Service) => void;
}) {
  const { state } = useApp();
  const all = banners ?? state?.banners;
  const catalog = services ?? state?.services;
  const [today, setToday] = useState(() => indiaDate());
  const [width, setWidth] = useState(0);
  const [page, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const focused = useIsFocused();
  const slidePosition = useRef(0);
  const updateIndex = (next: number) => {
    slidePosition.current = next;
    setIndex(next);
  };
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    let current = true;
    const updateDay = () => setToday(indiaDate());
    const timer = setInterval(updateDay, 30000);
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (value) => {
      setForeground(value === "active");
      updateDay();
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (current) setReduced(v);
      })
      .catch(() => {});
    return () => {
      current = false;
      clearInterval(timer);
      motion?.remove();
      app.remove();
    };
  }, []);
  const cards = (all || [])
    .flatMap((b) => {
      const service = catalog?.find((s) => s.id === b.serviceId && s.active);
      return service &&
        b.active &&
        (!b.startsOn || b.startsOn <= today) &&
        (!b.endsOn || today <= b.endsOn)
        ? [{ b, service }]
        : [];
    })
    .sort((a, b) => a.b.order - b.b.order || a.b.id.localeCompare(b.b.id));
  const length = cards.length;
  const index = Math.min(page, Math.max(0, length - 1));
  const identity = cards.map(({ b }) => b.id).join("|");
  useEffect(() => {
    const visibleIndex = Math.min(
      slidePosition.current,
      Math.max(0, length - 1),
    );
    scroller.current?.scrollTo({ x: visibleIndex * width, animated: false });
  }, [width, identity, length]);
  useEffect(() => {
    if (length < 2 || !width || paused || reduced || !focused || !foreground)
      return;
    const timer = setTimeout(() => {
      const next = (index + 1) % length;
      scroller.current?.scrollTo({ x: next * width, animated: true });
      updateIndex(next);
    }, 7000);
    return () => clearTimeout(timer);
  }, [length, width, paused, reduced, focused, foreground, index]);
  if (!length) return null;
  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: 4 }}
    >
      {width > 0 && (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setPaused(true)}
          onMomentumScrollEnd={(e) =>
            updateIndex(
              Math.min(
                length - 1,
                Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width)),
              ),
            )
          }
        >
          {cards.map(({ b, service }) => (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={b.title + ". View " + service.name}
              onPress={() =>
                onOpen
                  ? onOpen(service)
                  : router.push(("/service/" + service.id) as never)
              }
              style={{
                width,
                flexDirection: "row",
                backgroundColor: c.forest,
                overflow: "hidden",
                borderRadius: 18,
                minHeight: Math.min(230, Math.max(160, width * 0.44)),
              }}
            >
              <View
                style={{
                  flex: 1,
                  padding: 18,
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <T size={21} bold color="white">
                  {b.title}
                </T>
                {!!b.subtitle && (
                  <T size={13} color="#e3f0e7">
                    {b.subtitle}
                  </T>
                )}
                <T size={13} bold color="white">
                  View service →
                </T>
              </View>
              {b.hasPhoto ? (
                <Image
                  source={{
                    uri:
                      API_BASE +
                      "/api/banners/" +
                      b.id +
                      "/photo?v=" +
                      b.revision,
                  }}
                  style={{ width: "37%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <ServicePhoto
                  service={service}
                  style={{ width: "37%", height: "100%" }}
                />
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
      {length > 1 && (
        <Row style={{ justifyContent: "center", flexWrap: "wrap" }}>
          {cards.map(({ b }, i) => (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={"Show " + b.title}
              aria-pressed={i === index}
              onPress={() => {
                setPaused(true);
                updateIndex(i);
                scroller.current?.scrollTo({
                  x: i * width,
                  animated: !reduced,
                });
              }}
              style={{
                minWidth: 28,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: i === index ? 18 : 7,
                  height: 7,
                  borderRadius: 5,
                  backgroundColor: i === index ? c.green : c.line,
                }}
              />
            </Pressable>
          ))}
          {!reduced && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPaused((v) => !v)}
              style={{ padding: 10, minHeight: 44, justifyContent: "center" }}
            >
              <T size={12} color={c.green}>
                {paused ? "Play slideshow" : "Pause slideshow"}
              </T>
            </Pressable>
          )}
        </Row>
      )}
    </View>
  );
}
function indiaDate() {
  return new Date(Date.now() + 19800000).toISOString().slice(0, 10);
}
