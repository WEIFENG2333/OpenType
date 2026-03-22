/** Type-safe error message extraction from unknown catch values */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
