# WordPress Integration Guide

Лендинг изолирован и готов к встраиванию в WordPress. Формат данных (`site-config`) описан в `src/js/site-config/`.

## Поток данных (локально, GitHub Pages, WP)

1. **Дефолты** в `src/js/site-config/defaults.js`
2. **`calculator-config.json`** в корне сайта (после сборки копируется из `public/` в `dist/`, см. `vite.config.js` → `publicDir`)
3. **`localStorage`** ключ `smartroom_site_config` — опционально, если вы сами записали туда JSON (например для отладки)
4. **WordPress** — приоритетный слой:
   - `window.__SMARTROOM_SITE_CONFIG__` — объект настроек (рекомендуемый способ)
   - **или** устаревший `window.StorageCalcConfig` (`postcodes`, `boxItemsData`, при необходимости числовые поля)

Порядок слияния: `defaults` → JSON-файл → `localStorage` → `StorageCalcConfig` → `__SMARTROOM_SITE_CONFIG__`.

Формат объекта (после слияния):

```json
{
  "version": 1,
  "baseFeeBoxes": 0,
  "baseFeeFurniture": 25,
  "allowedPostcodes": ["SW1A 1AA"],
  "items": [{ "id": "small_box", "name": "Small Box", "desc": "…", "price": 4.5 }]
}
```

---

## 1. Регистрация ассетов и шорткода (PHP)

```php
add_action('wp_enqueue_scripts', function () {
    $base = plugin_dir_url(__FILE__) . 'dist/';

    wp_enqueue_style('smartroom-calc', $base . 'assets/main.css');
    wp_enqueue_script('smartroom-calc', $base . 'assets/main.js', [], false, true);

    $settings = get_option('smartroom_calc_settings', []);

    wp_localize_script('smartroom-calc', '__SMARTROOM_SITE_CONFIG__', [
        'version'           => 1,
        'baseFeeBoxes'      => (float) ($settings['baseFeeBoxes'] ?? 0),
        'baseFeeFurniture'  => (float) ($settings['baseFeeFurniture'] ?? 25),
        'allowedPostcodes'  => $settings['postcodes'] ?? [],
        'items'             => $settings['boxItems'] ?? [],
    ]);
});
```

> **Важно:** первый аргумент `wp_localize_script` задаёт **имя JS-переменной**. Для имени `__SMARTROOM_SITE_CONFIG__` WordPress сгенерирует `var __SMARTROOM_SITE_CONFIG__ = {...};` — это совпадает с ожиданием фронта.

Если удобнее оставить старое имя `StorageCalcConfig`, оно по-прежнему поддерживается (`postcodes` → `allowedPostcodes`, `boxItemsData` → `items`).

---

## 2. Изменение настроек

- **Статический деплой:** правьте `public/calculator-config.json`, затем `npm run build` и выкладка `dist/`.
- **WordPress:** храните настройки в `get_option` / своей странице настроек плагина и отдавайте их через `wp_localize_script`, как в разделе 1. REST API для сохранения настраиваете в плагине отдельно, если нужен бэкенд.

---

## 3. GitHub Pages

- В репозитории лежит **`public/calculator-config.json`** (уже есть в проекте).
- Чтобы обновить конфиг для всех пользователей: отредактируйте файл → commit → push → деплой.

---

## 4. Деплой

```bash
npm run build
```

В `dist/` должны быть `calculator-config.json`, `index.html`, `assets/*` (и при необходимости `payment-success.html`).

---

## 5. Изоляция

Калькулятор не тянет `wp_head` / `wp_footer`. Стили и скрипты — только через `wp_enqueue_*` на нужных страницах.
