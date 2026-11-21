// Bilingual site: English pages at the root (default), French pages under /fr with the same slugs.
const pages = {
  en: [
    ["GitHub Archive (GHA)", "gha"],
    ["Bluesky (JSONBench)", "bluesky"],
    ["ClickBench (hits_0)", "clickbench"],
    ["Quebec municipalities", "quebec"],
    ["SuperDB vs DuckDB", "duckdb"],
    ["Heterogeneous or homogeneous?", "comparison"],
    ["Live SuperSQL", "query"],
    ["BSUP demo", ""],
    ["Benchmark", "bench"]
  ],
  fr: [
    ["GitHub Archive (GHA)", "gha"],
    ["Bluesky (JSONBench)", "bluesky"],
    ["ClickBench (hits_0)", "clickbench"],
    ["Municipalités du Québec", "quebec"],
    ["SuperDB ou DuckDB", "duckdb"],
    ["Hétérogène ou homogène ?", "comparison"],
    ["SuperSQL en direct", "query"],
    ["Démo BSUP", ""],
    ["Banc d'essai", "bench"]
  ]
};

// "/fr/gha" → {lang: "fr", slug: "gha"}; "/index" → {lang: "en", slug: ""}
function parse(path) {
  const m = /^\/(?:(fr)(?:\/|$))?(.*)$/.exec(path);
  return {lang: m[1] ?? "en", slug: m[2].replace(/(^|\/)index$/, "")};
}

export default {
  root: "src",
  title: "SuperDB for Observable Framework — prototype",
  pages: [
    {name: "English", collapsible: true, open: false, pages: pages.en.map(([name, slug]) => ({name, path: `/${slug}`}))},
    {name: "Français", collapsible: true, open: false, pages: pages.fr.map(([name, slug]) => ({name, path: `/fr/${slug}`}))}
  ],
  pager: false,
  header: ({path}) => {
    const {lang, slug} = parse(path);
    const other = lang === "fr" ? {href: `/${slug}`, label: "English", hreflang: "en"} : {href: `/fr/${slug}`, label: "Français", hreflang: "fr"};
    return `<div class="lang-switch"><a href="${other.href}" hreflang="${other.hreflang}" lang="${other.hreflang}">${other.label}</a></div>`;
  },
  footer: ({path}) =>
    parse(path).lang === "fr"
      ? `Prototype construit avec <a href="https://observablehq.com/framework/" target="_blank">Observable Framework</a> et SuperDB.`
      : `Prototype built with <a href="https://observablehq.com/framework/" target="_blank">Observable Framework</a> and SuperDB.`,
  head: `<style>
#observablehq-header { justify-content: flex-end; }
.lang-switch a { font-size: 0.9rem; padding: 0.15rem 0.6rem; border: 1px solid var(--theme-foreground-faint); border-radius: 999px; text-decoration: none; }
</style>`
};
