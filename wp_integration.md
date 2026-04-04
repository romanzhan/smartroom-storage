# WordPress Integration Guide

Лендинг изолирован и готов к встраиванию в WordPress. **Калькулятор и админка используют один формат данных** (`site-config`), см. `src/js/site-config/`.

## Поток данных (одинаковая логика: локально, GitHub Pages, WP)

1. **Дефолты** в `src/js/site-config/defaults.js`
2. **`calculator-config.json`** в корне сайта (после сборки копируется из `public/` в `dist/`, см. `vite.config.js` → `publicDir`)
3. **`localStorage`** ключ `smartroom_site_config` — после «Save» в админке на **том же origin** калькулятор подхватывает правки без деплоя
4. **WordPress** — приоритетный слой:
   - `window.__SMARTROOM_SITE_CONFIG__` — объект настроек (рекомендуемый способ)
   - **или** устаревший `window.StorageCalcConfig` (`postcodes`, `boxItemsData`, при необходимости числовые поля)

Порядок слияния: `defaults` → JSON-файл → `localStorage` → `StorageCalcConfig` → `__SMARTROOM_SITE_CONFIG__`.

Формат объекта (после слияния):

```json
{
  "version": 1,
  "globalDiscount": 45,
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
        'globalDiscount'    => (float) ($settings['globalDiscount'] ?? 45),
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

## 2. Сохранение из админки WordPress

В статической админке при сохранении вызывается `saveSiteConfig()` → `localStorage` + опционально глобальная функция:

```js
window.__SMARTROOM_SAVE_CONFIG__ = function (body) {
  fetch('/wp-json/smartroom/v1/settings', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': wpApiSettings.nonce,
    },
    body: JSON.stringify(body),
  });
};
```

Подключите этот фрагмент **только** на странице, где грузится `admin.js` (или объедините админку с WP Settings API).

Пример REST (как раньше, но сохраняйте тот же JSON, что и фронт):

```php
register_rest_route('smartroom/v1', '/settings', [
    'methods'             => ['GET', 'POST'],
    'callback'            => 'smartroom_handle_settings',
    'permission_callback' => fn () => current_user_can('manage_options'),
]);
```

Санитизируйте поля перед `update_option`.

---

## 3. GitHub Pages

- Положите в репозиторий **`public/calculator-config.json`** (уже есть в проекте).
- После правок в админке на gh.io: **Save** пишет в `localStorage` только для этого браузера.
- Чтобы все пользователи видели изменения: **Download calculator-config.json** в админке → замените файл в `public/` → commit → push → деплой.

---

## 4. Деплой

```bash
npm run build
```

В `dist/` должны быть `calculator-config.json`, `index.html`, `admin.html`, `assets/*`.

---

## 5. Изоляция

Калькулятор не тянет `wp_head` / `wp_footer`. Стили и скрипты — только через `wp_enqueue_*` на нужных страницах.
