/**
 * Converts Firestore Admin SDK documents into plain JSON-serializable structures
 * safe to pass from Next.js Server Components to Client Components.
 *
 * Firestore `Timestamp` instances (for example `serverTimestamp`) are converted to
 * ISO-8601 strings; class instances and `undefined` object entries are normalized so
 * React Flight serialization never fails with non-plain-object errors.
 */
export function toPlainFirestoreData<T>(value: T): T {
  return serializeValue(value) as T;
}

export function toPlainDoc<T>(
  doc: { id: string; data: () => Record<string, unknown> | undefined },
  idKey: "id" | "uid" = "id"
): T {
  return serializeValue({ ...(doc.data() ?? {}), [idKey]: doc.id }) as T;
}

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const kind = typeof value;
  if (kind === "string" || kind === "number" || kind === "boolean") {
    return value;
  }

  if (kind === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isTimestampLike(value)) {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (kind === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || typeof v === "function" || typeof v === "symbol") {
        continue;
      }
      out[k] = serializeValue(v);
    }
    return out;
  }

  return undefined;
}
