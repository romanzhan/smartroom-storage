# SmartRoom Storage Calculator

Изолированный лендинг-калькулятор хранения, собранный на **Vite + Vanilla JS**, готовый к встраиванию в WordPress.

## 🔗 Живые страницы

| Страница | URL |
|----------|-----|
| 🏠 **Фронтенд** | [romanzhan2610-png.github.io/smartroom-storage/](https://romanzhan2610-png.github.io/smartroom-storage/) |
| ⚙️ **Админ-панель** | [romanzhan2610-png.github.io/smartroom-storage/admin.html](https://romanzhan2610-png.github.io/smartroom-storage/admin.html) |

## 🛠 Стек

- **Сборщик:** Vite 8
- **HTML:** Handlebars-партиалы (`vite-plugin-handlebars`)
- **CSS:** Vanilla CSS + PostCSS + PurgeCSS
- **JS:** ES Modules (Vanilla JS, без фреймворка)
- **Анимации:** GSAP + ScrollToPlugin
- **Деплой:** `gh-pages` → GitHub Pages

## 📁 Структура

```
src/
├── index.html          # Главная страница
├── admin.html          # Панель администратора
├── partials/           # HTML-компоненты (header, calculator, footer…)
├── css/                # Стили по компонентам
└── js/
    ├── main.js
    └── modules/
        └── calculator/ # Логика и данные калькулятора
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
