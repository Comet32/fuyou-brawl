// Replace the current URL's query string, keeping path and hash. `search` is '' or starts with '?'.
export function replaceSearch(search: string): void {
  try {
    history.replaceState(null, '', location.pathname + search + location.hash);
  } catch {
    // replaceState can throw in sandboxed contexts; the URL is a convenience only.
  }
}
