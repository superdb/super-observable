// SuperDBClient : le moteur SuperDB (Go → wasm) dans un Web Worker, pour Observable Framework.
// Calqué sur DuckDBClient : SuperDBClient.of({nom: source}), db.query(...), db.sql`...`.
// Suit l'interface DatabaseClient d'Observable (query, queryRow, queryStream, describeTables, describeColumns).
import {FileAttachment} from "observablehq:stdlib";
import {decodeBSUP, formatValue, formatTypeValue} from "./super-ts.js";

const WASM = FileAttachment("../lib/super.wasm");
const WASM_EXEC = FileAttachment("../lib/wasm_exec.js");

// Code du worker (worker classique créé depuis un Blob : aucun fichier à résoudre par Framework).
const WORKER = `
const absolute = (u) => new URL(u, self.__base).href;
async function init({base, wasm, wasmExec}) {
  self.__base = base;
  importScripts(absolute(wasmExec));
  // Le stub de wasm_exec.js lève une exception pour cwd() ; Go en a besoin pour résoudre « from ventes ».
  globalThis.process.cwd = () => "/";
  const go = new Go();
  const ready = new Promise((r) => (self.__superdbReady = r));
  const res = await fetch(absolute(wasm));
  if (!res.ok) throw new Error("super.wasm : HTTP " + res.status);
  const {instance} = await WebAssembly.instantiate(await res.arrayBuffer(), go.importObject);
  go.run(instance);
  await ready;
  return self.__superdb.version;
}
const check = (err) => { if (err) throw new Error(err); };
onmessage = async ({data: {id, op, args}}) => {
  try {
    const db = self.__superdb;
    let result, transfer = [];
    switch (op) {
      case "init": result = await init(args); break;
      case "register": check(db.register(args.name, new Uint8Array(args.bytes))); break;
      case "registerURL": {
        const res = await fetch(absolute(args.url));
        if (!res.ok) throw new Error(args.url + " : HTTP " + res.status);
        check(db.register(args.name, new Uint8Array(await res.arrayBuffer())));
        break;
      }
      case "unregister": db.unregister(args.name); break;
      case "names": result = db.names(); break;
      case "run": {
        const t = performance.now();
        const out = await db.run(args.query, args.format);
        result = {bytes: out, ms: performance.now() - t};
        transfer = [out.buffer];
        break;
      }
      default: throw new Error("opération inconnue : " + op);
    }
    postMessage({id, ok: true, result}, transfer);
  } catch (e) {
    postMessage({id, ok: false, error: String(e && e.message || e)});
  }
};`;

export class SuperDBError extends Error {
  constructor(message, query) {
    super(message);
    this.name = "SuperDBError";
    this.query = query;
  }
}

export class SuperDBClient {
  #worker;
  #next = 0;
  #pending = new Map();
  /** Durée (ms) de la dernière requête dans le moteur, hors décodage. */
  lastMs = NaN;

  constructor(worker) {
    this.#worker = worker;
    worker.onmessage = ({data: {id, ok, result, error}}) => {
      const p = this.#pending.get(id);
      this.#pending.delete(id);
      ok ? p.resolve(result) : p.reject(new SuperDBError(error, p.query));
    };
    worker.onerror = (e) => {
      for (const p of this.#pending.values()) p.reject(new SuperDBError(e.message ?? "erreur du worker"));
      this.#pending.clear();
    };
  }

  #call(op, args, transfer = [], query) {
    return new Promise((resolve, reject) => {
      const id = this.#next++;
      this.#pending.set(id, {resolve, reject, query});
      this.#worker.postMessage({id, op, args}, transfer);
    });
  }

  /** Crée un client et enregistre les sources : {nom: FileAttachment | Uint8Array | ArrayBuffer | string | objets[]}. */
  static async of(sources = {}) {
    const blob = new Blob([WORKER], {type: "text/javascript"});
    const db = new SuperDBClient(new Worker(URL.createObjectURL(blob)));
    db.version = await db.#call("init", {base: document.baseURI, wasm: await WASM.url(), wasmExec: await WASM_EXEC.url()});
    await Promise.all(Object.entries(sources).map(([name, source]) => db.register(name, source)));
    return db;
  }

