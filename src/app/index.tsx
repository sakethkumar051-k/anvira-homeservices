import { LIVE } from "../lib/runtime";
import SignIn from "../components/SignIn";
import DemoLogin from "../components/DemoLogin";
export default function Entry() {
  return LIVE ? <SignIn /> : <DemoLogin />;
}
