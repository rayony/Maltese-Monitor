/**
 * pg 8.23 treats `sslmode=require` as verify-full. Neon’s connection string uses
 * `require`, and that check rejects the certificate, so `db:migrate` (part of
 * `npm run build` on deploy) exits 1. `uselibpqcompat=true` restores the old
 * libpq meaning: encrypt, don’t verify the CA.
 *
 * @param {string | undefined} connectionString
 * @returns {string | undefined}
 */
export function withNeonSsl(connectionString) {
  if (!connectionString) return connectionString;
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const mode = url.searchParams.get("sslmode");
  if (mode === "require" || mode === "prefer" || mode === "verify-ca") {
    url.searchParams.set("uselibpqcompat", "true");
  }
  return url.toString();
}
