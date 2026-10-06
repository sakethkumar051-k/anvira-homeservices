import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { demoUsers } from "./seed.mjs";
import { fail, assertRole } from "./errors.mjs";
export function authentication(cfg, store, firebaseAuth) {
  const sessions = new Map(),
    cookieName = cfg.production ? "__session" : "anvira-session";
  const cookieOptions = {
    httpOnly: true,
    secure: cfg.production,
    sameSite: "strict",
    path: "/",
    maxAge: 5 * 86400000,
  };
  function originAllowed(origin) {
    return !origin
      ? false
      : cfg.origins.includes(origin) ||
          (!cfg.production &&
            /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
              origin,
            ));
  }
  const csrfToken = (value) => createHash("sha256").update(value).digest("hex");
  function validateCsrf(req) {
    const cookie = req.cookies?.[cookieName],
      header = req.get("x-csrf-token");
    if (
      !originAllowed(req.get("origin")) ||
      typeof cookie !== "string" ||
      typeof header !== "string" ||
      !/^[a-f0-9]{64}$/.test(header) ||
      !timingSafeEqual(
        Buffer.from(csrfToken(cookie), "hex"),
        Buffer.from(header, "hex"),
      )
    )
      fail(403, "Refresh the page and try again.", "CSRF_FAILED");
  }
  function csrf(req, res) {
    let cookie = req.cookies?.[cookieName];
    if (!cookie) {
      cookie = "preauth." + randomBytes(32).toString("hex");
      res.cookie(cookieName, cookie, cookieOptions);
    }
    res.set("Cache-Control", "no-store");
    res.json({ token: csrfToken(cookie) });
  }
  async function session(req, res) {
    if (!cfg.live) {
      for (const [id, session] of sessions)
        if (session.expires < Date.now()) sessions.delete(id);
      if (sessions.size >= 10000) fail(429, "Demo session capacity reached.");
      const profile =
        req.body.role === "professional" && req.body.professionalId === "pro-2"
          ? { id: "pro-2", name: "Suresh Reddy", role: "professional" }
          : demoUsers[req.body.role];
      if (!profile) fail(400, "Choose a valid demo role.");
      const token = randomBytes(32).toString("hex");
      sessions.set(token, {
        user: profile,
        expires: Date.now() + 12 * 3600000,
      });
      res.json({ token, user: profile, mode: "demo" });
      return;
    }
    validateCsrf(req);
    const idToken = req.body.idToken;
    if (typeof idToken !== "string" || idToken.length > 10000)
      fail(400, "Missing identity token.");
    let claims;
    try {
      claims = await firebaseAuth.verifyIdToken(idToken, true);
    } catch {
      fail(401, "Sign in again to continue.", "AUTH_REQUIRED");
    }
    if (Date.now() / 1000 - claims.auth_time > 300)
      fail(401, "A recent sign-in is required.", "RECENT_LOGIN_REQUIRED");
    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, {
      expiresIn: 5 * 86400000,
    });
    res.cookie(cookieName, sessionCookie, cookieOptions);
    res.json({ ok: true, mode: "firebase" });
  }
  async function middleware(req, res, next) {
    try {
      let identity, authTime, stored;
      if (!cfg.live) {
        const s = sessions.get(
          req.get("authorization")?.replace(/^Bearer /, ""),
        );
        if (!s || s.expires < Date.now())
          fail(401, "Session expired. Please sign in again.", "AUTH_REQUIRED");
        identity = s.user;
      } else {
        const bearer = req.get("authorization")?.replace(/^Bearer /, "");
        let decoded;
        try {
          decoded = bearer
            ? await firebaseAuth.verifyIdToken(bearer, true)
            : await firebaseAuth.verifySessionCookie(
                req.cookies?.[cookieName] || "",
                true,
              );
        } catch {
          fail(401, "Session expired. Please sign in again.", "AUTH_REQUIRED");
        }
        if (!bearer && !["GET", "HEAD", "OPTIONS"].includes(req.method))
          validateCsrf(req);
        identity = {
          id: decoded.uid,
          name: decoded.name || "ANVIRA customer",
          phone: "",
          phoneVerified: false,
          email: decoded.email || "",
          emailVerified: decoded.email_verified === true,
          signInProvider: decoded.firebase?.sign_in_provider || "",
          role: "customer",
        };
        authTime = decoded.auth_time;
        const record = await store.get("users", identity.id);
        stored = record;
        if (record?.active === false)
          fail(
            403,
            "This account is disabled. Contact support.",
            "ACCOUNT_DISABLED",
          );
        if (record && ["owner", "care"].includes(record.role)) {
          if (decoded.role !== record.role)
            fail(
              403,
              "Refresh your staff sign-in to continue.",
              "STAFF_CLAIM_MISMATCH",
            );
          identity.role = record.role;
        } else if (record?.role === "professional")
          identity.role = "professional";
        identity.name = record?.name || identity.name;
        identity.phone = record?.phone || "";
      }
      if (!cfg.live) stored = await store.get("users", identity.id);
      if (stored?.active === false)
        fail(
          403,
          "This account is disabled. Contact support.",
          "ACCOUNT_DISABLED",
        );
      req.user = {
        ...identity,
        ...(!cfg.live && stored
          ? { name: stored.name, role: stored.role }
          : {}),
        authTime,
      };
      req.user.primaryRole = req.user.role;
      if (
        req.user.primaryRole === "professional" &&
        req.get("x-anvira-workspace") === "customer"
      )
        req.user.role = "customer";
      if (!stored)
        await store.transaction(async (tx) => {
          if (!(await tx.get("users", identity.id)))
            tx.put("users", {
              ...identity,
              role: identity.role,
              active: true,
              createdAt: Date.now(),
            });
        });
      next();
    } catch (e) {
      next(e);
    }
  }
  function logout(req, res) {
    res.clearCookie(cookieName, cookieOptions);
    const token = req.get("authorization")?.replace(/^Bearer /, "");
    sessions.delete(token);
    res.json({ ok: true });
  }
  async function recent(req) {
    if (
      cfg.live &&
      (!req.user.authTime || Date.now() / 1000 - req.user.authTime > 300)
    )
      fail(401, "A recent sign-in is required.", "RECENT_LOGIN_REQUIRED");
  }
  return {
    session,
    csrf,
    middleware,
    logout,
    recent,
    originAllowed,
    cookieName,
  };
}
