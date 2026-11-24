import { ServicePhoto } from "./ServicePhoto";
import { PromotionalCarousel } from "./PromotionalCarousel";
import { useEffect, useRef, useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import type { Service, PromotionalBanner } from "../lib/model";
import { marketingServices } from "../lib/marketing";
import {
  categoryForService,
  categoryTopics,
  discoverServices,
  topicPhoto,
  type MarketplaceCategory,
} from "../lib/marketplace";
import { servicePricing } from "../lib/service-catalog";
import { marketplaceCSS, marketplaceLanguageCSS } from "./marketplace-styles";

type PublicInfo = {
  supportPhone?: string;
  pins?: string[];
  termsUrl?: string;
  privacyUrl?: string;
  policyPublished?: boolean;
};
type Catalog = {
  banners?: PromotionalBanner[];
  services: Service[];
  pins: string[];
  mode: string;
};
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
const price = (s: Service, t: (value: string) => string) => {
  if (s.billingPeriod === "monthly") return t("Monthly subscription");
  const p = servicePricing(s);
  return p.minimum === null
    ? t("Request a quote")
    : `${p.from ? t("From") + " " : ""}₹${p.minimum.toLocaleString("en-IN")}`;
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
  const { read, lang, setLang, t } = useApp();
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
  const data = catalog?.services || [];
  const services = discoverServices(data, categoryId, query, t);
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
          t(s.description),
          t(s.name),
          ...categoryTopics[s.id].flatMap((x) => [x.title, t(x.title)]),
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
            ? "Your PIN code is in our service area. Contact our team to confirm a suitable visit."
            : "This PIN code is outside our published coverage. Contact the team for availability.",
    );
  };
  const serviceCard = (s: Service) => {
    const key = categoryForService(s);
    const info = marketingServices.find((x) => x.id === key);
    const monthly = s.billingPeriod === "monthly";
    const name = (lang === "te" && s.nameTe) || t(s.name);
    const description = (lang === "te" && s.descriptionTe) || t(s.description);
    return (
      <article className="mp-service" key={s.id}>
        <a
          href={contactUrl(s.name)}
          className="mp-service-photo"
          aria-label={t("Enquire about") + " " + name}
          target="_blank"
          rel="noreferrer"
        >
          <ServicePhoto service={s} style={{ height: "100%", width: "100%" }} />
          <span className="mp-photo-label">{t(info?.name || s.category)}</span>
        </a>
        <div className="mp-service-copy">
          <h3>{name}</h3>
          <p>{s.headline ? t(s.headline) : description}</p>
          <div className="mp-service-meta">
            <strong>{price(s, t)}</strong>
            <span>
              {monthly
                ? t("Price and schedule confirmed by the team")
                : s.bookingMode === "quote"
                  ? t("Scope confirmed with our team")
                  : s.packages?.length
                    ? `${s.packages.length} ${t("packages")}`
                    : t(durations(s.duration))}
            </span>
          </div>
          <details className="mp-service-details">
            <summary>{t("Service details")}</summary>
            <p>{description}</p>
            {!!s.includes?.length && (
              <>
                <strong>{t("Included scope")}</strong>
                <ul>
                  {s.includes.map((line) => (
                    <li key={line}>{t(line)}</li>
                  ))}
                </ul>
              </>
            )}
            {!!s.excludes?.length && (
              <>
                <strong>{t("Not included")}</strong>
                <ul>
                  {s.excludes.map((line) => (
                    <li key={line}>{t(line)}</li>
                  ))}
                </ul>
              </>
            )}
          </details>
          <a
            className="mp-outline"
            href={contactUrl(s.name)}
            target="_blank"
            rel="noreferrer"
          >
            {monthly
              ? t("Enquire about a monthly plan")
              : t("Enquire with our team")}{" "}
            <Glyph name="arrow" size={17} />
          </a>
        </div>
      </article>
    );
  };
  return (
    <div className="mp" ref={page} lang={lang}>
      <style>{marketplaceCSS + marketplaceLanguageCSS}</style>
      <a className="mp-skip" href="#main">
        {t("Skip to services")}{" "}
      </a>
      <header className="mp-header">
        <div className="mp-header-inner">
          <Link
            href="/welcome"
            className="mp-brand"
            accessibilityLabel={t("ANVIRA home")}
          >
            <span className="mp-monogram">
              a<span>•</span>
            </span>
            <span>
              anvira
              <span className="mp-brand-caption">
                {t("a little care goes a long way")}{" "}
              </span>
            </span>
          </Link>
          <a className="mp-location" href="#coverage">
            <Glyph name="pin" />
            <span>
              <strong>{t("Your doorstep, our destination")}</strong>
              <small>{t("Check service availability")}</small>
            </span>
            <span aria-hidden="true">⌄</span>
          </a>
          <nav aria-label={t("Main navigation")}>
            <Link href="/catalog">{t("Services")}</Link>
            <Link href="/about">{t("Our story")}</Link>
            <a href="#contact">{t("Contact us")}</a>
          </nav>
          <Link className="mp-login" href="/staff">
            <Glyph name="user" size={18} />
            <span>{t("Staff portal")}</span>
          </Link>
          <button
            className="mp-language mp-header-language"
            type="button"
            lang={lang === "en" ? "te" : "en"}
            onClick={() => setLang(lang === "en" ? "te" : "en")}
          >
            {lang === "en" ? "తెలుగు" : "English"}
          </button>
        </div>
      </header>
      <main id="main" className="mp-main">
        {!catalogView && !query && (
          <section className="mp-hero" aria-labelledby="hero-heading">
            <div className="mp-hero-copy">
              <span className="mp-eyebrow">
                <span className="mp-dot" />{" "}
                {t("LIFE AT HOME, A LITTLE BETTER")}{" "}
              </span>
              <h1 id="hero-heading">
                {lang === "te" ? (
                  t("Good care. Right at home.")
                ) : (
                  <>
                    Good care.
                    <br />
                    Right at <em>home.</em>
                  </>
                )}
              </h1>
              <p>
                {t(
                  "From a fresher home to the little fixes you’ve been putting off. Find the right care, all in one place.",
                )}{" "}
              </p>
              <a className="mp-primary" href="#services">
                {t("Find your service")} <Glyph name="arrow" size={19} />
              </a>
              <div className="mp-hero-note">
                <Glyph name="check" size={16} />{" "}
                {t("Your scope. Your schedule. Your approval.")}{" "}
              </div>
            </div>
            <div className="mp-hero-visual">
              <div className="mp-hero-image">
                <Photo
                  image="cleaning"
                  alt={t("Careful cleaning in a bright, welcoming home")}
                  eager
                />
                <span className="mp-image-caption">
                  {t("A fresh start feels good.")}{" "}
                </span>
              </div>
              <div className="mp-mini-photo">
                <Photo image="car" alt={t("Doorstep car cleaning")} eager />
                <span>
                  {t("For the things")} <br />
                  {t("you care about.")}{" "}
                </span>
              </div>
              <span className="mp-hero-stamp">
                {t("thoughtful care")} <br />
                <b>{t("every day.")}</b>
                <span aria-hidden="true">✳</span>
              </span>
            </div>
          </section>
        )}
        {!catalogView &&
          !query &&
          allServices.some(
            (s) =>
              s.billingPeriod === "monthly" && categoryForService(s) === "car",
          ) && (
            <section className="mp-monthly">
              <div>
                <span className="mp-eyebrow">{t("Monthly subscription")}</span>
                <h2>{t("Monthly Car Care")}</h2>
                <p>
                  {t(
                    "Regular car cleaning at your parking spot with a monthly subscription.",
                  )}
                </p>
              </div>
              <Link className="mp-outline" href="/catalog?category=car">
                {t("Explore monthly Car Care")} <Glyph name="arrow" size={17} />
              </Link>
            </section>
          )}
        <section
          id="services"
          className="mp-discover"
          aria-labelledby="services-heading"
        >
          <div className="mp-section-heading">
            <div>
              <span className="mp-eyebrow">{t("SIX WAYS WE CAN HELP")}</span>
              <h2 id="services-heading">
                {catalogView
                  ? t("What needs a little care?")
                  : t("Leave the to-do list to us.")}
              </h2>
            </div>
            {!catalogView && (
              <Link className="mp-text-link" href="/catalog">
                {t("Explore all services")} <Glyph name="arrow" size={17} />
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
              aria-label={t("Search services")}
              placeholder={t("Try ‘AC repair’ or ‘kitchen cleaning’")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>{t("Search")}</kbd>
            {query && (
              <button
                type="button"
                aria-label={t("Clear search")}
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
                aria-label={t("Explore") + " " + t(s.name)}
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
              {t("← All services")}{" "}
            </button>
          )}
        </section>
        {category && (
          <section className="mp-category-intro">
            <div>
              <span className="mp-eyebrow">{t("A LITTLE EXPERT HELP")}</span>
              <h1>{lang === "te" ? category.te : category.name}</h1>
              <p>{t(category.description)}</p>
              <span className="mp-soft-tag">
                {t("Clear scope before your visit")}
              </span>
            </div>
            <Photo image={category.image} alt={t(category.name)} />
          </section>
        )}
        {!catalogView && !query && (
          <PromotionalCarousel
            banners={catalog?.banners || []}
            services={catalog?.services || []}
            onOpen={(service) =>
              router.push(
                ("/catalog?q=" + encodeURIComponent(service.name)) as never,
              )
            }
          />
        )}
        <section className="mp-published" aria-labelledby="published-heading">
          <div className="mp-section-heading">
            <div>
              <span className="mp-eyebrow">
                {t("CHOOSE THE CARE THAT FITS")}
              </span>
              <h2 id="published-heading">
                {query
                  ? t("Results for") + " “" + query + "”"
                  : category
                    ? "Services & packages"
                    : "Ready for a better everyday?"}
              </h2>
            </div>
            {catalog?.mode === "demo" && (
              <span className="mp-soft-tag">
                {t("Preview catalogue · example prices")}{" "}
              </span>
            )}
          </div>
          {!!error && (
            <div className="mp-feedback" role="status">
              <p>
                {t(
                  "We couldn’t load current services. You can still explore the categories below.",
                )}{" "}
              </p>
              <button
                className="mp-outline"
                onClick={() => setAttempt((x) => x + 1)}
              >
                {t("Try again")}{" "}
              </button>
            </div>
          )}
          {!catalog && !error && (
            <div className="mp-loading" aria-label={t("Loading services")}>
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
                    ? t("No matching services")
                    : t("Let’s find the right care for you.")}
                </h3>
                <p>
                  {query
                    ? t("Try another search or explore a service below.")
                    : t(
                        "Explore the service scope below. Our team can confirm current availability and a quote for your requirement.",
                      )}
                </p>
              </div>
              {query && (
                <button className="mp-outline" onClick={() => setQuery("")}>
                  {t("Clear search")}{" "}
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
                  <span className="mp-eyebrow">{t(s.price)}</span>
                  <h2 id={"topic-" + s.id}>{t(s.name)}</h2>
                </div>
              </div>
              <div className="mp-topic-grid">
                {categoryTopics[s.id]
                  .filter(
                    (topic) =>
                      !query ||
                      [
                        topic.title,
                        t(topic.title),
                        topic.description,
                        t(topic.description),
                        s.name,
                        s.te,
                      ]
                        .join(" ")
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((topic) => (
                    <article className="mp-topic" key={t(topic.title)}>
                      <div className="mp-topic-photo">
                        <Photo image={topic.image} alt={t(topic.title)} />
                      </div>
                      <div>
                        <h3>{t(topic.title)}</h3>
                        <p>{t(topic.description)}</p>
                        <details>
                          <summary>
                            {t("How it works")}{" "}
                            <span aria-hidden="true">+</span>
                          </summary>
                          <p>{t(s.detail)}</p>
                          <p>
                            {t(
                              "Ask our team to confirm the service scope, price and availability.",
                            )}{" "}
                          </p>
                        </details>
                        <a
                          className="mp-text-link"
                          href={contactUrl(topic.title)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.id === "car"
                            ? t("Enquire about a monthly plan")
                            : t("Enquire about this service")}{" "}
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
            <p>
              {t("Need something else? Tell the team what you have in mind.")}
            </p>
            <a className="mp-primary" href={contactUrl(query)}>
              {t("Ask the team")} <Glyph name="arrow" />
            </a>
          </div>
        )}
        {!query && (
          <section className="mp-promise">
            <div>
              <span className="mp-eyebrow">{t("THE ANVIRA WAY")}</span>
              <h2>
                {t("Good service starts")} <br />
                {t("with the little things.")}{" "}
              </h2>
              <p>
                {t(
                  "We keep the important details clear, so you can get on with your day.",
                )}{" "}
              </p>
            </div>
            <div className="mp-promise-grid">
              {[
                [
                  "01",
                  "Choose with confidence",
                  "Read the included scope and ask our team about the right care for your home.",
                ],
                [
                  "02",
                  "A time that works for you",
                  "Contact our team to confirm coverage and arrange a suitable visit.",
                ],
                [
                  "03",
                  "You stay in control",
                  "Any extra work or replacement parts need your approval before they go ahead.",
                ],
              ].map(([n, title, body]) => (
                <article key={n}>
                  <span>{n}</span>
                  <h3>{t(title)}</h3>
                  <p>{t(body)}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="mp-contact" id="coverage">
          <div>
            <span className="mp-eyebrow">{t("GOOD CARE, CLOSER TO YOU")}</span>
            <h2>{t("Are we in your neighbourhood?")}</h2>
            <p>
              {t("Enter your PIN code to check our published service area.")}
            </p>
          </div>
          <form onSubmit={checkPin}>
            <label htmlFor="service-pin">{t("Your PIN code")}</label>
            <div className="mp-pin-input">
              <Glyph name="pin" />
              <input
                id="service-pin"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                placeholder={t("6-digit PIN code")}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setPinMessage("");
                }}
              />
              <button className="mp-primary" type="submit">
                {t("Check")} <Glyph name="arrow" size={18} />
              </button>
            </div>
            <p role="status">{t(pinMessage)}</p>
          </form>
        </section>
        <section id="contact" className="mp-help">
          <div>
            <h2>{t("A question before you book?")}</h2>
            <p>
              {t("We’re here to help you find the right service and scope.")}
            </p>
          </div>
          <a
            className="mp-primary"
            href={contactUrl(category?.name || "home services")}
            target="_blank"
            rel="noreferrer"
          >
            {t("Talk to our team")} <Glyph name="arrow" size={18} />
          </a>
        </section>
      </main>
      <footer className="mp-footer">
        <div className="mp-footer-inner">
          <div>
            <Link href="/welcome" className="mp-footer-brand">
              anvira<span>•</span>
            </Link>
            <p>{t("Good care. Right at home.")}</p>
            <button
              className="mp-language"
              onClick={() => setLang(lang === "en" ? "te" : "en")}
            >
              {lang === "en" ? "తెలుగులో చూడండి" : "View in English"}
            </button>
          </div>
          <div>
            <strong>{t("Explore")}</strong>
            <Link href="/catalog">{t("All services")}</Link>
            <Link href="/about">{t("About ANVIRA")}</Link>
            <a href="#coverage">{t("Service areas")}</a>
          </div>
          <div>
            <strong>{t("We’re here for you")}</strong>
            <a href={contactUrl("customer support")}>{t("Contact us")}</a>
            <Link href="/delete-account">{t("Delete account")}</Link>
          </div>
          <div>
            <strong>{t("Work with us")}</strong>
            <a href={contactUrl("working with ANVIRA")}>
              {t("Work with ANVIRA")}
            </a>
            <Link href="/staff">{t("Staff portal")}</Link>
            {company.policyPublished && company.termsUrl && (
              <a href={company.termsUrl}>{t("Terms & conditions")}</a>
            )}
            {company.policyPublished && company.privacyUrl && (
              <a href={company.privacyUrl}>{t("Privacy policy")}</a>
            )}
          </div>
        </div>
        <div className="mp-footer-bottom">
          <span>
            © {new Date().getFullYear()}{" "}
            {t("ANVIRA Services. All rights reserved.")}{" "}
          </span>
          <span>{t("Thoughtful care, one home at a time.")}</span>
        </div>
      </footer>
    </div>
  );
}
