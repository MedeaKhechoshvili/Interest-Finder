// feature pages can use this function without reading the session cookie
export async function apiRequest(path: string, method = "GET", data?: object) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Use a relative backend path.");
  }

  const options: RequestInit = {
    method: method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  };

  if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch("/api/backend" + path, options);

  if (response.status === 401) {
    const currentPage = window.location.pathname + window.location.search;
    window.location.replace(
      "/login?expired=1&next=" + encodeURIComponent(currentPage),
    );
    throw new Error("Please log in to continue.");
  }

  if (response.status === 204) {
    return null;
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message);
  }

  return result;
}
