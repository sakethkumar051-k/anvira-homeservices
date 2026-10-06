import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Pressable,
  useWindowDimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Service, money } from "../lib/model";
import { T, c, Button, Icon, Card, Row } from "./ui";
type PublicInfo = {
  name: string;
  termsUrl: string;
  privacyUrl: string;
  supportPhone: string;
  policyPublished: boolean;
};
export default function Welcome() {
  const { read, state } = useApp(),
    { width } = useWindowDimensions();
  const wide = width >= 900;
  const [catalog, setCatalog] = useState<{
    services: Service[];
    pins: string[];
    mode: string;
  } | null>(null);
  const [company, setCompany] = useState<PublicInfo | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void Promise.all([
      read<typeof catalog>("/catalog"),
      read<PublicInfo>("/public"),
    ])
      .then(([s, p]) => {
        if (current) {
          setCatalog(s);
          setCompany(p);
        }
      })
      .catch(() => {
        if (current)
          setError(
            "Service availability could not load. Please try again shortly.",
          );
      });
    return () => {
      current = false;
    };
  }, [read]);
  const enter = () =>
    router.push(
      (state
        ? state.user.role === "customer"
          ? "/home"
          : state.user.role === "professional"
            ? "/jobs"
            : "/dashboard/home"
        : "/sign-in") as never,
    );
  const go = (path: string) => router.push(path as never);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        contentContainerStyle={{
          padding: wide ? 40 : 22,
          gap: 44,
          maxWidth: 1280,
          width: "100%",
          alignSelf: "center",
          paddingBottom: 50,
        }}
      >
        <Row
          style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}
        >
          <View>
            <T size={26} bold color={c.forest}>
              ANVIRA
            </T>
            <T size={9} style={{ letterSpacing: 3 }}>
              CARE FOR YOUR EVERYDAY
            </T>
          </View>
          <Row style={{ gap: 22 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explore services"
              onPress={() => go("/catalog")}
            >
              <T bold color={c.green}>
                Explore services
              </T>
            </Pressable>
            <Button
              label={state ? "Open my workspace" : "Sign in"}
              onPress={enter}
              secondary
            />
          </Row>
        </Row>
        {catalog?.mode === "demo" && (
          <Card style={{ backgroundColor: c.amberbg }}>
            <T bold color={c.amber}>
              Client preview · fictional services and prices
            </T>
            <T>
              Payments, reviews and people in this preview are samples. No real
              charges are collected.
            </T>
          </Card>
        )}
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: wide ? 54 : 30,
            alignItems: "stretch",
          }}
        >
          <View
            style={{
              flex: 1,
              gap: 24,
              justifyContent: "center",
              paddingVertical: wide ? 28 : 8,
            }}
          >
            <T size={11} bold color={c.green} style={{ letterSpacing: 3 }}>
              A LITTLE HELP. A BETTER DAY.
            </T>
            <T
              accessibilityRole="header"
              bold
              size={wide ? 62 : 42}
              color={c.forest}
              style={{ lineHeight: wide ? 72 : 50, letterSpacing: -2 }}
            >
              Your home deserves{wide ? "\n" : " "}a little more care.
            </T>
            <T size={18} color={c.muted}>
              From a fresh living room to a clean car, choose the service that
              fits your day. Review the work, the price and the available time
              before booking.
            </T>
            <Row style={{ flexWrap: "wrap", gap: 12 }}>
              <Button label="Find a service" onPress={() => go("/catalog")} />
              <Button
                label={
                  state ? "My bookings & workspace" : "Create your account"
                }
                secondary
                onPress={enter}
              />
            </Row>
            <T size={12} color={c.muted}>
              Explore first. Sign in when you’re ready to book.
            </T>
          </View>
          <View
            style={{
              flex: wide ? 0.8 : undefined,
              minHeight: 390,
              backgroundColor: c.forest,
              borderRadius: 32,
              padding: 30,
              overflow: "hidden",
              justifyContent: "space-between",
              gap: 36,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <T size={11} color={c.gold} style={{ letterSpacing: 2 }}>
                LIFE, MADE A LITTLE EASIER
              </T>
              <Icon name="spark" color={c.gold} size={26} />
            </Row>
            <View style={{ gap: 18 }}>
              <View
                style={{
                  borderRadius: 70,
                  width: 140,
                  height: 140,
                  backgroundColor: "#155947",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "center",
                }}
              >
                <Icon name="home" color={c.gold} size={76} />
              </View>
              <T size={30} bold color={c.white}>
                Less on your list.{"\n"}More time for you.
              </T>
              <T size={15} color="#CCE0D4">
                Thoughtful service options, useful preparation notes and a clear
                booking journey.
              </T>
            </View>
            <Row
              style={{
                borderTopWidth: 1,
                borderColor: "#326558",
                paddingTop: 20,
                justifyContent: "space-between",
              }}
            >
              <T size={12} color={c.white}>
                Choose your service
              </T>
              <T size={12} color={c.gold}>
                Plan your visit →
              </T>
            </Row>
          </View>
        </View>
        <View style={{ gap: 22 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <View>
              <T size={11} bold color={c.green} style={{ letterSpacing: 2 }}>
                MAKE ROOM FOR A BETTER EVERYDAY
              </T>
              <T size={32} bold>
                What can we help with?
              </T>
            </View>
            <Button
              label="See all services"
              onPress={() => go("/catalog")}
              secondary
            />
          </Row>
          {!!error && <T color={c.red}>{error}</T>}
          {catalog && !catalog.services.length && (
            <Card>
              <T bold>Our service catalog is being prepared.</T>
              <T>
                Prices and availability will appear here after the Owner reviews
                and publishes them.
              </T>
            </Card>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {catalog?.services.slice(0, 6).map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={"Explore " + s.name}
                onPress={() => go("/catalog")}
                style={{
                  width: wide ? "31.9%" : "100%",
                  backgroundColor: c.white,
                  borderRadius: 22,
                  padding: 24,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Icon name={s.icon} size={30} />
                  <T color={c.green}>↗</T>
                </Row>
                <T size={20} bold>
                  {s.name}
                </T>
                <T size={13} color={c.muted}>
                  {s.headline || s.description}
                </T>
                <T bold color={c.green}>
                  {"From " + money(s.price)}
                </T>
                <T size={11} color={c.muted}>
                  {s.category === "Repairs"
                    ? "Review diagnosis scope and repair exclusions"
                    : "Review packages, options and exclusions"}
                </T>
              </Pressable>
            ))}
          </View>
          {!!catalog?.pins.length && (
            <T size={12} color={c.muted}>
              {"Current service area PINs: " + catalog.pins.join(", ")}
            </T>
          )}
        </View>
        <View
          style={{
            backgroundColor: c.mint,
            borderRadius: 28,
            padding: wide ? 36 : 24,
            gap: 28,
          }}
        >
          <T size={30} bold>
            A clear plan, from start to finish.
          </T>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 28 }}>
            {[
              [
                "01",
                "Choose the right work",
                "See what’s included, what costs extra and what to prepare before the visit.",
              ],
              [
                "02",
                "Make the booking yours",
                "Select relevant options, add instructions and choose an available slot for your address.",
              ],
              [
                "03",
                "Stay in the conversation",
                "Track the booking, message the assigned professional and raise a linked support request when needed.",
              ],
            ].map(([n, title, body]) => (
              <View key={n} style={{ flex: 1, gap: 10 }}>
                <T size={13} bold color={c.green}>
                  {n}
                </T>
                <T bold size={19}>
                  {title}
                </T>
                <T color={c.muted}>{body}</T>
              </View>
            ))}
          </View>
        </View>
        <Row
          style={{
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 24,
            borderTopWidth: 1,
            borderColor: c.line,
            paddingTop: 26,
          }}
        >
          <View style={{ gap: 6 }}>
            <T bold size={20}>
              ANVIRA
            </T>
            <T size={12} color={c.muted}>
              Good care. Right at home.
            </T>
          </View>
          <Row style={{ flexWrap: "wrap", gap: 20 }}>
            {company?.policyPublished &&
              [
                ["Terms", company.termsUrl],
                ["Privacy", company.privacyUrl],
              ]
                .filter(([, url]) => !!url)
                .map(([label, url]) => (
                  <Pressable
                    key={label}
                    accessibilityRole="link"
                    onPress={() =>
                      void Linking.openURL(url).catch(() =>
                        setError("This link could not open."),
                      )
                    }
                  >
                    <T color={c.green}>{label}</T>
                  </Pressable>
                ))}
            {!!company?.supportPhone && (
              <T size={13}>{"Support: " + company.supportPhone}</T>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Professional and Owner sign in"
              onPress={enter}
            >
              <T color={c.green} bold>
                Professional & Owner sign in
              </T>
            </Pressable>
            {catalog?.mode === "demo" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Client walkthrough"
                onPress={() => go("/demo")}
              >
                <T bold color={c.green}>
                  Client walkthrough
                </T>
              </Pressable>
            )}
          </Row>
        </Row>
      </ScrollView>
    </SafeAreaView>
  );
}
