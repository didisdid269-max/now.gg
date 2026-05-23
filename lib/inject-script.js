/** Client script injected into every proxied HTML page */
function buildInjectScript() {
  return `<script id="cloudbrowse-shim">
(function(){
  var PROXY = "/browse?url=";

  function abs(url) {
    try { return new URL(url, document.baseURI).href; } catch(e) { return url; }
  }

  function shouldProxy(url) {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith(PROXY) || url.startsWith("data:") || url.startsWith("blob:") ||
        url.startsWith("javascript:") || url.startsWith("mailto:") || url.startsWith("#")) return false;
    try {
      var u = new URL(url, document.baseURI);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch(e) { return false; }
  }

  function proxify(url) {
    if (!shouldProxy(url)) return url;
    return PROXY + encodeURIComponent(abs(url));
  }

  /* Links */
  var open = window.open;
  window.open = function(u,n,f) {
    if (u && shouldProxy(u)) return open(proxify(u), n, f);
    return open(u,n,f);
  };

  document.addEventListener("click", function(e) {
    var a = e.target.closest("a");
    if (!a || !a.href) return;
    if (a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!shouldProxy(a.href)) return;
    e.preventDefault();
    location.href = proxify(a.href);
  }, true);

  /* fetch */
  if (window.fetch) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      if (typeof input === "string") {
        input = proxify(input);
      } else if (input && input.url) {
        var u = proxify(input.url);
        if (u !== input.url) input = new Request(u, input);
      }
      return nativeFetch(input, init);
    };
  }

  /* XMLHttpRequest */
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    var args = Array.prototype.slice.call(arguments);
    if (typeof url === "string") args[1] = proxify(url);
    return xhrOpen.apply(this, args);
  };

  /* sendBeacon */
  if (navigator.sendBeacon) {
    var nativeBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      return nativeBeacon(proxify(url), data);
    };
  }

  /* Dynamic script/link/src/href setters */
  function patchSetter(proto, prop) {
    var desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, prop, {
      get: desc.get,
      set: function(v) {
        if (typeof v === "string" && shouldProxy(v)) v = proxify(v);
        desc.set.call(this, v);
      },
      configurable: true
    });
  }
  try {
    patchSetter(HTMLScriptElement.prototype, "src");
    patchSetter(HTMLImageElement.prototype, "src");
    patchSetter(HTMLIFrameElement.prototype, "src");
    patchSetter(HTMLLinkElement.prototype, "href");
  } catch(e) {}

  /* history.replaceState stays on proxy origin — OK for SPAs */
})();
</script>`;
}

module.exports = { buildInjectScript };
