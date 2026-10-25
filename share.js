/* Keeping a copy: turns the whole book into a short piece of text that can be
   put on the end of a link, and back again. It squeezes the text first when
   the device knows how, and falls back to plain text when it does not. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.GrandmaShare = api;
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var scope = typeof globalThis !== 'undefined' ? globalThis : root;

  function bytesToBase64Url(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(text) {
    var padded = text.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4 !== 0) padded += '=';
    var binary = atob(padded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function runStream(Stream, bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (buffer) {
      return new Uint8Array(buffer);
    });
  }

  function canSqueeze() {
    return typeof scope.CompressionStream === 'function' && typeof scope.DecompressionStream === 'function' &&
      typeof Blob === 'function' && typeof Response === 'function';
  }

  /* Returns text like "z1.abc" (squeezed) or "p1.abc" (plain). */
  function pack(state, engine) {
    var plain = engine.packState(state);
    if (!canSqueeze()) return Promise.resolve(plain);
    var bytes = new TextEncoder().encode(JSON.stringify(state));
    return runStream(scope.CompressionStream, bytes).then(function (small) {
      var squeezed = 'z1.' + bytesToBase64Url(small);
      return squeezed.length < plain.length ? squeezed : plain;
    }).catch(function () {
      return plain;
    });
  }

  /* Gives back the saved state, or null when the text is not ours. */
  function unpack(text, engine) {
    var s = String(text).replace(/^#/, '');
    if (s.slice(0, 3) !== 'z1.') return Promise.resolve(engine.unpackState(s));
    if (!canSqueeze()) return Promise.resolve(null);
    return runStream(scope.DecompressionStream, base64UrlToBytes(s.slice(3))).then(function (bytes) {
      var value = JSON.parse(new TextDecoder().decode(bytes));
      return value !== null && typeof value === 'object' ? value : null;
    }).catch(function () {
      return null;
    });
  }

  return { pack: pack, unpack: unpack, canSqueeze: canSqueeze };
});
