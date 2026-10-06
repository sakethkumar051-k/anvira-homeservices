import { websiteConfig } from "./deployment/vercel-config.mjs";
export const config = websiteConfig(process.env);
