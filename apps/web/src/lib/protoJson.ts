/** Convert grpc-gateway camelCase keys to snake_case for frontend types. */
function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/** Recursively normalize proto JSON field names (camelCase → snake_case). */
export function normalizeProtoJson<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeProtoJson(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[camelToSnake(key)] = normalizeProtoJson(nested)
    }
    return out as T
  }
  return value
}
