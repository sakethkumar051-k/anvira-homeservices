const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const existing = config.resolver.blockList;
const root = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Expo's development env context discovers every root .env* file, but its
// transformer only parses the supported names below. Keep legacy CLI/server
// variants out of that context without deleting or importing their contents.
const unsupportedEnvironmentFiles = new RegExp(
  "^" +
    root +
    "[/\\\\]\\.env\\.(?!(?:local|(?:development|production)(?:\\.local)?)$)[^/\\\\]+$",
);
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  unsupportedEnvironmentFiles,
];

module.exports = config;
