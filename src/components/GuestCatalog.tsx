import { useEffect, useState } from "react";
import { ScrollView, View, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Service, money } from "../lib/model";
import { Button, Card, T, Badge, c, Input, Row, Icon } from "./ui";
import { ServiceCare } from "./ServiceCustomization";
export default function GuestCatalog() {
  const { read, state } = useApp();
  const website = Platform.OS === "web",
    wide = useWindowDimensions().width >= 900;
  const [data, setData] = useState<{
      services: Service[];
      pins: string[];
      mode: string;
    } | null>(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState("");
  const load = () => {
    setError("");
    void read<typeof data>("/catalog")
      .then(setData)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    let current = true;
    void read<typeof data>("/catalog")
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [read]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 18,
          maxWidth: website ? 1440 : 620,
          width: "100%",
          alignSelf: "center",
          paddingBottom: 50,
        }}
      >
        <Row>
          <Icon name="spark" />
          <T size={24} bold color={c.green}>
            ANVIRA
          </T>
        </Row>
        <T size={30} bold>
          Find the right care.
        </T>
        <T color={c.muted}>
          {website
            ? "Explore service scope, packages, prices and preparation guidance."
            : "Browse the scope and price before signing in. Availability depends on your address and service slot."}
        </T>
        {data?.mode === "demo" && (
          <Badge label="Sample catalog · fictional prices" />
        )}
        <Button
          label={
            website
              ? "Back to website"
              : state
                ? "Back to your app"
                : "Sign in to book"
          }
          onPress={() =>
            router.push((website ? "/welcome" : state ? "/home" : "/") as never)
          }
        />
        <Input
          label="Search services"
          placeholder="Car, bathroom, AC…"
          value={search}
          onChangeText={setSearch}
        />
        {error ? (
          <Card>
            <T color={c.red}>{error}</T>
            <Button label="Retry catalog" secondary onPress={load} />
          </Card>
        ) : !data ? (
          <T>Loading services…</T>
        ) : (
          <>
            <T size={12} color={c.muted}>
              {"Service area PINs: " + data.pins.join(", ")}
            </T>
            {!data.services.length && (
              <T>Services are being prepared. Please check back soon.</T>
            )}
            <View
              style={{
                flexDirection: wide ? "row" : "column",
                flexWrap: "wrap",
                gap: 20,
              }}
            >
              {data.services
                .filter((s) =>
                  (s.name + s.category + s.description)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((s) => (
                  <Card
                    key={s.id}
                    style={{
                      width: wide && selected !== s.id ? "31.8%" : "100%",
                    }}
                  >
                    <Row>
                      <Icon name={s.icon} />
                      <View style={{ flex: 1 }}>
                        <T bold size={19}>
                          {s.name}
                        </T>
                        <T color={c.green} bold>
                          {money(s.price) + " · " + s.duration + " min"}
                        </T>
                      </View>
                    </Row>
                    <T>{s.description}</T>
                    <Button
                      label={
                        selected === s.id ? "Hide details" : "View " + s.name
                      }
                      secondary
                      onPress={() => setSelected(selected === s.id ? "" : s.id)}
                    />
                    {selected === s.id && (
                      <>
                        <T bold>Included</T>
                        {s.includes.map((x) => (
                          <T key={x}>{"• " + x}</T>
                        ))}
                        <T bold>Not included</T>
                        {s.excludes?.map((x) => (
                          <T key={x}>{"• " + x}</T>
                        ))}
                        {s.packages?.map((p) => (
                          <T key={p.id}>
                            {p.name +
                              " · " +
                              money(p.price) +
                              " · " +
                              p.description}
                          </T>
                        ))}
                        <ServiceCare service={s} />
                        {!website && (
                          <Button
                            label={
                              state
                                ? "Customize this service"
                                : "Sign in to customize"
                            }
                            onPress={() =>
                              router.push(
                                (state ? "/checkout/" + s.id : "/") as never,
                              )
                            }
                          />
                        )}
                      </>
                    )}
                  </Card>
                ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
