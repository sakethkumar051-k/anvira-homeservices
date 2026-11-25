import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { motion, MotionConfig } from "framer-motion";
import { useApp } from "../lib/context";
import { AboutContent } from "../lib/about";
import { marketingCSS } from "./marketing-styles";

export default function About() {
  const { read, t, lang, setLang } = useApp();
  const [content, setContent] = useState<AboutContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const previousTitle = document.title;
    document.title = "About Us | ANVIRA Services";
    const canonical = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonical?.getAttribute("href");
    canonical?.setAttribute("href", "https://anviraservices.com/about");
    void read<{ content: AboutContent | null }>("/public/about")
      .then((p) => {
        if (active) setContent(p.content);
      })
      .catch(() => {
        if (active)
          setError(
            "We couldn’t load our company story. Please try again shortly.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      document.title = previousTitle;
      if (previousCanonical) canonical?.setAttribute("href", previousCanonical);
    };
  }, [read]);
  return (
    <MotionConfig reducedMotion="user">
      <main className="anvira-site" lang={lang}>
        <style>
          {marketingCSS}
          {`
    .anvira-site[lang=te] .about-hero h1,.anvira-site[lang=te] .about-story h2{font-family:TeluguSemi,system-ui,sans-serif;line-height:1.45;letter-spacing:normal}.anvira-site[lang=te]{font-family:Telugu,system-ui,sans-serif}.about-nav{flex-wrap:wrap;display:flex;gap:24px;align-items:center;color:#12634F}.about-nav a{font-weight:600;font-size:14px} .about-hero{padding:80px max(6vw,24px);display:grid;grid-template-columns:1.4fr 1fr;gap:60px;align-items:center;background:var(--mint,#E4F1E9)}
    .about-hero h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,86px);font-weight:400;line-height:1.05;margin:20px 0;color:#073F32;overflow-wrap:anywhere}
    .about-intro{font-size:20px;line-height:1.7;white-space:pre-wrap}.about-photo{width:100%;aspect-ratio:1;object-fit:cover;border-radius:48% 48% 8px 8px}
    .about-story{max-width:1000px;margin:auto;padding:64px 24px}.about-story h2{font:400 38px Georgia,serif;color:#073F32;margin:0 0 20px}.about-story p{font-size:18px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere}.about-sections{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}.about-footer{padding:36px max(6vw,24px);background:#073F32;color:white;display:flex;gap:28px;flex-wrap:wrap}.about-footer a{color:inherit}@media(max-width:760px){.about-hero{grid-template-columns:1fr;padding-top:40px;gap:30px}.about-photo{max-height:300px;aspect-ratio:1.4}.about-sections{grid-template-columns:1fr}}
  `}
        </style>
        <header className="site-nav">
          <div className="wrap nav-inner">
            <Link href="/welcome" className="brand-link">
              <img
                src="/brand/anvira-logo.png"
                className="brand-image"
                alt={t("ANVIRA Services home")}
              />
            </Link>
            <nav aria-label={t("Main navigation")} className="about-nav">
              <Link href="/welcome">{t("Home")}</Link>
              <Link href="/staff">{t("Staff portal")}</Link>
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "te" : "en")}
              >
                {lang === "en" ? "తెలుగు" : "English"}
              </button>
            </nav>
          </div>
        </header>
        <motion.section
          className="about-hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="eyebrow">{t("ABOUT ANVIRA SERVICES")}</span>
            <h1>{t(content?.title || "Your trusted home partner.")}</h1>
            <p className="about-intro">
              {loading
                ? t("Loading our story…")
                : t(error) ||
                  (content?.intro && t(content.intro)) ||
                  t(
                    "Explore monthly Car Care, home cleaning and repairs with ANVIRA.",
                  )}
            </p>
            <Link href="/welcome#contact" className="button">
              {t("Let’s talk ↗")}{" "}
            </Link>
          </div>
          <img
            className="about-photo"
            src="/images/cleaning.jpg"
            alt={t("Illustration of home cleaning services")}
          />
        </motion.section>
        {content && (
          <article className="about-story">
            <h2>{t("Our story")}</h2>
            <p>{t(content.story)}</p>
            <div className="about-sections">
              {(
                [
                  ["mission", "Our mission"],
                  ["values", "What matters to us"],
                  ["serviceArea", "Where we work"],
                ] as const
              )
                .filter(([key]) => content[key])
                .map(([key, title]) => (
                  <section key={key}>
                    <h2>{t(title)}</h2>
                    <p>{t(content[key])}</p>
                  </section>
                ))}
            </div>
          </article>
        )}
        {!!error && (
          <div className="about-story" role="alert">
            <button onClick={() => window.location.reload()}>
              {t("Try again")}
            </button>
          </div>
        )}
        <footer className="about-footer">
          <span>{t("ANVIRA Services · Good care. Right at home.")}</span>
          <Link href="/welcome">{t("Explore our services")}</Link>
          <Link href="/staff">{t("Staff & Customer Care")}</Link>
          <a href="https://wa.me/917989365699">{t("Enquire on WhatsApp")}</a>
        </footer>
      </main>
    </MotionConfig>
  );
}
