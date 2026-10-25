/* The one list of files this book keeps on the device so it works without
   internet. The saved copy (sw.js) and the check on the page both read it,
   so they can never disagree. Bump BOOK_VERSION whenever any file changes. */
(function (root) {
  'use strict';
  root.BOOK_VERSION = 'two-crayon-v2';
  root.BOOK_FILES = [
    './',
    './index.html',
    './tokens.css',
    './styles.css',
    './files.js',
    './sw.js',
    './js/engine.js',
    './share.js',
    './render.js',
    './app.js',
    './manifest.json',
    './package.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './fonts/fraunces-latin-wght-normal.woff2',
    './fonts/plus-jakarta-sans-latin-wght-normal.woff2',
    './fonts/jetbrains-mono-latin-wght-normal.woff2'
  ];
})(typeof self !== 'undefined' ? self : this);
