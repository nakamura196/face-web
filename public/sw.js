/*
 * kuzushiji-web Service Worker。役割は 2 つ:
 *
 * 1) クロスオリジン隔離 (COOP/COEP) ヘッダの注入
 *    GitHub Pages はレスポンスヘッダを設定できないため、coi-serviceworker
 *    (Guido Zuidhof, MIT) のロジックを移植してここで付与する。
 *    COEP は credentialless にして HF/CDN/フォント等の外部リソース取得を維持。
 *
 * 2) アプリシェルのランタイムキャッシュ (PWA / オフライン対応)
 *    一度表示したページ・アセット・CDN (onnxruntime-web)・フォントをキャッシュし、
 *    2 回目以降はオフラインでも開けるようにする。モデル本体 (huggingface.co) は
 *    既に IndexedDB でキャッシュしているため、ここでは触らない (二重保存を回避)。
 */
const CACHE = "kuzushiji-web-shell-v1";
// localhost (vite dev) ではキャッシュせず COI 注入だけ行う (HMR と干渉させない)
const DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
let coepCredentialless = true;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "deregister") {
    self.registration
      .unregister()
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url)));
  } else if (event.data.type === "coepCredentialless") {
    coepCredentialless = event.data.value;
  }
});

/** COOP/COEP ヘッダを付けたレスポンスに包み直す (opaque はそのまま)。 */
function withCoiHeaders(res) {
  if (!res || res.status === 0) return res;
  const h = new Headers(res.headers);
  h.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
  if (!coepCredentialless) h.set("Cross-Origin-Resource-Policy", "cross-origin");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/** ランタイムキャッシュの対象か。モデル配信 (HF) と解析系は素通し。 */
function cacheable(req, url) {
  if (DEV || req.method !== "GET") return false;
  if (url.origin === self.location.origin) return true; // アプリシェル / サンプル画像等
  if (url.hostname === "cdn.jsdelivr.net") return true; // onnxruntime-web (バージョン付き URL)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return true;
  return false;
}

function putCache(req, res) {
  if (!res || (!res.ok && res.type !== "opaque")) return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
  const url = new URL(req.url);
  // credentialless では no-cors リクエストを資格情報なしで投げる (coi-serviceworker と同じ)
  const fetchReq =
    coepCredentialless && req.mode === "no-cors" ? new Request(req, { credentials: "omit" }) : req;

  // ナビゲーション: network-first。オフライン時はキャッシュ済みのページへフォールバック
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(fetchReq)
        .then((res) => {
          if (!DEV) putCache(req, res);
          return withCoiHeaders(res);
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match(new URL("./", self.location.href).href))
            .then((hit) => (hit ? withCoiHeaders(hit) : Response.error())),
        ),
    );
    return;
  }

  if (!cacheable(req, url)) {
    // HF モデル・GA 等: キャッシュせず COI ヘッダ付与だけ行う
    event.respondWith(fetch(fetchReq).then(withCoiHeaders));
    return;
  }

  // 静的アセット: cache-first + バックグラウンド更新 (stale-while-revalidate)
  event.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(fetchReq)
        .then((res) => {
          putCache(req, res);
          return res;
        })
        .catch(() => null);
      if (hit) return withCoiHeaders(hit);
      return refresh.then((res) => (res ? withCoiHeaders(res) : Response.error()));
    }),
  );
});
