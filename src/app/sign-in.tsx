import { LIVE, WEBSITE_STAFF_ONLY } from "../lib/runtime";
import StaffPortal from "../components/StaffPortal";
import SignIn from "../components/SignIn";
import DemoLogin from "../components/DemoLogin";
export default function Entry() {
  return WEBSITE_STAFF_ONLY ? (
    <StaffPortal />
  ) : LIVE ? (
    <SignIn />
  ) : (
    <DemoLogin />
  );
}
