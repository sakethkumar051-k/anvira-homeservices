import { View, useWindowDimensions, Platform } from "react-native";
import { router } from "expo-router";
import { LIVE } from "../lib/runtime";
import SignIn from "./SignIn";
import DemoLogin from "./DemoLogin";
import { T, c, Button } from "./ui";

export default function StaffPortal() {
  const wide = useWindowDimensions().width >= 900;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: wide ? "row" : "column",
        backgroundColor: c.ivory,
      }}
    >
      <View
        style={{
          flex: wide ? 1 : undefined,
          backgroundColor: c.forest,
          padding: wide ? 64 : 24,
          gap: 24,
          justifyContent: "center",
        }}
      >
        <T color={c.gold} bold size={16}>
          ANVIRA · STAFF PORTAL
        </T>
        <T color={c.white} bold size={wide ? 54 : 28}>
          A better day starts with your team.
        </T>
        {wide && (
          <T color="#CCE0D4" size={18}>
            Admin / Owner and Customer Associate access. Manage orders, dispatch
            your internal team and care for customers.
          </T>
        )}
        <Button
          label={Platform.OS === "web" ? "Back to website" : "Back to app"}
          secondary
          onPress={() => router.replace("/welcome")}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {LIVE ? <SignIn staffOnly /> : <DemoLogin staffOnly />}
      </View>
    </View>
  );
}
