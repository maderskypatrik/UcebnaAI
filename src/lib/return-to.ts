const KEY = "ucebna:return-to";

/** Remembers where to come back to after signing in, e.g. a shared test. */
export function rememberReturn(path: string) {
  try {
    localStorage.setItem(KEY, path);
  } catch {}
}

/** The remembered page (once), or the home page. Only paths within the app are accepted. */
export function takeReturn(): string {
  let path: string | null = null;
  try {
    path = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
  } catch {}
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}
