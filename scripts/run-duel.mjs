// SuperDB vs DuckDB: same data, same questions, each engine with its default settings, best of three.
// A failure or a wrong result is a result: it is recorded, never worked around.
// Usage: node scripts/run-duel.mjs [gha bluesky clickbench]   → NDJSON on stdout.
// Needs scripts/get-{gha,bluesky,clickbench,duckdb}.sh.
import {execFileSync} from "node:child_process";
import {statSync} from "node:fs";

const SUPER = "bin/super";
const runSuper = (file, query) => [SUPER, ["-dynamic", "-s", "-c", query.replaceAll("$F", `'${file}'`)]];
const runDuck = (file, query, table) =>
  file.endsWith(".duckdb")
    ? ["duckdb", ["-no-agent", "-readonly", "-csv", file, "-c", query.replaceAll("$F", table)]]
    : ["duckdb", ["-no-agent", "-csv", "-c", query.replaceAll("$F", `'${file}'`)]];

const phrase = "in case you have any feedback 😊";
const datasets = {
  gha: {
    table: "gha",
    files: {
      superdb: [["json.gz", "raw/gha/ghasample.json.gz"], ["bsup", "raw/gha/ghasample.bsup"], ["parquet", "raw/gha/ghasample.parquet"]],
      duckdb: [["json.gz", "raw/gha/ghasample.json.gz"], ["duckdb", "raw/duckdb/gha.duckdb"], ["parquet", "raw/gha/ghasample.parquet"]]
    },
    queries: {
      search: {
        superdb: `SELECT count() FROM $F WHERE grep('${phrase}', payload.pull_request.body)`,
        duckdb: `SELECT count(*) FROM $F WHERE payload.pull_request.body LIKE '%${phrase}%'`
      },
      "search+": {
        superdb: `SELECT count() FROM $F WHERE grep('${phrase}', this)`,
        duckdb: `SELECT count(*) FROM $F AS t WHERE t::VARCHAR LIKE '%${phrase}%'`
      },
      count: {
        superdb: "SELECT count() FROM $F WHERE actor.login='johnbieren'",
        duckdb: "SELECT count(*) FROM $F WHERE actor.login='johnbieren'"
      },
      agg: {
        superdb: "SELECT count(),type FROM $F WHERE repo.name='duckdb/duckdb' GROUP BY type",
        duckdb: "SELECT count(*),type FROM $F WHERE repo.name='duckdb/duckdb' GROUP BY type"
      },
      union: {
        superdb: `FROM $F
| UNNEST [...payload.pull_request.assignees, payload.pull_request.assignee]
| WHERE this IS NOT NULL
| AGGREGATE count() BY assignee:=login
| ORDER BY count DESC, assignee ASC
| LIMIT 5`,
        duckdb: `WITH assignees AS (
  SELECT payload.pull_request.assignee.login assignee FROM $F
  UNION ALL
  SELECT unnest(payload.pull_request.assignees).login assignee FROM $F
)
SELECT assignee, count(*) count FROM assignees
WHERE assignee IS NOT NULL
GROUP BY assignee ORDER BY count DESC, assignee ASC LIMIT 5`
      }
    }
  },
  bluesky: {
    table: "bluesky",
    files: {
      superdb: [["json.gz", "raw/bluesky/file_0001.json.gz"], ["bsup", "raw/bluesky/bluesky.bsup"], ["parquet", "raw/bluesky/bluesky-sansrecord.parquet", "no-record"]],
      duckdb: [["json.gz", "raw/bluesky/file_0001.json.gz"], ["duckdb", "raw/duckdb/bluesky.duckdb"], ["parquet", "raw/bluesky/bluesky-sansrecord.parquet", "no-record"]]
    },
    queries: {
      q1: {
        superdb: "SELECT commit.collection AS event, count() AS count FROM $F GROUP BY event ORDER BY count DESC",
        duckdb: "SELECT commit.collection AS event, count(*) AS count FROM $F GROUP BY event ORDER BY count DESC"
      },
      q2: {
        superdb: `SELECT commit.collection AS event, count() AS count, count(DISTINCT did) AS users FROM $F
WHERE kind = 'commit' AND commit.operation = 'create' GROUP BY event ORDER BY count DESC`,
        duckdb: `SELECT commit.collection AS event, count(*) AS count, count(DISTINCT did) AS users FROM $F
WHERE kind = 'commit' AND commit.operation = 'create' GROUP BY event ORDER BY count DESC`
      },
      q3: {
        superdb: `SELECT commit.collection AS event, date_part('hour', (time_us*1000)::timestamp) AS hour_of_day, count() AS count FROM $F
WHERE kind = 'commit' AND commit.operation = 'create'
  AND commit.collection IN ['app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.like']
GROUP BY event, hour_of_day ORDER BY hour_of_day, event`,
        duckdb: `SELECT commit.collection AS event, hour(make_timestamp(time_us)) AS hour_of_day, count(*) AS count FROM $F
WHERE kind = 'commit' AND commit.operation = 'create'
  AND commit.collection IN ('app.bsky.feed.post', 'app.bsky.feed.repost', 'app.bsky.feed.like')
GROUP BY event, hour_of_day ORDER BY hour_of_day, event`
      },
      q4: {
        superdb: `SELECT did AS user_id, min(time_us) AS first_post_ts FROM $F
WHERE kind = 'commit' AND commit.operation = 'create' AND commit.collection = 'app.bsky.feed.post'
GROUP BY user_id ORDER BY first_post_ts ASC LIMIT 3`,
        duckdb: `SELECT did AS user_id, min(time_us) AS first_post_ts FROM $F
WHERE kind = 'commit' AND commit.operation = 'create' AND commit.collection = 'app.bsky.feed.post'
GROUP BY user_id ORDER BY first_post_ts ASC LIMIT 3`
      },
      q5: {
        superdb: `SELECT did AS user_id, (max(time_us) - min(time_us)) / 1000 AS activity_span_ms FROM $F
WHERE kind = 'commit' AND commit.operation = 'create' AND commit.collection = 'app.bsky.feed.post'
GROUP BY user_id ORDER BY activity_span_ms DESC LIMIT 3`,
        duckdb: `SELECT did AS user_id, (max(time_us) - min(time_us)) // 1000 AS activity_span_ms FROM $F
WHERE kind = 'commit' AND commit.operation = 'create' AND commit.collection = 'app.bsky.feed.post'
GROUP BY user_id ORDER BY activity_span_ms DESC LIMIT 3`
      }
    }
  },
  clickbench: {
    table: "hits",
    files: {
      superdb: [["bsup", "raw/clickbench/hits.bsup"], ["parquet", "raw/clickbench/hits-super.parquet", "super"], ["parquet", "raw/clickbench/hits_0.parquet", "clickhouse"]],
      duckdb: [["duckdb", "raw/duckdb/clickbench.duckdb"], ["parquet", "raw/clickbench/hits-super.parquet", "super"], ["parquet", "raw/clickbench/hits_0.parquet", "clickhouse"]]
    },
    queries: {
      Q0: {superdb: "SELECT count() FROM $F", duckdb: "SELECT count(*) FROM $F"},
      Q2: {
        superdb: "SELECT sum(AdvEngineID), count(), avg(ResolutionWidth) FROM $F",
        duckdb: "SELECT sum(AdvEngineID), count(*), avg(ResolutionWidth) FROM $F"
      },
      Q5: {superdb: "SELECT count(DISTINCT SearchPhrase) FROM $F", duckdb: "SELECT count(DISTINCT SearchPhrase) FROM $F"},
      Q8: {
        superdb: "SELECT RegionID, count(DISTINCT UserID) AS u FROM $F GROUP BY RegionID ORDER BY u DESC LIMIT 10",
        duckdb: "SELECT RegionID, count(DISTINCT UserID) AS u FROM $F GROUP BY RegionID ORDER BY u DESC LIMIT 10"
      },
      Q12: {
        superdb: "SELECT SearchPhrase, count() AS c FROM $F WHERE SearchPhrase <> '' GROUP BY SearchPhrase ORDER BY c DESC LIMIT 10",
        duckdb: "SELECT SearchPhrase, count(*) AS c FROM $F WHERE SearchPhrase <> '' GROUP BY SearchPhrase ORDER BY c DESC LIMIT 10"
      },
      Q20: {superdb: "SELECT count() FROM $F WHERE URL LIKE '%google%'", duckdb: "SELECT count(*) FROM $F WHERE URL LIKE '%google%'"},
      Q33: {
        superdb: "SELECT URL, count() AS c FROM $F GROUP BY URL ORDER BY c DESC LIMIT 10",
        duckdb: "SELECT URL, count(*) AS c FROM $F GROUP BY URL ORDER BY c DESC LIMIT 10"
      }
    }
  }
};