  /** Rend une source interrogeable par `from nom` (format détecté d'après le contenu). */
  async register(name, source) {
    source = await source;
    if (source && typeof source.url === "function" && typeof source.arrayBuffer === "function") {
      return this.#call("registerURL", {name, url: await source.url()}); // FileAttachment : téléchargé par le worker
    }
    let bytes;
    if (typeof source === "string") bytes = new TextEncoder().encode(source);
    else if (source instanceof ArrayBuffer) bytes = new Uint8Array(source.slice(0));
    else if (ArrayBuffer.isView(source)) bytes = new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
    else if (Array.isArray(source)) bytes = new TextEncoder().encode(source.map((d) => JSON.stringify(d)).join("\n"));
    else if (source instanceof Blob || source instanceof Response) bytes = new Uint8Array(await source.arrayBuffer());
    else throw new TypeError(`source non prise en charge pour ${name}`);
    return this.#call("register", {name, bytes: bytes.buffer}, [bytes.buffer]);
  }

  unregister(name) {
    return this.#call("unregister", {name});
  }

  /** Exécute une requête et renvoie les octets bruts dans le format demandé. */
  async run(query, format = "bsup") {
    const {bytes, ms} = await this.#call("run", {query, format}, [], query);
    this.lastMs = ms;
    return bytes;
  }

  /** Résultat sous forme de valeurs super-typées (super-ts). */
  async values(query, params) {
    return decodeBSUP(await this.run(bind(query, params)));
  }

  /** DatabaseClient : tableau d'objets JS, avec .schema et .values (valeurs super-typées). */
  async query(query, params) {
    const values = await this.values(query, params);
    const rows = values.map((v) => v.toJS());
    Object.defineProperty(rows, "values", {value: values});
    rows.schema = schemaOf(rows);
    return rows;
  }

  async queryRow(query, params) {
    return (await this.query(query, params))[0] ?? null;
  }

  async *queryStream(query, params) {
    yield* await this.query(query, params);
  }

  /** Gabarit étiqueté : db.sql`from ventes | where region = ${r}` (valeurs insérées comme littéraux). */
  sql(strings, ...params) {
    return this.query(strings.reduce((q, s, i) => q + literal(params[i - 1]) + s));
  }

  /** Résultat en texte : "sup" (comme super -s), "json", "csv", "tsv"... */
  async text(query, format = "sup") {
    if (format === "sup") return (await this.values(query)).map(formatValue).join("\n");
    return new TextDecoder().decode(await this.run(query, format));
  }

  async describeTables() {
    return (await this.#call("names")).map((name) => ({name}));
  }

  /** Colonnes d'une source : union des champs de toutes ses formes, avec leurs types. */
  async describeColumns({table} = {}) {
    const shapes = await this.values(`from ${ident(table)} | count() by shape:=typeof(this)`);
    const cols = new Map();
    for (const v of shapes) {
      const count = Number(v.get("count").toJS());
      for (const f of recordFields(v.get("shape").value)) {
        const c = cols.get(f.name) ?? {name: f.name, types: new Set(), count: 0};
        c.types.add(f.type);
        c.count += count;
        cols.set(f.name, c);
      }
    }
    return [...cols.values()].map(({name, types, count}) => ({name, type: [...types].join(" | "), count}));
  }

  close() {
    this.#worker.terminate();
  }
}

function recordFields(t) {
  while (t.kind === "named") t = t.type;
  return t.kind === "record" ? t.fields.map((f) => ({name: f.name, type: formatTypeValue(f.type).slice(1, -1)})) : [];
}

// Insère des paramètres dans le texte d'une requête : db.query("... ${0}", [x]) n'existe pas en SuperSQL,
// donc on accepte les paramètres positionnels « ? » à la manière de DuckDB.
function bind(query, params) {
  if (!params?.length) return query;
  let i = 0;
  return query.replace(/\?/g, () => literal(params[i++]));
}

/** Littéral SuperSQL pour une valeur JS. */
export function literal(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : Number.isNaN(v) ? "NaN" : v > 0 ? "+Inf" : "-Inf";
  if (typeof v === "bigint" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return "[" + v.map(literal).join(",") + "]";
  if (typeof v === "object") return "{" + Object.entries(v).map(([k, x]) => literal(k) + ":" + literal(x)).join(",") + "}";
  throw new TypeError("valeur non prise en charge : " + v);
}

const ident = (name) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : literal(name));

function schemaOf(rows) {
  const types = new Map();
  for (const row of rows.slice(0, 1000)) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
    for (const [k, v] of Object.entries(row)) if (!types.has(k) || types.get(k) === "null") types.set(k, typeOf(v));
  }
  return [...types].map(([name, type]) => ({name, type: type === "null" ? "other" : type}));
}

function typeOf(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  if (v instanceof Date) return "date";
  if (v instanceof Uint8Array) return "buffer";
  if (Array.isArray(v)) return "array";
  return typeof v === "object" ? "object" : typeof v;
}
