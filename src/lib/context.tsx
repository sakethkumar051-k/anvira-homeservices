import { clearDrafts } from "./drafts";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Platform } from "react-native";
import { AppState, Role } from "./model";
import translations from "./translations.json";
import {
  API_BASE as BASE,
  LIVE,
  WEBSITE_STAFF_ONLY,
  assertApiConfiguration,
} from "./runtime";
import { assertStaffWorkspace } from "./web-access";
import * as identity from "./auth";
const more: Record<string, string> = {
  "What can we help with?": "మేము ఎలా సహాయపడగలం?",
  "View all": "అన్నీ చూడండి",
  "Deep cleaning from": "పూర్తి శుభ్రత ప్రారంభ ధర",
  "Search for a service": "సేవను వెతకండి",
  "AC service": "ఏసీ సర్వీస్",
  Home: "హోమ్",
  Bookings: "బుకింగ్‌లు",
  Profile: "ప్రొఫైల్",
  "Search services": "సేవలను వెతకండి",
  "Choose a service": "సేవను ఎంచుకోండి",
  "Good care. Right at home.": "మంచి సంరక్షణ. మీ ఇంటి వద్దే.",
  "Services for your home": "మీ ఇంటి కోసం సేవలు",
  Continue: "కొనసాగించండి",
  "Continue to payment": "చెల్లింపుకు కొనసాగించండి",
  "Simulate payment": "చెల్లింపును పరీక్షించండి",
  "No real charge. Demo payment only.":
    "ఇది డెమో చెల్లింపు మాత్రమే. డబ్బు వసూలు చేయబడదు.",
  Support: "సహాయం",
  Language: "భాష",
  "Sign out": "సైన్ అవుట్",
  "Cancel booking": "బుకింగ్ రద్దు చేయండి",
  Reschedule: "సమయం మార్చండి",
  "Service total": "సేవ మొత్తం",
  "Your address": "మీ చిరునామా",
  "House / flat, street, landmark": "ఇంటి నంబర్, వీధి, గుర్తింపు స్థలం",
  "PIN code": "పిన్ కోడ్",
  "Choose your slot": "మీ సమయాన్ని ఎంచుకోండి",
  "Available time": "అందుబాటులో ఉన్న సమయం",
  "Add-ons": "అదనపు సేవలు",
  "Booking details": "బుకింగ్ వివరాలు",
  "Payment pending": "చెల్లింపు పెండింగ్‌లో ఉంది",
  "Professional assigned": "నిపుణుడు కేటాయించబడ్డారు",
  Confirmed: "నిర్ధారించబడింది",
  "In progress": "సేవ జరుగుతోంది",
  Completed: "పూర్తయింది",
  Cancelled: "రద్దయింది",
  "Finding your professional": "మీ నిపుణుడిని వెతుకుతున్నాం",
  "Refund requested": "రీఫండ్ అభ్యర్థించబడింది",
  "Refund complete": "రీఫండ్ పూర్తయింది",
  Back: "వెనుకకు",
  "Open booking": "బుకింగ్ తెరవండి",
  "No bookings yet": "ఇంకా బుకింగ్‌లు లేవు",
  "Book your first service": "మీ మొదటి సేవను బుక్ చేయండి",
  "Verified professionals": "ధృవీకరించబడిన నిపుణులు",
  "Send request": "అభ్యర్థన పంపండి",
  "How can we help?": "మేము ఎలా సహాయపడగలం?",
  "Describe your issue": "మీ సమస్యను వివరించండి",
  "Request sent": "అభ్యర్థన పంపబడింది",
  Notifications: "నోటిఫికేషన్‌లు",
  "All services": "అన్ని సేవలు",
  "Full refund requested": "పూర్తి రీఫండ్ అభ్యర్థించబడింది",
  "Rate your experience": "మీ అనుభవాన్ని రేట్ చేయండి",
  "Submit review": "సమీక్ష పంపండి",
  "Save new slot": "కొత్త సమయాన్ని సేవ్ చేయండి",
  Cleaning: "శుభ్రపరచడం",
  Plumbing: "ప్లంబింగ్",
  Electrical: "ఎలక్ట్రికల్",
  Painting: "పెయింటింగ్",
  More: "మరిన్ని",
  "Home deep cleaning": "ఇంటి పూర్తి శుభ్రత",
  "AC service & repair": "ఏసీ సర్వీస్ మరియు మరమ్మతు",
  "Plumbing repair": "ప్లంబింగ్ మరమ్మతు",
  "Electrical repair": "ఎలక్ట్రికల్ మరమ్మతు",
  "Painting consultation": "పెయింటింగ్ సలహా",
  "What’s included": "ఏమి చేర్చబడింది",
  "Professional inspection": "నిపుణుడి తనిఖీ",
  "Tools and standard supplies": "పనిముట్లు మరియు సాధారణ సామాగ్రి",
  "Post-service cleanup": "సేవ అనంతరం శుభ్రపరచడం",
  "Extra room / unit": "అదనపు గది / యూనిట్",
  "Your professional": "మీ నిపుణుడు",
  "Total paid": "చెల్లించిన మొత్తం",
  "Browse services": "సేవలను చూడండి",
  "Need a hand?": "సహాయం కావాలా?",
  "Address & schedule": "చిరునామా మరియు సమయం",
  "Booking summary": "బుకింగ్ సారాంశం",
  "Booking confirmed": "బుకింగ్ నిర్ధారించబడింది",
  "A fresh start for your home": "మీ ఇంటికి కొత్త ఆరంభం",
  "Deep cleaning from ₹1,499": "పూర్తి శుభ్రత ₹1,499 నుండి",
  "Shadnagar · Home": "షాద్‌నగర్ · ఇల్లు",
  "Care, without the worry": "నిశ్చింతగా ఇంటి సంరక్షణ",
  "Starting from": "ప్రారంభ ధర",
  "View services": "సేవలను చూడండి",
  Selected: "ఎంచుకోబడింది",
  Optional: "ఐచ్ఛికం",
  Service: "సేవ",
  Price: "ధర",
  Duration: "సమయం",
  Receipt: "రసీదు",
  Payment: "చెల్లింపు",
};
const dictionary: Record<string, string> = { ...translations, ...more };
type Ctx = {
  state: AppState | null;
  busy: boolean;
  initializing: boolean;
  error: string;
  lang: "en" | "te";
  setLang: (v: "en" | "te") => void;
  t: (s: string) => string;
  login: (role: Role, professionalId?: string) => Promise<void>;
  completeLogin: (idToken: string) => Promise<void>;
  switchWorkspace: (workspace: "customer" | "professional") => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  request: <T = unknown>(
    path: string,
    body?: unknown,
    method?: string,
  ) => Promise<T>;
  read: <T = unknown>(path: string) => Promise<T>;
  upload: <T = unknown>(path: string, body: FormData) => Promise<T>;
  download: (path: string) => Promise<Blob>;
  clearError: () => void;
};
const Context = createContext<Ctx>(null as unknown as Ctx);
function demoToken() {
  if (LIVE || Platform.OS !== "web" || typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem("anvira-demo-session") || "";
  } catch {
    return "";
  }
}
export function Provider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null),
    [busy, setBusy] = useState(false),
    [initializing, setInitializing] = useState(LIVE || !!demoToken()),
    [error, setError] = useState(""),
    [lang, updateLang] = useState<"en" | "te">(() => {
      try {
        return Platform.OS === "web" &&
          typeof window !== "undefined" &&
          localStorage.getItem("anvira-language") === "te"
          ? "te"
          : "en";
      } catch {
        return "en";
      }
    });
  const setLang = (language: "en" | "te") => {
    updateLang(language);
    if (Platform.OS === "web") {
      try {
        localStorage.setItem("anvira-language", language);
      } catch {}
    } else
      void SecureStore.setItemAsync("anvira-language", language).catch(
        () => {},
      );
  };
  useEffect(() => {
    if (Platform.OS !== "web")
      void SecureStore.getItemAsync("anvira-language")
        .then((value) => {
          if (value === "en" || value === "te") updateLang(value);
        })
        .catch(() => {});
  }, []);
  const workspaceRef = useRef("");
  const tokenRef = useRef(demoToken()),
    csrfRef = useRef(""),
    generation = useRef(0),
    active = useRef(false);
  const csrf = useCallback(async () => {
    const r = await fetch(BASE + "/api/csrf", { credentials: "include" });
    const data = await r.json();
    csrfRef.current = data.token;
    return data.token;
  }, []);
  const fetchApi = useCallback(
    async <T,>(
      path: string,
      body?: unknown,
      method?: string,
      override?: string,
      raw = false,
    ): Promise<T> => {
      assertApiConfiguration();
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 20000);
      const verb = method || (body ? "POST" : "GET");
      try {
        const bearer =
          override ??
          (LIVE
            ? Platform.OS === "web"
              ? ""
              : await identity.token()
            : tokenRef.current);
        if (LIVE && Platform.OS === "web" && verb !== "GET" && !csrfRef.current)
          await csrf();
        const send = () =>
          fetch(BASE + "/api" + path, {
            method: verb,
            credentials: LIVE && Platform.OS === "web" ? "include" : "omit",
            headers: {
              ...(body instanceof FormData
                ? {}
                : { "Content-Type": "application/json" }),
              ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
              ...(workspaceRef.current
                ? { "X-Anvira-Workspace": workspaceRef.current }
                : {}),
              ...(csrfRef.current ? { "X-CSRF-Token": csrfRef.current } : {}),
            },
            body:
              body instanceof FormData
                ? body
                : body !== undefined
                  ? JSON.stringify(body)
                  : undefined,
            signal: controller.signal,
          });
        let response = await send();
        if (response.status === 403 && LIVE && Platform.OS === "web") {
          const clone = await response.clone().json();
          if (clone.code === "CSRF_FAILED") {
            await csrf();
            response = await send();
          }
        }
        if (raw && response.ok) return (await response.blob()) as T;
        const data = await response.json();
        if (!response.ok) {
          if (["AUTH_REQUIRED", "ACCOUNT_DISABLED"].includes(data.code)) {
            active.current = false;
            setState(null);
          }
          throw Object.assign(new Error(data.error || "Request failed."), {
            code: data.code,
          });
        }
        if (path === "/state")
          assertStaffWorkspace(data.user?.role, WEBSITE_STAFF_ONLY);
        return data;
      } catch (e) {
        throw Object.assign(
          new Error(
            e instanceof Error && e.name === "AbortError"
              ? "The server took too long. Please retry."
              : e instanceof TypeError
                ? "Cannot reach ANVIRA. Check the API server and network."
                : e instanceof Error
                  ? e.message
                  : "Request failed.",
          ),
          { code: (e as { code?: string }).code },
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    [csrf],
  );
  const refresh = useCallback(async () => {
    if (!active.current) return;
    const seq = ++generation.current;
    try {
      const data = await fetchApi<AppState>("/state");
      if (seq === generation.current) setState(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [fetchApi]);
  useEffect(() => {
    if (!LIVE) {
      if (!tokenRef.current) return;
      let cancelled = false;
      void fetchApi<AppState>("/state")
        .then((data) => {
          if (!cancelled) {
            active.current = true;
            setState(data);
          }
        })
        .catch(() => {
          tokenRef.current = "";
          try {
            if (Platform.OS === "web")
              sessionStorage.removeItem("anvira-demo-session");
          } catch {}
        })
        .finally(() => {
          if (!cancelled) setInitializing(false);
        });
      return () => {
        cancelled = true;
      };
    }
    let unsubscribe: (() => void) | undefined,
      cancelled = false;
    async function restore() {
      try {
        if (Platform.OS === "web") {
          const data = await fetchApi<AppState>("/state");
          if (!cancelled) {
            active.current = true;
            setState(data);
          }
        } else
          unsubscribe = await identity.subscribeAuth((signedIn) => {
            if (signedIn) {
              active.current = true;
              void refresh();
            } else {
              active.current = false;
              setState(null);
            }
            setInitializing(false);
          });
      } catch (e) {
        if ((e as { code?: string }).code !== "AUTH_REQUIRED")
          setError((e as Error).message);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [fetchApi, refresh]);
  const read = useCallback(<T,>(path: string) => fetchApi<T>(path), [fetchApi]);
  const request = async <T,>(path: string, body?: unknown, method?: string) => {
    setBusy(true);
    setError("");
    try {
      const value = await fetchApi<T>(path, body, method);
      await refresh();
      return value;
    } catch (e) {
      if ((e as { code?: string }).code === "STAFF_ONLY") {
        active.current = false;
        setState(null);
        await fetchApi("/logout", {}, "POST").catch(() => {});
        await identity.logoutAuth().catch(() => {});
      }
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const completeLogin = async (idToken: string) => {
    setBusy(true);
    setError("");
    try {
      if (Platform.OS === "web") {
        await csrf();
        await fetchApi("/session", { idToken }, "POST");
      }
      const data = await fetchApi<AppState>(
        "/state",
        undefined,
        "GET",
        Platform.OS === "web" ? undefined : idToken,
      );
      active.current = true;
      setState(data);
    } catch (e) {
      if ((e as { code?: string }).code === "STAFF_ONLY") {
        active.current = false;
        setState(null);
        await fetchApi("/logout", {}, "POST").catch(() => {});
        await identity.logoutAuth().catch(() => {});
      }
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const login = async (role: Role, professionalId?: string) => {
    if (LIVE) return;
    setBusy(true);
    setError("");
    try {
      const session = await fetchApi<{ token: string }>("/session", {
        role,
        ...(professionalId ? { professionalId } : {}),
      });
      tokenRef.current = session.token;
      try {
        if (Platform.OS === "web")
          sessionStorage.setItem("anvira-demo-session", session.token);
      } catch {}
      active.current = true;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const switchWorkspace = async (workspace: "customer" | "professional") => {
    setBusy(true);
    setError("");
    const previous = workspaceRef.current;
    try {
      workspaceRef.current = workspace;
      const data = await fetchApi<AppState>("/state");
      if (data.user.role !== workspace)
        throw new Error("This workspace is not available for your account.");
      generation.current++;
      setState(data);
    } catch (e) {
      workspaceRef.current = previous;
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const logout = () => {
    void clearDrafts().catch(() => {});
    try {
      if (!LIVE && Platform.OS === "web")
        sessionStorage.removeItem("anvira-demo-session");
    } catch {}
    setBusy(true);
    setInitializing(true);
    active.current = false;
    generation.current++;
    void (async () => {
      try {
        const deviceId =
          Platform.OS === "web"
            ? undefined
            : await SecureStore.getItemAsync("anvira-device");
        await fetchApi("/logout", { deviceId });
      } catch {
      } finally {
        if (LIVE) await identity.logoutAuth().catch(() => {});
        if (Platform.OS !== "web")
          await SecureStore.deleteItemAsync("anvira-device").catch(() => {});
        tokenRef.current = "";
        setBusy(false);
        setInitializing(false);
      }
    })();
    workspaceRef.current = "";
    setState(null);
    setError("");
  };
  const upload = async <T,>(path: string, body: FormData) => {
    setBusy(true);
    setError("");
    try {
      const result = await fetchApi<T>(path, body);
      await refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      key={state?.user.id || "signed-out"}
      value={{
        state,
        busy,
        initializing,
        error,
        lang,
        setLang,
        t: (s) => {
          if (lang !== "te") return s;
          const normalized = s.replace(/\s+/g, " ").trim();
          const service = state?.services.find(
            (x) =>
              x.name === normalized ||
              x.description === normalized ||
              x.headline === normalized,
          );
          if (service) {
            if (service.name === normalized && service.nameTe)
              return service.nameTe;
            if (service.description === normalized && service.descriptionTe)
              return service.descriptionTe;
          }
          return dictionary[s] || dictionary[normalized] || s;
        },
        login,
        completeLogin,
        switchWorkspace,
        logout,
        refresh,
        request,
        read,
        upload,
        download: (path) => fetchApi(path, undefined, "GET", undefined, true),
        clearError: () => setError(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
