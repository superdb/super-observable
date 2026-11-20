// Labels for the language-neutral codes written by the data loaders (scripts/run-bench.mjs, scripts/sizes.sh).
const formats = {"json.gz": "JSON (gzip)", bsup: "BSUP", parquet: "Parquet"};

const variants = {
  en: {full: "full", "no-record": "without commit.record", fused: "fused", projection: "projection", super: "written by super", clickhouse: "original (ClickHouse)"},
  fr: {full: "complet", "no-record": "sans commit.record", fused: "fusionné", projection: "projection", super: "écrit par super", clickhouse: "d'origine (ClickHouse)"}
};

export const datasetNames = {gha: "GHA Sample", bluesky: "Bluesky (JSONBench)", clickbench: "ClickBench (hits_0)"};

export const locales = {en: "en-US", fr: "fr-CA"};

// Municipality kinds written by src/data/quebec/municipalities.bsup.sh, in a fixed color order.
export const kinds = ["city", "municipality", "parish", "township", "village", "indigenous", "unorganized", "other"];
const kindNames = {
  en: {city: "City or town", municipality: "Municipality", parish: "Parish", township: "Township", village: "Village",
    indigenous: "Indigenous community", unorganized: "Unorganized territory", other: "Regional government"},
  fr: {city: "Ville", municipality: "Municipalité", parish: "Paroisse", township: "Canton", village: "Village",
    indigenous: "Communauté autochtone", unorganized: "Territoire non organisé", other: "Gouvernement régional"}
};

export function i18n(lang) {
  const locale = locales[lang];
  const variant = (v) => variants[lang][v] ?? v;
  return {
    locale,
    format: (f) => formats[f] ?? f,
    variant,
    // "Parquet (fused)", "BSUP"…
    kind: (k) => kindNames[lang][k] ?? k,
    fileLabel: (d) => (formats[d.format] ?? d.format) + (d.variant ? ` (${variant(d.variant)})` : ""),
    number: (d) => d.toLocaleString(locale),
    mb: (d, digits = 1) => (d / 1e6).toLocaleString(locale, {maximumFractionDigits: digits}) + (lang === "fr" ? " Mo" : " MB"),
    pct: (x) => (100 * x).toLocaleString(locale, {maximumFractionDigits: 0}) + (lang === "fr" ? " %" : "%")
  };
}
