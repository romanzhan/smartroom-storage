# SmartRoom Storage Calculator

Изолированный лендинг-калькулятор хранения, собранный на **Vite + Vanilla JS**, готовый к встраиванию в WordPress.

## 🔗 Живые страницы

| Страница | URL |
|----------|-----|
| 🏠 **Фронтенд** | [romanzhan2610-png.github.io/smartroom-storage/](https://romanzhan2610-png.github.io/smartroom-storage/) |

## 🛠 Стек

- **Сборщик:** Vite 8
- **HTML:** Handlebars-партиалы (локальный плагин `plugins/handlebars.js`)
- **CSS:** Vanilla CSS + PostCSS + PurgeCSS
- **JS:** ES Modules (Vanilla JS, без фреймворка)
- **Анимации:** GSAP + ScrollToPlugin
- **Деплой:** `gh-pages` → GitHub Pages
- **Импорты:** в Vite настроен алиас `@` → `src/js` (можно писать `import x from '@/calculator/…'`)

## 📁 Структура

```
public/
└── calculator-config.json   # Общие настройки (деплой + fallback без localStorage)

src/
├── index.html          # Главная страница
├── partials/           # HTML-компоненты (header, calculator, footer…)
├── css/                # Стили по компонентам
└── js/
    ├── site-config/    # Загрузка настроек (JSON + localStorage + WP)
    ├── main.js
    ├── layout/           # header / footer
    └── calculator/       # Калькулятор: store, DOM, flow, модули шагов

Калькулятор подтягивает конфиг через `loadSiteConfig()` (файл → localStorage → WordPress). Редактирование значений — в `public/calculator-config.json` и деплой, либо через `window.__SMARTROOM_SITE_CONFIG__` в WP. Подробности в `wp_integration.md`.
```

## 🚀 Разработка

```bash
npm install
npm run dev       # Запуск dev-сервера на localhost:3000
npm run build     # Продакшн-сборка → dist/
npm run deploy    # Сборка + деплой на ветку gh-pages
```

### Google Maps / Places (обязательно для калькулятора)

Без ключа калькулятор **не работает**. Приоритет источника:

1. **`VITE_GOOGLE_MAPS_API_KEY`** в **`.env`** (см. [`.env.example`](.env.example)) — удобно для `npm run dev`.
2. Константа **`INLINE_GOOGLE_MAPS_API_KEY`** в файле [`src/js/calculator/inline-maps-api-key.js`](src/js/calculator/inline-maps-api-key.js) — для **статического деплоя без GitHub Actions** (локально вставили ключ → `npm run build` → `npm run deploy` на `gh-pages`).

**GitHub Pages (тест):** в консоли Google для ключа укажите referrer, например  
`https://romanzhan.github.io/smartroom-storage/*` (и при необходимости `http://localhost:3000/*` для dev). Ключ в JS попадёт в публичный бандл — опирайтесь на ограничения referrer + квоты в Cloud Console.

**В Google Cloud Console:** включите **Places API (New)** и **Maps JavaScript API**. Расстояние по дороге считается через **Distance Matrix Service** внутри загружаемого Maps JS (как при маршруте на карте), без видимой карты и без REST Matrix из браузера (у REST нет CORS). Ограничьте ключ по **HTTP referrer** и только нужным API.

**Защита от перерасхода квоты** (чтобы не «расстреливать» API):

- **Debounce** автодополнения ~350 ms — меньше запросов при быстром наборе.
- **Минимум символов** перед первым autocomplete (2+).
- **Лимиты в минуту на вкладку** (скользящее окно 60 с): autocomplete, Place Details и вызовы Distance Matrix через Maps JS (`maps-api-guard.js`).
- **Пауза (cooldown ~2 мин)** после серии ошибок или ответа **429** от Google.
- **Кэш 30 дней** в `localStorage`: полный результат по **`placeId`** (адрес + мили до склада) не запрашивается повторно; при смене координат склада в конфиге старые записи автоматически не совпадут по ключу склада.
- **Кэш в памяти ~10 мин** для одинаковой строки поиска в autocomplete — повторный ввод того же префикса без нового запроса.

Дополнительно в Cloud Console задайте **квоты / alerts** на проект — это последняя линия защиты.

**Конфиг сайта:** `restrictToAllowedPostcodes`, `warehouseLatitude` / `warehouseLongitude`, `distancePricing` — см. `defaults.js` и `calculator-config.json`. Для продакшена надёжнее **backend-proxy** (ключ только на сервере).

## 🔌 Интеграция с WordPress

Проект полностью изолирован (без зависимостей от `wp-head` / `wp-footer`).  
Подробный план встраивания через плагин WordPress + REST API — в файле [`wp_integration.md`](wp_integration.md).
