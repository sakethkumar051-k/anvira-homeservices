import { useEffect, useRef, useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import type { Service } from "../lib/model";
import { marketingServices } from "../lib/marketing";
import {
  categoryForService,
  categoryTopics,
  discoverServices,
  topicPhoto,
  type MarketplaceCategory,
} from "../lib/marketplace";
import { servicePricing } from "../lib/service-catalog";
import { marketplaceCSS } from "./marketplace-styles";

type PublicInfo = {
  supportPhone?: string;
  pins?: string[];
  termsUrl?: string;
  privacyUrl?: string;
  policyPublished?: boolean;
};
type Catalog = { services: Service[]; pins: string[]; mode: string };
function Glyph({
  name,
  size = 22,
}: {
  name: "search" | "pin" | "user" | "arrow" | "check" | "calendar" | "home";
  size?: number;
}) {
  const paths = {
    search: "m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    pin: "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    calendar: "M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16",
    home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function Photo({
  image,
  alt,
  eager = false,
}: {
  image: string;
  alt: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="mp-photo-fallback" role="img" aria-label={alt}>
      <Glyph name="home" size={38} />
    </span>
  ) : (
    <img
      src={topicPhoto(image)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
const price = (s: Service) => {
  const p = servicePricing(s);
  return p.minimum === null
    ? "Request a quote"
    : `${p.from ? "From " : ""}₹${p.minimum.toLocaleString("en-IN")}`;
};
const durations = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} hr${minutes >= 120 ? "s" : ""}${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `${minutes} min`;

export default function Marketplace({
  catalogView = false,
}: {
  catalogView?: boolean;
}) {
  const { read, state, lang, setLang } = useApp();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const categoryId = marketingServices.some((s) => s.id === params.category)
    ? (params.category as MarketplaceCategory)
    : "";
  const category = marketingServices.find((s) => s.id === categoryId);
  const page = useRef<HTMLDivElement>(null);
  const routeKey = categoryId + ":" + (params.q || "");
  const [search, setSearch] = useState({ routeKey, value: params.q || "" });
  const query = search.routeKey === routeKey ? search.value : params.q || "";
  const setQuery = (value: string) => setSearch({ routeKey, value });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [company, setCompany] = useState<PublicInfo>({});
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  useEffect(() => {
    let active = true;
    void read<Catalog>("/catalog")
      .then((value) => {
        if (active) {
          setCatalog(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Services could not be loaded.");
      });
    void read<PublicInfo>("/public")
      .then((value) => {
        if (active) setCompany(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [read, attempt]);
  useEffect(() => {
    page.current?.scrollTo({ top: 0 });
  }, [params.q, categoryId]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash)
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView(),
      );
  }, []);
  const data = state?.services || catalog?.services || [];
  const services = discoverServices(data, categoryId, query);
  const allServices = discoverServices(data);
  const matchingCategories = marketingServices
    .filter((s) => !categoryId || s.id === categoryId)
    .filter(
      (s) =>
        !query ||
        [
          s.name,
          s.description,
          s.te,
          ...categoryTopics[s.id].map((x) => x.title),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    );
  const phone = (company.supportPhone || "").replace(/\D/g, "");
  const contactUrl = (subject: string) =>
    phone.length >= 10
      ? `https://wa.me/${phone.length === 10 ? "91" + phone : phone}?text=${encodeURIComponent(`Hello ANVIRA, I would like to enquire about ${subject}. Please confirm availability, scope and price.`)}`
      : `mailto:anviraservicesllp@gmail.com?subject=${encodeURIComponent("Service enquiry: " + subject)}`;
  const showCategory = (id: string) =>
    router.push(("/catalog?category=" + id) as never);
  const checkPin = (event: React.FormEvent) => {
    event.preventDefault();
    const pins = catalog?.pins || company.pins || [];
    setPinMessage(
      !/^\d{6}$/.test(pin)
        ? "Enter a valid 6-digit PIN code."
        : !catalog && !company.pins
          ? "Coverage is unavailable right now. Please contact the team to confirm your area."
          : pins.includes(pin)
            ? "Your PIN code is in our service area. Choose a service to check available slots."
            : "This PIN code is outside our published coverage. Contact the team for availability.",
    );
  };
  const serviceCard = (s: Service) => {
    const key = categoryForService(s)!;
    const info = marketingServices.find((x) => x.id === key)!;
    return (
      <article className="mp-service" key={s.id}>
        <Link
          href={("/service/" + s.id) as never}
          className="mp-service-photo"
          accessibilityLabel={"View service: " + s.name}
        >
          <Photo image={info.image} alt={s.name} />
          <span className="mp-photo-label">{info.name}</span>
        </Link>
        <div className="mp-service-copy">
          <h3>
            <Link href={("/service/" + s.id) as never}>{s.name}</Link>
          </h3>
          <p>{s.headline || s.description}</p>
          <div className="mp-service-meta">
            <strong>{price(s)}</strong>
            <span>
              {s.bookingMode === "quote"
                ? "Scope agreed with you"
                : s.packages?.length
                  ? `${s.packages.length} packages`
                  : durations(s.duration)}
            </span>
          </div>
          <Link className="mp-outline" href={("/service/" + s.id) as never}>
            View options <Glyph name="arrow" size={17} />
          </Link>
        </div>
      </article>
    );
  };
  return (
    <div className="mp" ref={page}>
      <style>{marketplaceCSS}</style>
      <a className="mp-skip" href="#main">
        Skip to services
      </a>
      <header className="mp-header">
        <div className="mp-header-inner">
          <Link
            href="/welcome"
            className="mp-brand"
            accessibilityLabel="ANVIRA home"
          >
            <span className="mp-monogram">
              a<span>•</span>
            </span>
            <span>
              anvira
              <span className="mp-brand-caption">
                a little care goes a long way
              </span>
            </span>
          </Link>
          <a className="mp-location" href="#coverage">
            <Glyph name="pin" />
            <span>
              <strong>Your doorstep, our destination</strong>
              <small>Check service availability</small>
            </span>
            <span aria-hidden="true">⌄</span>
          </a>
          <nav aria-label="Main navigation">
            <Link href="/catalog">Services</Link>
            <Link href="/about">Our story</Link>
            <Link
              href={
                (state ? "/bookings" : "/sign-in?returnTo=/bookings") as never
              }
            >
              My bookings
            </Link>
          </nav>
          <Link className="mp-login" href={state ? "/home" : "/sign-in"}>
            <Glyph name="user" size={18} />
            <span>{state ? "My account" : "Sign in"}</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mp-main">
        {!catalogView && !query && (
          <section className="mp-hero" aria-labelledby="hero-heading">
            <div className="mp-hero-copy">
              <span className="mp-eyebrow">
                <span className="mp-dot" /> LIFE AT HOME, A LITTLE BETTER
              </span>
              <h1 id="hero-heading">
                Good care.
                <br />
                Right at <em>home.</em>
              </h1>
              <p>
                From a fresher home to the little fixes you’ve been putting off.
                Find the right care, all in one place.
              </p>
              <a className="mp-primary" href="#services">
                Find your service <Glyph name="arrow" size={19} />
              </a>
              <div className="mp-hero-note">
                <Glyph name="check" size={16} /> Your scope. Your schedule. Your
                approval.
              </div>
            </div>
            <div className="mp-hero-visual">
              <div className="mp-hero-image">
                <Photo
                  image="cleaning"
                  alt="Careful cleaning in a bright, welcoming home"
                  eager
                />
                <span className="mp-image-caption">
                  A fresh start feels good.
                </span>
              </div>
              <div className="mp-mini-photo">
                <Photo image="car" alt="Doorstep car cleaning" eager />
                <span>
                  For the things
                  <br />
                  you care about.
                </span>
              </div>
              <span className="mp-hero-stamp">
                thoughtful care
                <br />
                <b>every day.</b>
                <span aria-hidden="true">✳</span>
              </span>
            </div>
          </section>
        )}
        <section
          id="services"
          className="mp-discover"
          aria-labelledby="services-heading"
        >
          <div className="mp-section-heading">
            <div>
              <span className="mp-eyebrow">SIX WAYS WE CAN HELP</span>
              <h2 id="services-heading">
                {catalogView
                  ? "What needs a little care?"
                  : "Leave the to-do list to us."}
              </h2>
            </div>
            {!catalogView && (
              <Link className="mp-text-link" href="/catalog">
                Explore all services <Glyph name="arrow" size={17} />
              </Link>
            )}
          </div>
          <form
            className="mp-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (!catalogView)
                router.push(
                  ("/catalog?q=" + encodeURIComponent(query)) as never,
                );
            }}
          >
            <Glyph name="search" />
            <input
              aria-label="Search services"
              placeholder="Try ‘AC repair’ or ‘kitchen cleaning’"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>Search</kbd>
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            )}
          </form>
          <div className="mp-category-grid">
            {marketingServices.map((s) => (
              <button
                className={
                  "mp-category" + (categoryId === s.id ? " is-selected" : "")
                }
                key={s.id}
                onClick={() => showCategory(s.id)}
                aria-label={"Explore " + s.name}
                aria-pressed={categoryId === s.id}
              >
                <span className="mp-category-image">
                  <Photo image={s.image} alt="" eager />
                </span>
                <strong>{lang === "te" ? s.te : s.name}</strong>
                <span className="mp-category-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
          {categoryId && (
            <button
              className="mp-text-link mp-clear"
              onClick={() => router.push("/catalog")}
            >
              ← All services
            </button>
          )}
        </section>
        {category && (
          <section className="mp-category-intro">
            <div>
              <span className="mp-eyebrow">A LITTLE EXPERT HELP</span>
              <h1>{lang === "te" ? category.te : category.name}</h1>
              <p>{category.description}</p>
              <span className="mp-soft-tag">Clear scope before you book</span>
            </div>
            <Photo image={category.image} alt={category.name} />
          </section>
        )}
        {!catalogView && !query && (
          <section className="mp-campaigns" aria-label="Service spotlights">
            <button
              className="mp-campaign mp-campaign-clean"
              onClick={() => showCategory("home")}
            >
              <div>
                <span className="mp-eyebrow">MAKE ROOM FOR A FRESH START</span>
                <h3>
                  Clean home.
                  <br />
                  Clear mind.
                </h3>
                <span className="mp-campaign-cta">
                  Explore home cleaning <Glyph name="arrow" size={17} />
                </span>
              </div>
              <Photo image="sofa" alt="A fresh and comfortable living space" />
            </button>
            <button
              className="mp-campaign mp-campaign-ac"
              onClick={() => showCategory("ac")}
            >
              <div>
                <span className="mp-eyebrow">COMFORT, TAKEN CARE OF</span>
                <h3>
                  Keep your cool.
                  <br />
                  We’ll handle the AC.
                </h3>
                <span className="mp-campaign-cta">
                  Explore AC care <Glyph name="arrow" size={17} />
                </span>
              </div>
              <Photo image="ac" alt="Air conditioner service" />
            </button>
            <button
              className="mp-campaign mp-campaign-car"
              onClick={() => showCategory("car")}
            >
              <div>
                <span className="mp-eyebrow">ONE LESS STOP TO MAKE</span>
                <h3>
                  Your car.
                  <br />A fresh shine.
                </h3>
                <span className="mp-campaign-cta">
                  Explore car care <Glyph name="arrow" size={17} />
                </span>
              </div>
              <Photo image="car" alt="A carefully cleaned car" />
            </button>
          </section>
        )}
        <section className="mp-published" aria-labelledby="published-heading">
          <div className="mp-section-heading">
            <div>
              <span className="mp-eyebrow">CHOOSE THE CARE THAT FITS</span>
              <h2 id="published-heading">
                {query
                  ? `Results for “${query}”`
                  : category
                    ? "Services & packages"
                    : "Ready for a better everyday?"}
              </h2>
            </div>
            {catalog?.mode === "demo" && (
              <span className="mp-soft-tag">
                Preview catalogue · example prices
              </span>
            )}
          </div>
          {!!error && (
            <div className="mp-feedback" role="status">
              <p>
                We couldn’t load current services. You can still explore the
                categories below.
              </p>
              <button
                className="mp-outline"
                onClick={() => setAttempt((x) => x + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!catalog && !error && !state && (
            <div className="mp-loading" aria-label="Loading services">
              <span />
              <span />
              <span />
            </div>
          )}
          {!!services.length && (
            <div className="mp-service-grid">{services.map(serviceCard)}</div>
          )}
          {catalog && !services.length && (
            <div className="mp-feedback">
              <Glyph name="search" size={28} />
              <div>
                <h3>
                  {query
                    ? "No matching bookable services"
                    : "Let’s find the right care for you."}
                </h3>
                <p>
                  {query
                    ? "Try another search or explore a service below."
                    : "Explore the service scope below. Our team can confirm current availability and a quote for your requirement."}
                </p>
              </div>
              {query && (
                <button className="mp-outline" onClick={() => setQuery("")}>
                  Clear search
                </button>
              )}
            </div>
          )}
        </section>
        {(catalogView || query || !allServices.length) &&
          matchingCategories.map((s) => (
            <section
              className="mp-topics"
              key={s.id}
              aria-labelledby={"topic-" + s.id}
            >
              <div className="mp-section-heading">
                <div>
                  <span className="mp-eyebrow">{s.price}</span>
                  <h2 id={"topic-" + s.id}>{s.name}, made for your needs.</h2>
                </div>
              </div>
              <div className="mp-topic-grid">
                {categoryTopics[s.id]
                  .filter(
                    (topic) =>
                      !query ||
                      [topic.title, topic.description, s.name]
                        .join(" ")
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((topic) => (
                    <article className="mp-topic" key={topic.title}>
                      <div className="mp-topic-photo">
                        <Photo image={topic.image} alt={topic.title} />
                      </div>
                      <div>
                        <h3>{topic.title}</h3>
                        <p>{topic.description}</p>
                        <details>
                          <summary>
                            How it works <span aria-hidden="true">+</span>
                          </summary>
                          <p>{s.detail}</p>
                          <p>
                            Browse published packages above, or ask the team to
                            confirm scope and availability.
                          </p>
                        </details>
                        <a
                          className="mp-text-link"
                          href={contactUrl(topic.title)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Enquire about this service{" "}
                          <Glyph name="arrow" size={17} />
                        </a>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        {query && !matchingCategories.length && !services.length && (
          <div className="mp-feedback">
            <p>Need something else? Tell the team what you have in mind.</p>
            <a className="mp-primary" href={contactUrl(query)}>
              Ask the team <Glyph name="arrow" />
            </a>
          </div>
        )}
        {!query && (
          <section className="mp-promise">
            <div>
              <span className="mp-eyebrow">THE ANVIRA WAY</span>
              <h2>
                Good service starts
                <br />
                with the little things.
              </h2>
              <p>
                We keep the important details clear, so you can get on with your
                day.
              </p>
            </div>
            <div className="mp-promise-grid">
              {[
                [
                  "01",
                  "Choose with confidence",
                  "Read what is included, compare the available packages and choose what your home needs.",
                ],
                [
                  "02",
                  "A time that works for you",
                  "Check coverage and available slots before you confirm a booking.",
                ],
                [
                  "03",
                  "You stay in control",
                  "Any extra work or replacement parts need your approval before they go ahead.",
                ],
              ].map(([n, title, body]) => (
                <article key={n}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="mp-contact" id="coverage">
          <div>
            <span className="mp-eyebrow">GOOD CARE, CLOSER TO YOU</span>
            <h2>Are we in your neighbourhood?</h2>
            <p>Enter your PIN code to check our published service area.</p>
          </div>
          <form onSubmit={checkPin}>
            <label htmlFor="service-pin">Your PIN code</label>
            <div className="mp-pin-input">
              <Glyph name="pin" />
              <input
                id="service-pin"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                placeholder="6-digit PIN code"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setPinMessage("");
                }}
              />
              <button className="mp-primary" type="submit">
                Check <Glyph name="arrow" size={18} />
              </button>
            </div>
            <p role="status">{pinMessage}</p>
          </form>
        </section>
        <section id="contact" className="mp-help">
          <div>
            <h2>A question before you book?</h2>
            <p>We’re here to help you find the right service and scope.</p>
          </div>
          <a
            className="mp-primary"
            href={contactUrl(category?.name || "home services")}
            target="_blank"
            rel="noreferrer"
          >
            Talk to our team <Glyph name="arrow" size={18} />
          </a>
        </section>
      </main>
      <footer className="mp-footer">
        <div className="mp-footer-inner">
          <div>
            <Link href="/welcome" className="mp-footer-brand">
              anvira<span>•</span>
            </Link>
            <p>Good care. Right at home.</p>
            <button
              className="mp-language"
              onClick={() => setLang(lang === "en" ? "te" : "en")}
            >
              {lang === "en" ? "తెలుగులో చూడండి" : "View in English"}
            </button>
          </div>
          <div>
            <strong>Explore</strong>
            <Link href="/catalog">All services</Link>
            <Link href="/about">About ANVIRA</Link>
            <a href="#coverage">Service areas</a>
          </div>
          <div>
            <strong>We’re here for you</strong>
            <Link
              href={
                (state ? "/bookings" : "/sign-in?returnTo=/bookings") as never
              }
            >
              My bookings
            </Link>
            <a href={contactUrl("customer support")}>Contact us</a>
            <Link href="/delete-account">Delete account</Link>
          </div>
          <div>
            <strong>Work with us</strong>
            <Link href="/sign-in?workspace=professional">
              Professional sign in
            </Link>
            <Link href="/staff">Staff portal</Link>
            {company.policyPublished && company.termsUrl && (
              <a href={company.termsUrl}>Terms & conditions</a>
            )}
            {company.policyPublished && company.privacyUrl && (
              <a href={company.privacyUrl}>Privacy policy</a>
            )}
          </div>
        </div>
        <div className="mp-footer-bottom">
          <span>
            © {new Date().getFullYear()} ANVIRA Services. All rights reserved.
          </span>
          <span>Thoughtful care, one home at a time.</span>
        </div>
      </footer>
      <nav className="mp-mobile-nav" aria-label="Customer navigation">
        <Link href="/welcome" className={!catalogView ? "is-current" : ""}>
          <Glyph name="home" size={20} />
          Home
        </Link>
        <Link href="/catalog" className={catalogView ? "is-current" : ""}>
          <Glyph name="search" size={20} />
          Services
        </Link>
        <Link
          href={(state ? "/bookings" : "/sign-in?returnTo=/bookings") as never}
        >
          <Glyph name="calendar" size={20} />
          Bookings
        </Link>
        <Link href={state ? "/profile" : "/sign-in"}>
          <Glyph name="user" size={20} />
          Account
        </Link>
      </nav>
    </div>
  );
}
