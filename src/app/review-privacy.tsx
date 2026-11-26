import ReviewPolicies from "../components/ReviewPolicies";
import LegalPolicy from "../components/LegalPolicy";
import { LIVE } from "../lib/runtime";
export default function ReviewPrivacy() {
  // Live builds always show the production policy, even from older links.
  return LIVE ? (
    <LegalPolicy kind="privacy" />
  ) : (
    <ReviewPolicies kind="privacy" />
  );
}
