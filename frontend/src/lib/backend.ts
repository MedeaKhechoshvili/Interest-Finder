import "server-only";

// this address is only used on the server
export async function backendRequest(
  path: string,
  method: string,
  body?: string,
  token?: string,
  contentType = "application/json",
) {
  let apiUrl = process.env.BACKEND_API_URL;

  if (!apiUrl) {
    apiUrl = "http://127.0.0.1:8000/api/v1";
  }

  if (apiUrl.endsWith("/")) {
    apiUrl = apiUrl.slice(0, -1);
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);

  if (token) {
    headers.set("Authorization", "Bearer " + token);
  }

  const response = await fetch(apiUrl + path, {
    method: method,
    headers: headers,
    body: body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });

  return response;
}

// the backend sends error messages inside an error object
export async function backendError(response: Response) {
  try {
    const data = await response.json();

    if (data.error && typeof data.error.message === "string") {
      return data.error.message;
    }
  } catch {
    return "The service could not complete the request.";
  }

  return "The service could not complete the request.";
}

// do not accept cookie changes from another website
export function isSameOrigin(request: Request) {
  let appOrigin = process.env.APP_ORIGIN;

  if (!appOrigin) {
    const url = new URL(request.url);
    appOrigin = url.origin;
  }

  const requestOrigin = request.headers.get("origin");

  if (requestOrigin !== appOrigin) {
    return false;
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  return true;
}
