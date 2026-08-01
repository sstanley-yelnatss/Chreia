/** Client-side share password (matches site generateSharePassword style). */
export function generateLocalSharePassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
