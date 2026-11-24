import { Redirect } from "expo-router";
import { LIVE, WEBSITE_STAFF_ONLY } from "../lib/runtime";
import { useApp } from "../lib/context";
import DemoLogin from "../components/DemoLogin";
import SignIn from "../components/SignIn";
import GuestCatalog from "../components/GuestCatalog";

export default function Entry() {
  const { state, initializing } = useApp();
  if (WEBSITE_STAFF_ONLY) return <Redirect href="/welcome" />;
  if (!LIVE) return <DemoLogin />;
  if (initializing || state) return <SignIn />;
  return <GuestCatalog />;
}
