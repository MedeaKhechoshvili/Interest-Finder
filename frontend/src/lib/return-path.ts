// only return to a page inside this frontend
export function getReturnPath(value: unknown) {
  if (typeof value !== "string") {
    return "/account";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  if (/[\\\x00-\x20]/.test(value)) {
    return "/account";
  }

  const url = new URL(value, "https://interestfinder.local");

  if (url.origin !== "https://interestfinder.local") {
    return "/account";
  }

  if (url.pathname.startsWith("/api")) {
    return "/account";
  }

  if (url.pathname === "/login" || url.pathname === "/register") {
    return "/account";
  }

  return url.pathname + url.search + url.hash;
}
