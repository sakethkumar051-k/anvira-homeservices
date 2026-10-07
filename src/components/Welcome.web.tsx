import { useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useApp } from "../lib/context";
import { marketingServices, MarketingService } from "../lib/marketing";
import { marketingCSS } from "./marketing-styles";

type PublicInfo = {
  supportPhone: string;
  termsUrl: string;
  privacyUrl: string;
  policyPublished: boolean;
};
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.87 11.87 0 0 0 12.04 0C5.47 0 .12 5.35.12 11.92c0 2.1.55 4.16 1.6 5.97L0 24l6.27-1.64a11.9 11.9 0 0 0 5.77 1.47h.01c6.57 0 11.92-5.35 11.92-11.92 0-3.18-1.24-6.17-3.45-8.43ZM12.04 21.8a9.85 9.85 0 0 1-5.02-1.37l-.36-.21-3.72.97.99-3.63-.24-.37a9.83 9.83 0 0 1-1.5-5.27c0-5.46 4.44-9.9 9.9-9.9a9.84 9.84 0 0 1 7 2.9 9.83 9.83 0 0 1 2.9 7c0 5.45-4.45 9.88-9.95 9.88Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.66.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.37-1.46-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.66-.5h-.56c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.19 5.06 4.47.71.31 1.26.5 1.69.64.71.22 1.36.19 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}
const Arrow = () => (
  <span className="arrow" aria-hidden="true">
    ↗
  </span>
);
const photo = (name: string) => `/images/${name}.jpg`;
function ServiceDialog({
  service,
  close,
  enquire,
  te,
}: {
  service: MarketingService;
  close: () => void;
  enquire: () => void;
  te: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const card = ref.current;
    card?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const controls =
          card?.querySelectorAll<HTMLButtonElement>("button, a[href]");
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [close]);
  return (
    <motion.div
      className="service-dialog"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.div
        ref={ref}
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-dialog-title"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
      >
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Close service details"
        >
          ×
        </button>
        <img
          src={photo(service.image)}
          alt={service.name}
          width="570"
          height="230"
        />
        <div className="dialog-body">
          <div className="eyebrow">{service.category}</div>
          <h2 id="service-dialog-title" style={{ fontSize: 38 }}>
            {te ? service.te : service.name}
          </h2>
          <p>{service.detail}</p>
          <span className="pill">{service.price}</span>
          <p style={{ fontSize: 12 }}>
            We’ll confirm availability, service scope and the final quote with
            you before arranging the work.
          </p>
          <button className="button" onClick={enquire}>
            {te ? "వివరాలు అడగండి" : "Enquire about this service"}
            <Arrow />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
export default function Welcome() {
  const { read, lang, setLang } = useApp();
  const te = lang === "te";
  const t = (en: string, telugu: string) => (te ? telugu : en);
  const pageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress, scrollY } = useScroll({ container: pageRef });
  const imageY = useTransform(scrollY, [0, 700], [0, 90]);
  const [company, setCompany] = useState<PublicInfo | null>(null);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState("All services");
  const [selected, setSelected] = useState<MarketingService | null>(null);
  const [service, setService] = useState("car");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    let active = true;
    void read<PublicInfo>("/public")
      .then((p) => {
        if (active) setCompany(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [read]);
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    },
    [],
  );
  const phone = (
    company?.supportPhone ||
    process.env.EXPO_PUBLIC_WHATSAPP_NUMBER ||
    "917989365699"
  ).replace(/\D/g, "");
  const whatsapp =
    phone.length >= 10 && phone.length <= 15
      ? phone.length === 10
        ? "91" + phone
        : phone
      : "";
  const reveal = {
    initial: { opacity: 0, y: reduced ? 0 : 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: reduced ? 0 : 0.7 },
  };
  function pick(id: string) {
    setService(id);
    setMenu(false);
    document
      .getElementById("contact")
      ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
  }
  function listen() {
    if (!("speechSynthesis" in window)) {
      setStatus("Voice playback is not available in this browser.");
      document.getElementById("contact")?.scrollIntoView();
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      t(
        "Welcome to Anvira Services. Doorstep car cleaning starts from five hundred rupees per month. We also offer laundry and dry cleaning with pickup and delivery, home and commercial cleaning, AC service, plumbing, electrical services, makeup, beauty and sofa cleaning. Contact our team to confirm your plan and availability.",
        "అన్విరా సర్వీసెస్ కు స్వాగతం. మీ ఇంటి వద్ద కార్ క్లీనింగ్ నెలకు ఐదు వందల రూపాయల నుండి. లాండ్రీ పికప్ మరియు డెలివరీ, ఇంటి క్లీనింగ్, ఏసీ, ప్లంబింగ్ మరియు ఇతర సర్వీసుల కోసం మమ్మల్ని సంప్రదించండి.",
      ),
    );
    utterance.lang = te ? "te-IN" : "en-IN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || area.trim().length < 2) {
      setStatus("Please enter your name and locality or PIN code.");
      return;
    }
    const chosen = marketingServices.find((s) => s.id === service)!;
    const message = `Hello ANVIRA! My name is ${name.trim()}. I’m interested in ${chosen.name}. My area: ${area.trim()}. ${notes.trim()} Please confirm the service scope, price and availability.`;
    if (whatsapp) {
      window.open(
        `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setStatus(
        "Your enquiry is ready in WhatsApp. Send it there to reach our team.",
      );
    } else {
      window.location.href = `mailto:anviraservicesllp@gmail.com?subject=${encodeURIComponent("Service enquiry: " + chosen.name)}&body=${encodeURIComponent(message)}`;
      setStatus(
        "Your email draft is ready. Send it from your email app. You can also email anviraservicesllp@gmail.com.",
      );
    }
  }
  async function toggleVideo() {
    if (!videoStarted) {
      setVideoStarted(true);
      setVideoPlaying(true);
      return;
    }
    if (videoPlaying) {
      videoRef.current?.pause();
      setVideoPlaying(false);
    } else {
      try {
        await videoRef.current?.play();
        setVideoPlaying(true);
      } catch {
        setVideoPlaying(false);
      }
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="anvira-site" ref={pageRef} lang={te ? "te" : "en"}>
        <style>{marketingCSS}</style>
        <a className="skip-link" href="#services">
          Skip to services
        </a>
        <div className="topline">
          {t(
            "Doorstep car care from ₹500/month",
            "ఇంటి వద్ద కార్ క్లీనింగ్ నెలకు ₹500 నుండి",
          )}
          <span>✦</span>
          {t("Laundry pickup. Fresh delivery.", "లాండ్రీ పికప్ & డెలివరీ")}
        </div>
        <header className="site-nav">
          <div className="wrap nav-inner">
            <a href="#top" aria-label="ANVIRA Services home">
              <img
                className="brand-image"
                src="/brand/anvira-logo.png"
                alt="ANVIRA Services"
                width="133"
                height="79"
              />
            </a>
            <nav
              aria-label="Main navigation"
              className={`nav-links ${menu ? "menu-open" : ""}`}
            >
              <a href="#services" onClick={() => setMenu(false)}>
                {t("Our services", "మా సర్వీసులు")}
              </a>
              <a href="#car-care" onClick={() => setMenu(false)}>
                {t("Car care", "కార్ క్లీనింగ్")}
              </a>
              <a href="#laundry" onClick={() => setMenu(false)}>
                {t("Laundry pickup", "లాండ్రీ పికప్")}
              </a>
              <button
                className="lang-button"
                onClick={() => setLang(te ? "en" : "te")}
                aria-label="Change language"
              >
                {te ? "English" : "తెలుగు"}
              </button>
              <a
                className="button"
                href="#contact"
                onClick={() => setMenu(false)}
              >
                {t("Let’s talk", "సంప్రదించండి")}
                <Arrow />
              </a>
              <Link className="staff-link" href="/staff">
                Staff portal
              </Link>
            </nav>
            <button
              className="mobile-menu"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? "×" : "☰"}
            </button>
          </div>
          <motion.div
            className="progress"
            style={{ scaleX: scrollYProgress }}
          />
        </header>
        <main id="top">
          <div className="wrap">
            <section className="hero" aria-labelledby="hero-title">
              <motion.div
                className="hero-copy"
                initial={{ opacity: 0, y: reduced ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="eyebrow">
                  <span className="dot" />
                  {t("YOUR TRUSTED HOME PARTNER", "మీ ఇంటికి నమ్మకమైన తోడు")}
                </div>
                <h1 id="hero-title">
                  {t("Good care.", "మంచి సంరక్షణ.")}
                  <br />
                  <em>{t("Right at home.", "మీ ఇంటి వద్దే.")}</em>
                </h1>
                <p>
                  {t(
                    "A sparkling car. A fresh home. Laundry that comes back to you. Make room for the things you love — we’ll help with the everyday.",
                    "క్లీన్ కార్, శుభ్రమైన ఇల్లు, మీ ఇంటికే వచ్చే లాండ్రీ. మీ పనులు సులభంగా — మీకు ఇష్టమైన వాటికి మరింత సమయం.",
                  )}
                </p>
                <div className="hero-actions">
                  <a className="button" href="#services">
                    {t("Explore our services", "సర్వీసులు చూడండి")}
                    <Arrow />
                  </a>
                  <button
                    className="button outline"
                    onClick={() => pick("car")}
                  >
                    {t("Car care from ₹500/month", "₹500 నుండి కార్ క్లీనింగ్")}
                    <Arrow />
                  </button>
                </div>
                <div className="hero-footnote">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    aria-hidden="true"
                  >
                    <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z" />
                    <path d="m8 12 3 3 5-6" />
                  </svg>
                  {t(
                    "Your place. Your schedule. Clear details before the visit.",
                    "మీ ఇంట్లో. మీకు అనుకూలమైన సమయంలో.",
                  )}
                </div>
              </motion.div>
              <motion.div
                className="hero-visual"
                initial={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.15 }}
              >
                <div className="hero-photo">
                  <motion.img
                    src={photo("car")}
                    alt="Car being foam-cleaned on a residential driveway"
                    fetchPriority="high"
                    width="700"
                    height="800"
                    style={{ y: reduced ? 0 : imageY }}
                  />
                  <span className="photo-caption">
                    {t("The car wash comes to you", "కార్ వాష్ మీ ఇంటి వద్దే")}
                  </span>
                </div>
                <motion.div
                  className="price-sticker"
                  animate={reduced ? {} : { y: [0, -7, 0] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <span>
                    {t("Monthly car care from", "నెలవారీ కార్ క్లీనింగ్")}
                  </span>
                  <strong>
                    ₹500<small> / {t("month", "నెల")}</small>
                  </strong>
                  <span>{t("At your doorstep", "మీ ఇంటి వద్దే")}</span>
                </motion.div>
                <div className="orbit-badge">
                  <span>LESS TO DO</span>
                  <b>More</b>
                  <span>TIME FOR YOU</span>
                </div>
              </motion.div>
            </section>
            <div className="announcement">
              <span>
                {t(
                  "A little everyday help, now closer to home. Explore what ANVIRA can do for you.",
                  "మీ రోజువారీ పనుల్లో తోడు. అన్విరా సర్వీసులు చూడండి.",
                )}
              </span>
              <button
                className="listen-button"
                onClick={listen}
                aria-pressed={speaking}
              >
                <span aria-hidden="true">{speaking ? "■" : "◖))"}</span>
                {speaking
                  ? t("Stop announcement", "ఆపండి")
                  : t("Listen to our services", "సర్వీసులు వినండి")}
              </button>
            </div>
          </div>
          <div className="service-ribbon" aria-hidden="true">
            <div className="ribbon-track">
              {[0, 1].map((n) => (
                <span key={n}>
                  {[
                    "Car care at home",
                    "Laundry pickup & delivery",
                    "Home & commercial cleaning",
                    "AC, plumbing & electrical",
                    "Makeup & beauty",
                    "Sofa cleaning",
                  ].map((s) => (
                    <span key={s}>
                      {s}
                      <i>✦</i>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <section id="services" className="wrap section-space">
            <motion.div {...reveal} className="section-head">
              <div>
                <div className="eyebrow">
                  {t(
                    "ONE HOME. SO MANY WAYS TO CARE.",
                    "మీ అవసరాలకు ఎన్నో సర్వీసులు",
                  )}
                </div>
                <h2>
                  {t("What can we", "మీకు ఏ పని")}
                  <br />
                  <em>{t("take off your list?", "సులభం చేయగలం?")}</em>
                </h2>
              </div>
              <p>
                {t(
                  "From a one-time fix to a little regular help. Simple services for your home, your workplace and yourself.",
                  "ఇంటికి, ఆఫీసుకు, మీ కోసం — అవసరమైన సర్వీసులు ఒకే చోట.",
                )}
              </p>
            </motion.div>
            <div className="filters" role="group" aria-label="Filter services">
              {[
                "All services",
                "Everyday",
                "Cleaning",
                "Repairs",
                "Personal care",
              ].map((f) => (
                <button
                  key={f}
                  className={`filter ${filter === f ? "active" : ""}`}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <motion.div className="service-grid" layout>
              <AnimatePresence mode="popLayout">
                {marketingServices
                  .filter(
                    (s) => filter === "All services" || s.category === filter,
                  )
                  .map((s, i) => (
                    <motion.button
                      layout
                      className="service-card"
                      key={s.id}
                      {...reveal}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5, delay: (i % 3) * 0.07 }}
                      aria-label={`Explore ${s.name}`}
                      onClick={() => setSelected(s)}
                    >
                      <div className="service-image">
                        <img
                          src={photo(s.image)}
                          alt={s.name}
                          loading="lazy"
                          width="440"
                          height="260"
                        />
                        {(s.id === "car" || s.id === "laundry") && (
                          <span className="service-tag">
                            {s.id === "car"
                              ? "MONTHLY CARE"
                              : "PICKUP & DELIVERY"}
                          </span>
                        )}
                      </div>
                      <div className="service-copy">
                        <h3>{te ? s.te : s.name}</h3>
                        <p>{s.description}</p>
                        <div className="service-bottom">
                          <span>{s.price}</span>
                          <Arrow />
                        </div>
                      </div>
                    </motion.button>
                  ))}
              </AnimatePresence>
            </motion.div>
            <p className="more-services">
              {t(
                "Something else on your list? Tell us what you need. We’ll check how we can help.",
                "ఇంకేదైనా పని ఉందా? మాకు చెప్పండి.",
              )}{" "}
              <a
                href="#contact"
                style={{ textDecoration: "underline", color: "#12634F" }}
              >
                {t("Ask our team ↗", "సంప్రదించండి ↗")}
              </a>
            </p>
          </section>
          <section id="car-care" className="wrap">
            <motion.div {...reveal} className="feature">
              <div className="feature-media">
                {videoStarted ? (
                  <video
                    ref={videoRef}
                    src="/videos/car-care.mp4"
                    poster={photo("car")}
                    controls
                    muted
                    playsInline
                    autoPlay
                    onPause={() => setVideoPlaying(false)}
                    onPlay={() => setVideoPlaying(true)}
                    onEnded={() => setVideoPlaying(false)}
                    onError={() => {
                      setVideoStarted(false);
                      setVideoPlaying(false);
                      setStatus(
                        "The video could not load. Please try again shortly.",
                      );
                    }}
                  />
                ) : (
                  <img
                    src={photo("car")}
                    alt="Foam wash at a home driveway"
                    loading="lazy"
                    width="700"
                    height="600"
                  />
                )}
                <button
                  className="video-toggle"
                  onClick={() => void toggleVideo()}
                >
                  {videoPlaying ? "Ⅱ Pause film" : "▷ Watch car-care film"}
                </button>
              </div>
              <div className="feature-content">
                <div className="eyebrow">
                  {t(
                    "YOUR CAR. YOUR DRIVEWAY. OUR CARE.",
                    "మీ కార్. మీ ఇంటి వద్దే క్లీనింగ్.",
                  )}
                </div>
                <h2>
                  {t("Skip the trip.", "ప్రయాణం అవసరం లేదు.")}
                  <br />
                  <em>{t("Keep the shine.", "మీ కార్ మెరిసిపోనివ్వండి.")}</em>
                </h2>
                <p>
                  {t(
                    "No queues. No driving across town. Enquire about regular doorstep car cleaning and make a clean car part of your everyday.",
                    "కార్ వాష్ కోసం బయటికి వెళ్లాల్సిన అవసరం లేదు. మీ ఇంటి వద్ద క్లీనింగ్ కోసం సంప్రదించండి.",
                  )}
                </p>
                <div className="price-line">
                  ₹500 <small>/ {t("month onwards", "నెల నుండి")}</small>
                </div>
                <ul className="feature-list">
                  <li>Cleaning at your home or apartment</li>
                  <li>Monthly care options to suit your routine</li>
                  <li>Plan details agreed before you start</li>
                </ul>
                <button className="button light" onClick={() => pick("car")}>
                  {t(
                    "Ask about my car-care plan",
                    "కార్ ప్లాన్ వివరాలు అడగండి",
                  )}
                  <Arrow />
                </button>
                <p className="fine">
                  Starting price. Included visits, vehicle size, scope, water
                  access and service-area availability are confirmed by our
                  team. A foam wash or interior deep clean may be quoted
                  separately. Film is illustrative.
                </p>
              </div>
            </motion.div>
          </section>
          <section id="laundry" className="wrap section-space laundry">
            <motion.div {...reveal} className="laundry-image">
              <img
                src={photo("laundry")}
                alt="Freshly laundered clothing prepared for care"
                loading="lazy"
                width="700"
                height="600"
              />
              <div className="pickup-label">
                <span>{t("Your doorstep", "మీ ఇంటి వద్ద")}</span>
                <b aria-hidden="true">↔</b>
                <span>{t("Fresh & ready", "శుభ్రంగా సిద్ధం")}</span>
              </div>
            </motion.div>
            <motion.div {...reveal} className="laundry-copy">
              <div className="eyebrow">
                {t("LAUNDRY & DRY CLEANING", "లాండ్రీ & డ్రై క్లీనింగ్")}
              </div>
              <h2>
                {t("You wear it.", "మీరు ధరించండి.")}
                <br />
                <em>{t("We’ll take it", "మేము పికప్ చేసి")}</em>
                <br />
                <em>{t("from here.", "డెలివరీ చేస్తాం.")}</em>
              </h2>
              <p>
                {t(
                  "Leave the laundry run to us. From everyday clothes to special garments, ask for pickup and delivery that fits around your day.",
                  "బట్టల కోసం బయటికి వెళ్లాల్సిన పనిలేదు. మీ ఇంటి వద్ద పికప్ చేసి, శుభ్రంగా డెలివరీ చేస్తాం.",
                )}
              </p>
              <div className="laundry-steps">
                {[
                  [
                    "01",
                    "We pick it up",
                    "Tell us the garments and a convenient collection time.",
                  ],
                  [
                    "02",
                    "We care for it",
                    "Fabric care and the garment-wise quote are confirmed first.",
                  ],
                  [
                    "03",
                    "We bring it back",
                    "We agree your delivery time so you know what to expect.",
                  ],
                ].map(([n, title, body]) => (
                  <div className="laundry-step" key={n}>
                    <span className="number">{n}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="button" onClick={() => pick("laundry")}>
                {t("Arrange a laundry pickup", "లాండ్రీ పికప్ అడగండి")}
                <Arrow />
              </button>
            </motion.div>
          </section>
          <section className="care-section section-space">
            <div className="wrap">
              <motion.div {...reveal}>
                <div className="eyebrow">
                  {t("LESS WORRY. MORE EVERYDAY.", "మీ పనులు సులభంగా")}
                </div>
                <h2>
                  {t("Good service starts", "మంచి సర్వీస్")}
                  <br />
                  <em>
                    {t(
                      "with a conversation.",
                      "స్పష్టమైన వివరాలతో మొదలవుతుంది.",
                    )}
                  </em>
                </h2>
              </motion.div>
              <div className="care-grid">
                {[
                  [
                    "01",
                    "Tell us what you need",
                    "Your home, your car, your clothes or your workplace. Share the details that matter.",
                  ],
                  [
                    "02",
                    "Get a clear plan",
                    "We confirm the scope, quote and available time. Ask questions before agreeing to the work.",
                  ],
                  [
                    "03",
                    "Let us take care of it",
                    "Your service is arranged with the team. Need to change something? Customer Care is here to help.",
                  ],
                ].map(([n, title, body]) => (
                  <motion.div key={n} {...reveal} className="care-item">
                    <span className="number">{n}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
          <section className="wrap section-space faq-layout">
            <motion.div {...reveal}>
              <div className="eyebrow">
                {t("A FEW THINGS TO KNOW", "మీ సందేహాలకు సమాధానాలు")}
              </div>
              <h2>
                {t("Good questions.", "మీ ప్రశ్నలు.")}
                <br />
                <em>{t("Clear answers.", "స్పష్టమైన సమాధానాలు.")}</em>
              </h2>
            </motion.div>
            <div className="faq">
              {[
                [
                  "What is included in the ₹500 monthly car plan?",
                  "₹500/month is the starting price shared by ANVIRA. Contact us with your vehicle and location so the team can confirm visits per month, cleaning scope, water requirements and any extra charges. We won’t assume a daily wash or an interior deep clean is included.",
                ],
                [
                  "Do you pick up and deliver laundry?",
                  "Yes, pickup and delivery are the focus of our laundry and dry-cleaning service. The team will confirm your area, garments, care requirements, quote and collection/return times before arranging it.",
                ],
                [
                  "Can I request cleaning for an office or shop?",
                  "Yes. Share the size of your workplace and preferred hours. We’ll discuss one-time or recurring cleaning and confirm the work and quote.",
                ],
                [
                  "Where are services available?",
                  "ANVIRA is currently focused on Shadnagar. Share your locality or PIN code with the team to confirm whether the specific service is available at your address.",
                ],
                [
                  "How do I enquire or change my service?",
                  "Use the enquiry form below or the contact button. The team confirms availability and pricing directly. For a change or concern, contact Customer Care with your service details.",
                ],
                [
                  "Do I need to create a website account?",
                  "No. This website helps you explore services and contact ANVIRA. The staff portal is reserved for the Owner and Customer Care team.",
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>
          <section id="contact" className="care-section section-space">
            <div className="wrap contact-layout">
              <motion.div {...reveal} className="contact-copy">
                <div className="eyebrow">
                  {t("LET’S MAKE YOUR DAY EASIER", "మీ పనులు సులభం చేద్దాం")}
                </div>
                <h2>
                  {t("One less thing", "మీ పని ఒకటి")}
                  <br />
                  <em>{t("to think about.", "మాకు అప్పగించండి.")}</em>
                </h2>
                <p>
                  {t(
                    "Tell us what you need and where you are. Our team will help you find the right service and confirm the details.",
                    "మీకు ఏ సర్వీస్ కావాలో, మీ ప్రాంతం ఏమిటో చెప్పండి. మా టీమ్ వివరాలు తెలియజేస్తుంది.",
                  )}
                </p>
                <span className="pill">
                  <span className="dot" />
                  Shadnagar & nearby · ask about your area
                </span>
                {!!whatsapp && (
                  <p style={{ fontSize: 16 }}>
                    <a href={"tel:+" + whatsapp}>
                      {whatsapp === "917989365699"
                        ? "+91 79893 65699"
                        : "+" + whatsapp}
                    </a>
                  </p>
                )}
                <p style={{ fontSize: 12 }}>
                  <a href="mailto:anviraservicesllp@gmail.com">
                    anviraservicesllp@gmail.com ↗
                  </a>
                </p>
              </motion.div>
              <form className="contact-form" onSubmit={submit}>
                <h3>{t("What can we help with?", "మీకు ఏ సర్వీస్ కావాలి?")}</h3>
                <label style={{ marginTop: 22 }}>
                  Service
                  <select
                    aria-label="Service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    {marketingServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {te ? s.te : s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    Your name
                    <input
                      required
                      maxLength={80}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="How should we call you?"
                    />
                  </label>
                  <label>
                    Locality or PIN code
                    <input
                      required
                      maxLength={100}
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Shadnagar, 509216"
                    />
                  </label>
                </div>
                <label>
                  A little more detail{" "}
                  <span style={{ fontWeight: 400 }}>(optional)</span>
                  <textarea
                    maxLength={700}
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Car type, garments, rooms or the repair you need…"
                  />
                </label>
                <button className="button" type="submit">
                  {whatsapp ? "Continue on WhatsApp" : "Prepare email enquiry"}
                  <Arrow />
                </button>
                <p className="form-note">
                  {whatsapp
                    ? "You’ll review and send the message in WhatsApp. This form does not book or charge you."
                    : "Opens an email draft for you to review and send. No booking or payment is made here."}
                </p>
                <p className="form-status" role="status">
                  {status}
                </p>
              </form>
            </div>
          </section>
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <div className="footer-top">
              <a href="#top" aria-label="ANVIRA Services home">
                <img
                  className="footer-logo"
                  src="/brand/anvira-logo.png"
                  alt="ANVIRA Services"
                  width="180"
                  height="110"
                  loading="lazy"
                />
              </a>
              <p>
                Good care. Right at home.
                <br />
                Your trusted partner for life’s everyday needs.
              </p>
              <a className="button light" href="#services">
                Explore all services
                <Arrow />
              </a>
            </div>
            <div className="footer-bottom">
              <span>
                © {new Date().getFullYear()} ANVIRA Services. All rights
                reserved.
              </span>
              <div className="footer-links">
                <a href="#contact">Contact us</a>
                {company?.policyPublished && company.termsUrl && (
                  <a href={company.termsUrl}>Terms</a>
                )}
                {company?.policyPublished && company.privacyUrl && (
                  <a href={company.privacyUrl}>Privacy</a>
                )}
                <Link href="/staff">Staff & Customer Care</Link>
              </div>
            </div>
          </div>
        </footer>
        <a
          className="whatsapp-float"
          href={
            whatsapp
              ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hello ANVIRA! I’d like to enquire about your services.")}`
              : "#contact"
          }
          {...(whatsapp
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          aria-label={whatsapp ? "Enquire on WhatsApp" : "Contact ANVIRA"}
        >
          <WhatsAppIcon />
          <span>{whatsapp ? "Chat with us" : "Let’s talk"}</span>
        </a>
        <AnimatePresence>
          {selected && (
            <ServiceDialog
              service={selected}
              te={te}
              close={() => setSelected(null)}
              enquire={() => {
                const id = selected.id;
                setSelected(null);
                pick(id);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
