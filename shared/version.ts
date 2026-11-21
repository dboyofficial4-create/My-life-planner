/**
 * Bump whenever the API changes in a way the web app depends on.
 * The web app compares this with the running server and asks the user to
 * restart when they differ (e.g. after `git pull` while the app was running:
 * the web side reloads itself, but the server keeps running old code).
 */
export const API_VERSION = 18;
