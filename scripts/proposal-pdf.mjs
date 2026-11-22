// Renders PROPOSAL.md (with docs/img/ screenshots) to PROPOSAL.pdf through headless Chrome.
import {readFileSync, writeFileSync, rmSync} from "node:fs";
import {resolve} from "node:path";
import MarkdownIt from "markdown-it";
import {chromium} from "playwright-core";

const body = new MarkdownIt({html: true}).render(readFileSync("PROPOSAL.md", "utf8"))
  .replace(/<pre><code>(\s*build time)/, '<pre class="diagram"><code>$1'); // the architecture diagram must not wrap
const css = `
@page {size: Letter; margin: 18mm 16mm 20mm}
body {font: 10.5pt/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1b1e23; max-width: none}
h1 {font-size: 22pt; margin: 0 0 4pt; line-height: 1.2}
h2 {font-size: 15pt; margin: 22pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #ddd; break-after: avoid}
h3 {font-size: 12pt; margin: 16pt 0 4pt; break-after: avoid}
h2#tldr + ul, h2:first-of-type + ul {background: #f3f6fd; border-left: 4px solid #4269d0; padding: 8pt 12pt 8pt 26pt}
p, li {orphans: 3; widows: 3}
code {font: 9pt/1.4 "SF Mono", Menlo, monospace; background: #f3f3f3; padding: 0 2pt; border-radius: 3px}
pre {background: #f6f6f6; padding: 8pt; border-radius: 4px; white-space: pre-wrap; break-inside: avoid}
pre.diagram {white-space: pre; overflow: hidden}
pre.diagram code {font-size: 6.4pt}
pre code {background: none; padding: 0; font-size: 8.3pt}
table {border-collapse: collapse; width: 100%; font-size: 9pt; margin: 8pt 0; break-inside: auto}
th, td {border-bottom: 1px solid #e3e3e3; padding: 4pt 6pt; text-align: left; vertical-align: top}
th {border-bottom: 2px solid #bbb}
tr {break-inside: avoid}
img {display: block; max-width: 88%; max-height: 118mm; margin: 10pt auto 2pt; border: 1px solid #e3e3e3; border-radius: 4px; break-inside: avoid}
p:has(> img) {break-inside: avoid; break-after: avoid}
p > em:only-child, img + br + em {font-size: 9pt; color: #555}
hr {border: none; margin: 6pt 0}
a {color: #4269d0; text-decoration: none}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SuperDB for Observable Framework: a proposal</title><style>${css}</style></head><body>${body}</body></html>`;
writeFileSync("PROPOSAL.tmp.html", html);
const browser = await chromium.launch({channel: "chrome"});
const page = await browser.newPage();
await page.goto("file://" + resolve("PROPOSAL.tmp.html"), {waitUntil: "load"});
await page.pdf({path: "PROPOSAL.pdf", format: "Letter", printBackground: true, displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font: 8px Helvetica, Arial; color: #888; width: 100%; padding: 0 16mm; display: flex; justify-content: space-between"><span>SuperDB for Observable Framework: a proposal</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`});
await browser.close();
rmSync("PROPOSAL.tmp.html");
