import { LIVE, WEBSITE_STAFF_ONLY } from "../lib/runtime";
import { Redirect } from "expo-router";
import SignIn from "../components/SignIn";
import DemoLogin from "../components/DemoLogin";
export default function Entry() {
  return WEBSITE_STAFF_ONLY ? (
    <Redirect href="/welcome" />
  ) : LIVE ? (
    <SignIn />
  ) : (
    <DemoLogin />
  );
}
