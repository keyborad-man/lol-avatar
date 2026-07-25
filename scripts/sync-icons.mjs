import { mkdir, writeFile } from "node:fs/promises";

const versionsSource = "https://ddragon.leagueoflegends.com/api/versions.json";
const output = new URL("../data/icons.js", import.meta.url);

const versionsResponse = await fetch(versionsSource);
if (!versionsResponse.ok) {
  throw new Error(`Data Dragon versions request failed: ${versionsResponse.status} ${versionsResponse.statusText}`);
}

const versions = await versionsResponse.json();
const version = versions[0];
if (typeof version !== "string") {
  throw new TypeError("Expected Data Dragon to return a latest version string.");
}

const source = `https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/profileicon.json`;
const response = await fetch(source);
if (!response.ok) {
  throw new Error(`Data Dragon profile icon request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
if (!payload.data || typeof payload.data !== "object") {
  throw new TypeError("Expected Data Dragon to return a data object.");
}

const ids = [...new Set(Object.keys(payload.data).map(Number))]
  .filter((id) => Number.isInteger(id) && id >= 0)
  .sort((a, b) => b - a);

if (ids.length < 1000) {
  throw new Error(`Only ${ids.length} icon IDs were returned; refusing to replace the archive.`);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  output,
  `// Generated from Riot Data Dragon. Run: node scripts/sync-icons.mjs\nwindow.DATA_DRAGON_VERSION = ${JSON.stringify(version)};\nwindow.PROFILE_ICON_IDS = ${JSON.stringify(ids)};\n`,
  "utf8",
);

console.log(`Wrote ${ids.length} icon IDs from Data Dragon ${version} to data/icons.js.`);
