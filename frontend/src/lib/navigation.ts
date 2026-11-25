// a full navigation makes the server read the updated session cookie
export function goToPage(path: string) {
  window.location.replace(path);
}
