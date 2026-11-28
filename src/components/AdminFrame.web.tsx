import React, { useEffect, useState } from "react";
import { router, usePathname } from "expo-router";
import { useApp } from "../lib/context";
import {
  staffNavigationGroups,
  adminPageGuidance,
} from "../lib/admin-workflow";
import { BookingAlertBanner } from "./BookingAlerts";
import type { AdminFrameProps } from "./AdminFrame";
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const zone = { timeZone: "Asia/Kolkata" } as const;
  return (
    <div className="aw-clock" role="timer" aria-label="India time">
      <strong>
        {now.toLocaleTimeString("en-IN", {
          ...zone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </strong>
      <span>
        {now.toLocaleDateString("en-IN", {
          ...zone,
          weekday: "short",
          day: "numeric",
          month: "short",
        })}{" "}
        · IST
      </span>
    </div>
  );
}
export default function AdminFrame({
  title,
  back,
  onBack,
  children,
  footer,
}: AdminFrameProps) {
  const {
    state,
    t,
    lang,
    setLang,
    refresh,
    logout,
    error,
    clearError,
    reauthRequired,
  } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  if (!state) return null;
  const active = path.startsWith("/dashboard/") ? path.split("/")[2] : "";
  const groups = staffNavigationGroups(state.user.role, "web");
  // Work waiting in the loaded records, shown beside the matching page.
  const counts: Record<string, number> = {
    bookings: state.bookings.filter((b) => b.status === "awaiting_assignment")
      .length,
    support: state.tickets.filter((x) => x.status === "open").length,
    refunds: state.bookings.filter((b) => b.refund === "requested").length,
  };
  const navigate = (href: string) => {
    setOpen(false);
    router.push(href as never);
  };
  return (
    <div className="admin-workspace">
      <style>{`
      .admin-workspace{height:100%;min-height:0;display:flex;background:#f3f5f4;color:#172e29;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
      .admin-workspace *{box-sizing:border-box}
      .admin-workspace button,.admin-workspace a{font:inherit}
      .aw-skip{position:absolute;left:-9999px}.aw-skip:focus{left:270px;top:8px;background:white;padding:12px;z-index:20}
      .aw-sidebar{width:254px;flex-shrink:0;background:#103c33;color:#e8f1ed;padding:28px 18px 18px;display:flex;flex-direction:column;overflow:auto}
      .aw-brand{font-size:23px;letter-spacing:4px;font-weight:800;padding:0 16px}.aw-caption{font-size:11px;color:#b7cec4;letter-spacing:1px;margin:5px 16px 24px;text-transform:uppercase}
      .aw-group{margin:14px 0}.aw-group h2{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;color:#a6c4b7;margin:0 14px 8px}
      .aw-link{display:block;padding:10px 14px;border-radius:8px;color:#deebe4;text-decoration:none;font-size:13px;margin:3px 0;overflow-wrap:anywhere}
      .aw-link{display:flex!important;align-items:center;gap:8px}.aw-count{margin-left:auto;background:#d8c39d;color:#103c33;border-radius:10px;font-size:11px;font-weight:800;padding:1px 8px;line-height:18px}.aw-link[aria-current=page] .aw-count{background:#103c33;color:#e4f1e9}
      .aw-clock{display:flex;align-items:baseline;gap:8px;background:#103c33;color:#e4f1e9;border-radius:10px;padding:7px 14px;font-variant-numeric:tabular-nums}.aw-clock strong{font-size:15px;letter-spacing:.5px;text-transform:uppercase}.aw-clock span{font-size:11px;color:#b7cec4}@media(max-width:949px){.aw-clock span{display:none}}
      .aw-sidebar{background:linear-gradient(180deg,#0b3329 0%,#124638 100%)!important}.aw-brand{background:linear-gradient(90deg,#fff,#d8c39d);-webkit-background-clip:text;background-clip:text;color:transparent}.aw-link{transition:background .15s,transform .15s}.aw-link:hover{transform:translateX(2px)}.aw-link[aria-current=page]{box-shadow:0 4px 14px rgba(0,0,0,.18)}.aw-topbar{box-shadow:0 1px 0 #dce4de,0 6px 20px rgba(23,46,41,.05);z-index:2}.aw-button{transition:background .15s,box-shadow .15s,transform .1s}.aw-button:hover{box-shadow:0 3px 10px rgba(23,46,41,.08)}.aw-button:active{transform:scale(.97)}.aw-content{background:radial-gradient(1200px 400px at 80% -10%,#e4f1e9 0%,transparent 60%),#f3f5f4}.aw-heading h1{font-size:30px}
      .aw-link:hover{background:#205045}.aw-link[aria-current=page]{background:#e4f1e9;color:#123f32;font-weight:700}
      .aw-user{margin-top:auto;padding:20px 14px 0;border-top:1px solid #3c5f54;font-size:12px}.aw-user strong{display:block}.aw-user button{margin-top:12px;background:transparent;border:0;color:#deebe4;cursor:pointer;padding:6px 0}
      .aw-body{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}.aw-topbar{display:flex;align-items:center;gap:12px;padding:14px 32px;background:#fff;border-bottom:1px solid #dce4de;min-height:68px}.aw-topbar small{color:#63736b}.aw-topbar .aw-actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .aw-button{border:1px solid #dce4de;background:white;color:#173e31;border-radius:8px;padding:8px 12px;font-size:12px!important;cursor:pointer;min-height:40px}.aw-button:hover{background:#eef3ef}.aw-button:disabled{opacity:.6;cursor:wait}
      .admin-workspace :focus-visible{outline:3px solid #b18d43;outline-offset:3px}
      .aw-menu{display:none}.aw-content{flex:1;min-height:0;overflow:auto;padding:32px;scrollbar-gutter:stable}.aw-page{max-width:1400px;margin:0 auto;display:flex;flex-direction:column;gap:20px}.aw-heading h1{font-size:28px;letter-spacing:-.8px;line-height:1.25;margin:0 0 8px}.aw-heading p{font-size:13px;color:#63736b;max-width:750px;margin:0}.aw-error{background:#fcebe8;padding:14px;border:1px solid #e4b4ad;border-radius:8px;display:flex;gap:16px;align-items:center}.aw-error button{margin-left:auto}
      .aw-overlay{display:none}.aw-footer{padding:16px 32px;border-top:1px solid #dce4de;background:#fff}
      @media(max-width:949px){.aw-sidebar{position:absolute;inset:0 auto 0 0;z-index:12;display:none;width:280px}.aw-sidebar.aw-open{display:flex}.aw-overlay.aw-open{display:block;position:absolute;inset:0;background:#102e2966;z-index:11;border:0}.aw-menu{display:inline-block}.aw-content{padding:20px 16px}.aw-topbar{padding:12px 16px;gap:8px}.aw-topbar small{display:none}.aw-heading h1{font-size:24px}.aw-topbar .aw-actions{gap:5px}.aw-button{padding:8px;font-size:11px!important}.aw-footer{padding:16px}.aw-skip:focus{left:16px}}
    `}</style>
      <a className="aw-skip" href="#admin-main">
        {t("Skip to content")}
      </a>
      <button
        aria-label={t("Close navigation")}
        className={"aw-overlay " + (open ? "aw-open" : "")}
        onClick={() => setOpen(false)}
        tabIndex={-1}
      />
      <aside
        className={"aw-sidebar " + (open ? "aw-open" : "")}
        aria-label={t("Admin navigation")}
      >
        <div className="aw-brand">ANVIRA</div>
        <div className="aw-caption">{t("Operations workspace")}</div>
        <nav aria-label={t("Workspace pages")}>
          {groups.map((group) => (
            <section className="aw-group" key={group.label}>
              <h2>{t(group.label)}</h2>
              {group.items.map(([key, label]) => (
                <a
                  key={key}
                  className="aw-link"
                  href={"/dashboard/" + key}
                  title={
                    counts[key] ? counts[key] + " " + t("waiting") : undefined
                  }
                  aria-current={
                    active === key ||
                    (key === "bookings" && path.startsWith("/booking/"))
                      ? "page"
                      : undefined
                  }
                  onClick={(event) => {
                    if (
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey &&
                      event.button === 0
                    ) {
                      event.preventDefault();
                      navigate("/dashboard/" + key);
                    }
                  }}
                >
                  <span>{t(label)}</span>
                  {!!counts[key] && (
                    <span className="aw-count" aria-hidden="true">
                      {counts[key] > 99 ? "99+" : counts[key]}
                    </span>
                  )}
                </a>
              ))}
            </section>
          ))}
        </nav>
        <div className="aw-user">
          <strong>{state.user.name}</strong>
          {t(
            state.user.role === "owner"
              ? "Admin / Owner"
              : "Customer Associate",
          )}
          <br />
          <button
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            {t("Sign out")}
          </button>
        </div>
      </aside>
      <div className="aw-body">
        <header className="aw-topbar">
          <button
            className="aw-button aw-menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {t("Menu")}
          </button>
          <small>
            {t(state.mode === "demo" ? "Demo workspace" : "ANVIRA workspace")}
          </small>
          <LiveClock />
          <div className="aw-actions">
            <button
              className="aw-button"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await refresh();
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              {t(refreshing ? "Refreshing…" : "Refresh updates")}
            </button>
            <button
              className="aw-button"
              aria-label={t("Notifications")}
              onClick={() => navigate("/notifications")}
            >
              {t("Notifications")}
              {state.notifications.some((n) => !n.read) ? " •" : ""}
            </button>
            <button
              className="aw-button"
              aria-label={t("Switch language")}
              onClick={() => setLang(lang === "en" ? "te" : "en")}
            >
              {lang === "en" ? "తెలుగు" : "English"}
            </button>
          </div>
        </header>
        <main id="admin-main" className="aw-content" key={path} tabIndex={-1}>
          <div className="aw-page">
            <div className="aw-heading">
              {back && (
                <button
                  className="aw-button"
                  onClick={
                    onBack ||
                    (() =>
                      router.canGoBack()
                        ? router.back()
                        : navigate("/dashboard/bookings"))
                  }
                >
                  {t("Back")}
                </button>
              )}
              <h1>{t(title || "Overview")}</h1>
              {adminPageGuidance[active] && (
                <p>{t(adminPageGuidance[active])}</p>
              )}
            </div>
            {!!error && (
              <div className="aw-error" role="alert">
                {t(error)}
                {reauthRequired && (
                  <button className="aw-button" onClick={logout}>
                    {t("Sign in again")}
                  </button>
                )}
                <button className="aw-button" onClick={clearError}>
                  {t("Dismiss")}
                </button>
              </div>
            )}
            <BookingAlertBanner />
            {children}
          </div>
        </main>
        {footer && <div className="aw-footer">{footer}</div>}
      </div>
    </div>
  );
}
