import { describe, expect, it, vi } from "vitest";
import { OFFLINE_PATH, serviceWorkerSource } from "./service-worker";

const ORIGIN = "https://neto.example";

/** Uruchamia źródło workera z atrapami self, caches i fetch. */
function boot(fetchImpl: (req: Request | string) => Promise<Response>) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: Request | string) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (r: Request | string) => store.get(keyOf(r))?.clone(),
      put: async (r: Request | string, res: Response) => void store.set(keyOf(r), res),
      addAll: async (urls: string[]) => {
        for (const u of urls) store.set(keyOf(u), await fetchImpl(new URL(u, ORIGIN).href));
      },
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (r: Request | string, opts?: { cacheName?: string }) =>
      opts?.cacheName ? (await open(opts.cacheName)).match(r) : undefined,
  };
  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  new Function("self", "caches", "fetch", "Response", serviceWorkerSource("test"))(
    self,
    caches,
    fetchImpl,
    Response,
  );

  async function dispatch(type: string, request?: Request) {
    let waited: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    handlers[type]({
      request,
      waitUntil: (p: Promise<unknown>) => (waited = p),
      respondWith: (p: Promise<Response>) => (responded = p),
    });
    await waited;
    return responded;
  }
  return { dispatch, stores };
}

const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } });

function navigation(path: string) {
  // Request z mode "navigate" nie da się zbudować w Node; worker czyta tylko url, method i mode.
  return { url: ORIGIN + path, method: "GET", mode: "navigate" } as unknown as Request;
}

describe("service worker", () => {
  it("instalacja zapisuje stronę offline i jej pliki statyczne", async () => {
    const fetchImpl = vi.fn(async (r: Request | string) => {
      const url = typeof r === "string" ? r : r.url;
      if (url.endsWith(OFFLINE_PATH))
        return html('<link href="/_next/static/css/a.css"><script src="/_next/static/chunks/b.js">');
      return new Response("x");
    });
    const sw = boot(fetchImpl);
    await sw.dispatch("install");
    const cached = [...sw.stores.get("neto-shell-test")!.keys()].map((u) => new URL(u).pathname).sort();
    expect(cached).toEqual([
      "/_next/static/chunks/b.js",
      "/_next/static/css/a.css",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/manifest.webmanifest",
      "/offline",
    ]);
  });

  it("nawigacja idzie przez sieć i nie trafia do pamięci", async () => {
    const sw = boot(async () => html("<p>Pulpit: 422 870 zł</p>"));
    const res = await sw.dispatch("fetch", navigation("/dashboard"));
    expect(await res!.text()).toContain("422 870");
    const all = [...sw.stores.values()].flatMap((s) => [...s.keys()]);
    expect(all.some((u) => u.includes("/dashboard"))).toBe(false);
  });

  it("bez sieci nawigacja dostaje stronę offline", async () => {
    let online = true;
    const sw = boot(async (r) => {
      if (!online) throw new TypeError("Failed to fetch");
      const url = typeof r === "string" ? r : r.url;
      return url.endsWith(OFFLINE_PATH) ? html("Brak połączenia") : new Response("x");
    });
    await sw.dispatch("install");
    online = false;
    const res = await sw.dispatch("fetch", navigation("/assets"));
    expect(await res!.text()).toBe("Brak połączenia");
  });

  it("żądania RSC, API i POST omijają workera", async () => {
    const sw = boot(async () => new Response("{}"));
    expect(await sw.dispatch("fetch", new Request(`${ORIGIN}/dashboard?_rsc=abc`))).toBeUndefined();
    expect(await sw.dispatch("fetch", new Request(`${ORIGIN}/api/export`))).toBeUndefined();
    expect(
      await sw.dispatch("fetch", new Request(`${ORIGIN}/_next/static/x.js`, { method: "POST" })),
    ).toBeUndefined();
    expect(await sw.dispatch("fetch", new Request("https://inny.example/_next/static/x.js"))).toBeUndefined();
  });

  it("pliki statyczne z pamięci po pierwszym pobraniu", async () => {
    // W przeglądarce odpowiedź z tego samego źródła ma typ "basic"; w Node zawsze "default".
    const fetchImpl = vi.fn(async () =>
      Object.defineProperty(new Response("kod"), "type", { value: "basic" }),
    );
    const sw = boot(fetchImpl);
    const req = () => new Request(`${ORIGIN}/_next/static/chunks/c.js`);
    expect(await (await sw.dispatch("fetch", req()))!.text()).toBe("kod");
    await sw.dispatch("fetch", req());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aktywacja usuwa pamięć poprzednich wersji", async () => {
    const sw = boot(async () => new Response("x"));
    sw.stores.set("neto-shell-stara", new Map());
    sw.stores.set("inna-aplikacja", new Map());
    await sw.dispatch("activate");
    expect([...sw.stores.keys()]).toEqual(["inna-aplikacja"]);
  });
});
