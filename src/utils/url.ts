/**
 * Public path of the current page. With `build.format: "file"`, `Astro.url` ends in
 * `.html` during the build, but pages are served without it (e.g. `/formatter/yaml`).
 */
export const pagePath = (url: URL) => url.pathname.replace(/(\/index)?\.html$/, "") || "/";
