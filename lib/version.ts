export const BUILD_NUMBER = 1269;

const VERSION_MINOR = Math.floor(BUILD_NUMBER / 100);
const VERSION_PATCH = BUILD_NUMBER % 100;

export const VERSION = `0.${String(VERSION_MINOR).padStart(2, '0')}.${String(VERSION_PATCH).padStart(2, '0')}`;
