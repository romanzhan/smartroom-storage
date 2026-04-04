/**
 * Тестовый ключ для статического деплоя (например gh-pages без GitHub Actions).
 * Вставьте ключ Google Maps Platform сюда перед `npm run build` / `npm run deploy`.
 *
 * В Google Cloud Console ограничьте ключ по HTTP referrer, например:
 *   https://romanzhan.github.io/smartroom-storage/*
 *   https://romanzhan.github.io/*
 *
 * В production-сборке (`npm run build` / deploy) эта константа идёт первой — ключ для gh-pages.
 * Локально в dev удобнее `.env` с VITE_GOOGLE_MAPS_API_KEY — там .env имеет приоритет.
 *
 * Внимание: ключ в репозитории виден всем. Только для тестов + referrer restrictions.
 */
export const INLINE_GOOGLE_MAPS_API_KEY = "AIzaSyAGOuMC8IAONAT-W7B6psMwqpWOGyB6eVU";
