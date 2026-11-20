// Benchmark: same queries, same engine (`super`), different file formats.
// Usage: node scripts/run-bench.mjs gha bluesky clickbench   → NDJSON on stdout.
// Each query is a template where $F is replaced by the file path; best of three runs.
import {execFileSync} from "node:child_process";
import {statSync} from "node:fs";

const S = "bin/super";

const datasets = {
  // Heterogeneous: one shape per event. Queries from the performance tutorial (book/src/tutorials/performance.md).
  gha: {
    files: [
      {format: "bsup", file: "raw/gha/ghasample.bsup"},
      {format: "parquet", variant: "fused", file: "raw/gha/ghasample.parquet"}
    ],
    queries: {
      search: "SELECT count() FROM '$F' WHERE grep('in case you have any feedback 😊', payload.pull_request.body)",
      "search+": "SELECT count() FROM '$F' WHERE grep('in case you have any feedback 😊', this)",
      count: "SELECT count() FROM '$F' WHERE actor.login='johnbieren'",
      agg: "SELECT count(),type FROM '$F' WHERE repo.name='duckdb/duckdb' GROUP BY type",
      union: `FROM '$F'
| UNNEST [...payload.pull_request.assignees, payload.pull_request.assignee]
| WHERE this IS NOT NULL
| AGGREGATE count() BY assignee:=login
| ORDER BY count DESC, assignee ASC
| LIMIT 5`
    }
  },
  // Semi-structured: 565 shapes for 1M events. JSONBench queries q1–q5 (issue #7484).
  bluesky: {
    files: [
      {format: "bsup", variant: "full", file: "raw/bluesky/bluesky.bsup"},
      {format: "bsup", variant: "no-record", file: "raw/bluesky/bluesky-sansrecord.bsup"},
      {format: "parquet", variant: "no-record", file: "raw/bluesky/bluesky-sansrecord.parquet"}
    ],
    queries: {
      q1: `SELECT commit.collection AS event, count() AS count FROM '$F'
GROUP BY event ORDER BY count DESC`,
      q2: `SELECT commit.collection AS event, count() AS count, count(DISTINCT did) AS users FROM '$F'
WHERE kind = 'commit' AND commit.operation = 'create'
GROUP BY event ORDER BY count DESC`,
      q3: `SELECT commit.collection AS event, date_part('hour', (time_us*1000)::timestamp) AS hour_of_day, count() AS count
FROM '$F'
WHERE kind = 'commit' AND commit.operation = 'create'
  AND commit.collection IN ['app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.like']
GROUP BY event, hour_of_day ORDER BY hour_of_day, event`,
      q4: `SELECT did AS user_id, min(time_us) AS first_post_ts FROM '$F'
WHERE kind = 'commit' AND commit.operation = 'create' AND commit.collection = 'app.bsky.feed.post'
GROUP BY user_id ORDER BY first_post_ts ASC LIMIT 3`,
      q5: `SELECT did AS user_id, (max(time_us) - min(time_us)) / 1000 AS activity_span_ms FROM '$F'
WHERE kind = 'commit' AND commit.operation = 'create' AND commit.collection = 'app.bsky.feed.post'
GROUP BY user_id ORDER BY activity_span_ms DESC LIMIT 3`
    }
  },
  // Flat and homogeneous: one shape, 105 columns. ClickBench queries (original numbering).
  clickbench: {
    files: [
      {format: "bsup", file: "raw/clickbench/hits.bsup"},
      {format: "parquet", variant: "super", file: "raw/clickbench/hits-super.parquet"},
      {format: "parquet", variant: "clickhouse", file: "raw/clickbench/hits_0.parquet"}
    ],
    queries: {
      Q0: "SELECT count() FROM '$F'",
      Q2: "SELECT sum(AdvEngineID), count(), avg(ResolutionWidth) FROM '$F'",
      Q5: "SELECT count(DISTINCT SearchPhrase) FROM '$F'",
      Q8: "SELECT RegionID, count(DISTINCT UserID) AS u FROM '$F' GROUP BY RegionID ORDER BY u DESC LIMIT 10",
      Q12: "SELECT SearchPhrase, count() AS c FROM '$F' WHERE SearchPhrase <> '' GROUP BY SearchPhrase ORDER BY c DESC LIMIT 10",
      Q20: "SELECT count() FROM '$F' WHERE URL LIKE '%google%'",
      Q33: "SELECT URL, count() AS c FROM '$F' GROUP BY URL ORDER BY c DESC LIMIT 10"
    }
  }
};

const version = execFileSync(S, ["-version"]).toString().trim().replace(/^Version: /, "");
const names = process.argv.slice(2);
for (const dataset of names.length ? names : Object.keys(datasets)) {
  const {files, queries} = datasets[dataset];
  for (const {format, variant = null, file} of files) {
    for (const [test, template] of Object.entries(queries)) {
      const query = template.replaceAll("$F", file);
      let ms = Infinity, result = "", error = null;
      for (let i = 0; i < 3; i++) {
        const t = performance.now();
        try {
          result = execFileSync(S, ["-dynamic", "-s", "-c", query], {stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26}).toString().trim();
        } catch (e) {
          error = (e.stderr?.toString() || String(e)).trim().split("\n")[0];
          break;
        }
        ms = Math.min(ms, performance.now() - t);
      }
      console.log(JSON.stringify({dataset, test, format, variant, file: file.split("/").pop(), bytes: statSync(file).size,
        ms: error ? null : Math.round(ms), result, error, query: template.replaceAll("$F", dataset + "." + format), version}));
    }
  }
}