// Engines print results differently (SUP vs CSV); compare the multiset of numbers they contain.
const signature = (text, engine) => {
  if (engine === "duckdb") text = text.split("\n").slice(1).join("\n");
  else text = text.replace(/::\w+/g, "");
  return (text.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi) ?? []).map(Number).map((n) => +n.toPrecision(9)).sort((a, b) => a - b).join(" ");
};

const versions = {
  superdb: execFileSync(SUPER, ["-version"]).toString().trim().replace(/^Version: /, ""),
  duckdb: execFileSync("duckdb", ["-no-agent", "--version"]).toString().trim().split(" ")[0]
};
const names = process.argv.slice(2);
for (const dataset of names.length ? names : Object.keys(datasets)) {
  const {table, files, queries} = datasets[dataset];
  const rows = [];
  for (const engine of ["superdb", "duckdb"]) {
    for (const [format, file, variant = null] of files[engine]) {
      for (const [test, q] of Object.entries(queries)) {
        let ms = Infinity, result = "", error = null, bytes = null;
        try {
          bytes = statSync(file).size;
        } catch {
          error = "no native database: ingestion failed";
        }
        for (let i = 0; i < 3 && !error; i++) {
          const [cmd, args] = engine === "superdb" ? runSuper(file, q.superdb) : runDuck(file, q.duckdb, table);
          const t = performance.now();
          try {
            result = execFileSync(cmd, args, {stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26}).toString().trim();
          } catch (e) {
            error = (e.stderr?.toString() || String(e)).trim().split("\n").find((l) => l.trim()) ?? String(e);
            break;
          }
          ms = Math.min(ms, performance.now() - t);
        }
        rows.push({dataset, test, engine, format, variant, file: file.split("/").pop(), bytes,
          ms: error ? null : Math.round(ms), sig: error ? null : signature(result, engine), result, error,
          query: q[engine].replaceAll("$F", engine === "duckdb" && format === "duckdb" ? table : `'${dataset}.${format}'`), version: versions[engine]});
      }
    }
  }
  const reference = new Map(rows.filter((d) => d.engine === "superdb" && d.format === "bsup").map((d) => [d.test, d.sig]));
  for (const {sig, ...d} of rows) console.log(JSON.stringify({...d, same: sig === null ? null : sig === reference.get(d.test)}));
}
