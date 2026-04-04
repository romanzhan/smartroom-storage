# SmartRoom Storage Calculator

Изолированный лендинг-калькулятор хранения, собранный на **Vite + Vanilla JS**, готовый к встраиванию в WordPress.

## 🔗 Живые страницы

| Страница | URL |
|----------|-----|
| 🏠 **Фронтенд** | [romanzhan2610-png.github.io/smartroom-storage/](https://romanzhan2610-png.github.io/smartroom-storage/) |
| ⚙️ **Админ-панель** | [romanzhan2610-png.github.io/smartroom-storage/admin.html](https://romanzhan2610-png.github.io/smartroom-storage/admin.html) |

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
├── admin.html          # Панель администратора
├── partials/           # HTML-компоненты (header, calculator, footer…)
├── css/                # Стили по компонентам
└── js/
    ├── site-config/    # Единая загрузка/сохранение настроек (JSON + LS + WP)
    ├── main.js
    ├── admin.js          # Точка входа админки
    ├── admin/            # Экран настроек (таблица, сохранение)
    ├── layout/           # header / footer
    └── calculator/       # Калькулятор: store, DOM, flow, модули шагов

Админка и калькулятор читают одни и те же данные: `loadSiteConfig()` (файл → localStorage → WP), после Save — `saveSiteConfig()` в LS (+ хук `__SMARTROOM_SAVE_CONFIG__` в WordPress). Подробности в `wp_integration.md`.
```

## 🚀 Разработка

```bash
npm install
npm run dev       # Запуск dev-сервера на localhost:3000
npm run build     # Продакшн-сборка → dist/
npm run deploy    # Сборка + деплой на ветку gh-pages
```

## 🔌 Интеграция с WordPress

Проект полностью изолирован (без зависимостей от `wp-head` / `wp-footer`).  
Подробный план встраивания через плагин WordPress + REST API — в файле [`wp_integration.md`](wp_integration.md).
