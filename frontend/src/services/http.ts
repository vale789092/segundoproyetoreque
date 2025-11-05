export async function http<T>(
  path: string,                        // usa rutas relativas: /api/...
  init: RequestInit = {},
  withAuth = false
): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json", ...(init.headers || {}) };
  if (withAuth) {
    const t = localStorage.getItem("token");
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
