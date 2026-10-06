export function websiteConfig(env) {
  const api = new URL(env.ANVIRA_API_ORIGIN || "https://api.example.invalid");
  if (
    api.protocol !== "https:" ||
    api.username ||
    api.password ||
    api.pathname !== "/" ||
    api.search ||
    api.hash ||
    /localhost|example\.invalid|127\.0\.0\.1/.test(api.hostname)
  )
    throw new Error(
      "Set ANVIRA_API_ORIGIN to the public HTTPS API origin before deploying.",
    );
  if (!["demo", "firebase"].includes(env.EXPO_PUBLIC_AUTH_MODE))
    throw new Error(
      "Set EXPO_PUBLIC_AUTH_MODE to demo or firebase explicitly.",
    );
  const csp =
    "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseapp.com; frame-src https://*.firebaseapp.com https://accounts.google.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
  return {
    framework: null,
    installCommand: "npm ci",
    buildCommand: "npm run build:website",
    outputDirectory: "dist",
    redirects: [{ source: "/", destination: "/welcome", permanent: false }],
    rewrites: [
      { source: "/api/:path*", destination: api.origin + "/api/:path*" },
      {
        source: "/payment-checkout/:path*",
        destination: api.origin + "/payment-checkout/:path*",
      },
      {
        source: "/checkout/:token([a-f0-9]{64})",
        destination: api.origin + "/checkout/:token",
      },
      { source: "/:path*", destination: "/index.html" },
    ],
    headers: [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source:
          "/:path((?!api(?:/|$)|payment-checkout(?:/|$)|checkout/[a-f0-9]{64}(?:/|$)).*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/_expo/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ],
  };
}
