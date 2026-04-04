/**
 * Тестовый ключ для статического деплоя (например gh-pages без GitHub Actions).
 * Вставьте ключ Google Maps Platform сюда перед `npm run build` / `npm run deploy`.
 *
 * В Google Cloud Console ограничьте ключ по HTTP referrer, например:
 *   https://romanzhan.github.io/smartroom-storage/*
 *   https://romanzhan.github.io/*
 *
 * Для локальной разработки удобнее `.env` с VITE_GOOGLE_MAPS_API_KEY — он
 * имеет приоритет над этой константой.
 *
 * Внимание: ключ в репозитории виден всем. Только для тестов + referrer restrictions.
 */
export const INLINE_GOOGLE_MAPS_API_KEY = "";
