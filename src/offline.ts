import Dexie, { type Table } from "dexie";
import type { Experiment, Product } from "./types";
type Cache = { key: string; value: unknown; updated: number };
type Operation = {
  key: string;
  note: string;
  text: string;
  revision: number;
  state: "pending" | "conflict";
  server?: unknown;
  created: number;
};
class LabCache extends Dexie {
  cache!: Table<Cache, string>;
  operations!: Table<Operation, string>;
  constructor() {
    super("phantomlab-v1");
    this.version(1).stores({
      cache: "key,updated",
      operations: "key,state,note",
    });
    this.version(2)
      .stores({ cache: "key,updated", operations: "key,state,note,created" })
      .upgrade((tx) =>
        tx
          .table("operations")
          .toCollection()
          .modify((op) => {
            op.created = op.created || 0;
          }),
      );
  }
}
export const local = new LabCache();
const LIMIT = 20 * 1024 * 1024;
export async function cache(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized.length > LIMIT / 2)
    throw Error(
      "This record exceeds the offline metadata limit. Export it as JSON.",
    );
  await local.transaction("rw", local.cache, async () => {
    const rows = (await local.cache.orderBy("updated").toArray()).filter(
      (r) => r.key !== key,
    );
    let size =
      serialized.length * 2 +
      rows.reduce((s, r) => s + JSON.stringify(r.value).length * 2, 0);
    for (const row of rows) {
      if (size <= LIMIT) break;
      if (row.key.startsWith("draft:") || row.key.startsWith("note:")) continue;
      await local.cache.delete(row.key);
      size -= JSON.stringify(row.value).length * 2;
    }
    if (size > LIMIT)
      throw Error(
        "Offline drafts fill the 20 MB metadata budget. Export or remove old drafts before saving.",
      );
    await local.cache.put({ key, value, updated: Date.now() });
  });
}
export async function cached<T>(key: string): Promise<T | undefined> {
  return (await local.cache.get(key))?.value as T | undefined;
}
export async function cacheLaboratory(
  experiments: Experiment[],
  products: Product[],
) {
  await cache("experiments", experiments.slice(0, 20));
  await cache("products", products);
}
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const r = await fetch("/api" + path, {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!r.ok) {
    const value = await r.json().catch(() => ({ detail: r.statusText }));
    throw Error(
      typeof value.detail === "string"
        ? value.detail
        : JSON.stringify(value.detail),
    );
  }
  return r.json();
}
let syncing = false;
export async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    for (const op of (
      await local.operations.where("state").equals("pending").toArray()
    ).sort((a, b) => a.created - b.created)) {
      try {
        const r = await fetch("/api/notes/" + encodeURIComponent(op.note), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: op.text,
            revision: op.revision,
            idempotency_key: op.key,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (r.status === 409) {
          await local.operations.update(op.key, {
            state: "conflict",
            server: await r.json(),
          });
          continue;
        }
        if (!r.ok) break;
        const saved = await r.json();
        await cache("note:" + op.note, saved);
        await local.operations.delete(op.key);
      } catch {
        break;
      }
    }
  } finally {
    syncing = false;
  }
}
export async function saveNote(note: string, text: string) {
  if (text.length > 10000)
    throw Error("A note is limited to 10,000 characters.");
  const previous = await cached<{ revision: number }>("note:" + note);
  const queued = await local.operations.where("note").equals(note).toArray();
  const pending = queued
    .filter((op) => op.state === "pending")
    .sort((a, b) => a.created - b.created)
    .at(-1);
  if (pending && !syncing) {
    await local.operations.update(pending.key, { text });
  } else {
    if ((await local.operations.count()) >= 100)
      throw Error(
        "The safe metadata queue is full (100 edits). Reconnect or resolve conflicts before adding more.",
      );
    await local.operations.put({
      key: crypto.randomUUID(),
      note,
      text,
      revision: pending ? pending.revision + 1 : previous?.revision || 0,
      state: "pending",
      created: Math.max(Date.now(), ...queued.map((op) => op.created + 1)),
    });
  }
  await sync();
}
