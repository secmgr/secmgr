export function appUrl() {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").origin;
}

export function appHost() {
  return new URL(appUrl()).host;
}
