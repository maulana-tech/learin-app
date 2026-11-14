/** Cookies read on the server so the first paint is right. Kept out of client
 *  components: a server file importing a value from a "use client" module gets
 *  a client reference, not the string. */
export const NAV_COOKIE = "learis_nav";
export const WS_COOKIE = "learis_ws";
