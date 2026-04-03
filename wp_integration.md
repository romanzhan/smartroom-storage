# WordPress Integration Guide

Данный лендинг полностью изолирован и готов к встраиванию в WordPress без зависимостей от тем и плагинов.

## Архитектура

```
[Vite Build] → dist/assets/main.js + main.css
                       ↓
[WP Plugin] → wp_enqueue_script / wp_enqueue_style
                       ↓
[wp_localize_script] → window.StorageCalcConfig → data.js
                       ↓
[Shortcode] → [smartroom_calculator] → выводит HTML калькулятора
```

---

## 1. Регистрация ассетов и шорткода (PHP)

```php
// smartroom-storage/smartroom-storage.php

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'smartroom-calc',
        plugin_dir_url(__FILE__) . 'dist/assets/main.css'
    );
    wp_enqueue_script(
        'smartroom-calc',
        plugin_dir_url(__FILE__) . 'dist/assets/main.js',
        [], false, true
    );

    // Передаём данные из БД во frontend
    $settings = get_option('smartroom_calc_settings', []);
    wp_localize_script('smartroom-calc', 'StorageCalcConfig', [
        'postcodes'    => $settings['postcodes']   ?? [],
        'boxItemsData' => $settings['boxItems']    ?? [],
    ]);
});

add_shortcode('smartroom_calculator', function () {
    ob_start();
    include plugin_dir_path(__FILE__) . 'templates/calculator.php';
    return ob_get_clean();
});
```

---

## 2. Подключение данных в data.js

Замените моковые данные на чтение из `window.StorageCalcConfig`:

```js
// src/js/modules/calculator/data.js

const cfg = window.StorageCalcConfig ?? {};

export const mockPostcodes = cfg.postcodes ?? [
  "SW1A 1AA", "SW1A 2AA", // fallback для local-dev
];

export const boxItemsData = cfg.boxItemsData ?? [
  { id: "small_box", name: "Small Box", desc: "(45×30×30cm)", price: 4.5 },
  // ... остальные дефолты
];
```

---

## 3. Админ-панель → REST API (сохранение настроек)

Файл `admin.html` / `admin.js` — дизайн-макет панели настроек. В WP он заменяется страницей настроек плагина.

```php
// Регистрация REST-эндпоинта
add_action('rest_api_init', function () {
    register_rest_route('smartroom/v1', '/settings', [
        'methods'             => ['GET', 'POST'],
        'callback'            => 'smartroom_handle_settings',
        'permission_callback' => fn() => current_user_can('manage_options'),
    ]);
});

function smartroom_handle_settings(WP_REST_Request $req) {
    if ($req->get_method() === 'POST') {
        $params = $req->get_json_params();
        
        // ВАЖНО: Добавьте санитаризацию (sanitize) входящих данных для защиты от XSS!
        // Например: $sanitized = map_deep($params, 'sanitize_text_field');
        
        update_option('smartroom_calc_settings', $params); // Замените $params на очищенные данные в рабочей версии
        return ['ok' => true];
    }
    return get_option('smartroom_calc_settings', []);
}
```

В `admin.js` — заменить `console.log` / `localStorage` на:
```js
await fetch('/wp-json/smartroom/v1/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': wpApiSettings.nonce },
    body: JSON.stringify(settingsPayload),
});
```

---

## 4. Деплой

```bash
npm run build     # собирает dist/assets/main.{js,css}
# → скопировать dist/assets/ в папку плагина WordPress
```

Структура плагина:
```
smartroom-storage/
├── smartroom-storage.php   # Основной файл плагина
├── templates/
│   └── calculator.php      # HTML-шаблон калькулятора
└── dist/
    └── assets/
        ├── main.js
        └── main.css
```

---

## 5. Изоляция

Лендинг **не использует** `wp_head()` / `wp_footer()`. Все стили и скрипты подключаются только через `wp_enqueue_*` на страницах с шорткодом `[smartroom_calculator]`, что исключает конфликты с темой.
