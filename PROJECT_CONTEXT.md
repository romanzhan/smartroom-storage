# PROJECT CONTEXT — SmartRoom Storage Calculator

Этот файл содержит полный контекст проекта для продолжения работы с новым экземпляром Claude.

## Что это за проект

Калькулятор хранения вещей (storage calculator) — лендинг с многоэтапной формой заказа. Vanilla JS + Vite, без фреймворков. Деплоится на GitHub Pages и встраивается в WordPress.

**Репо**: `romanzhan/smartroom-storage` на GitHub  
**URL gh-pages**: `https://romanzhan.github.io/smartroom-storage/`  
**Dev сервер**: `npm run dev` → `localhost:3000`

---

## Что уже сделано (хронология)

### Фронтенд калькулятора (ЗАВЕРШЕН)

1. **Базовый калькулятор** — 4-шаговый wizard:
   - Шаг 1: выбор предметов (boxes) или юнитов (furniture) + страховка + длительность
   - Шаг 2: delivery mode (collection/drop-off) + адрес/facility + доп. услуги
   - Шаг 3: дата + временное окно
   - Шаг 4: контактные данные + checkout summary + Book Now

2. **Google Maps интеграция** — автокомплит адреса, расчёт расстояния, кэширование, rate limiting

3. **Система расчёта collection fee** (последний коммит `399b12b`):
   - Перенесена из moving-калькулятора (`c:\Users\roman\Desktop\smartroom\...`)
   - Формула на основе времени: загрузка + разгрузка + время в пути
   - Ставки грузчиков: £72/час (1), £84/час (2), £120/час (3)
   - Автовыбор грузчиков по объёму (>10 м³ → 2 грузчика)
   - Множители этажа (без лифта +0.25/этаж, с лифтом +0.015/этаж)
   - Travel time: мили × 3 мин + 85 мин (лондонские пробки)
   - Наценки: срочность +20%, выходные +15%, праздники +20%, 2-часовое окно +10%
   - Перегруз: 18-20 м³ = ×1.5, >20 м³ = ×2.0
   - Маленький заказ (<2 м³): фиксированное время, минимум £65
   - VAT настраиваемый (вкл/выкл, %)
   - Extras (разборка мебели £20/шт и флаги) — показываются только для furniture + collection

4. **Валидация всех шагов** — с scroll-to-error и shake-анимацией

5. **Sidebar** — минимальный: First month, Insurance, Length, Collection, Date, Total, Future monthly

6. **Booking Summary** на шаге 4 — полная разбивка заказа

### Цены предметов (актуальные)

- Small Box: £8.20, Medium Box: £11.30, Large Box: £20.40
- Suitcase: £19.40, Medium Bag: £13.50, Guitar: £30.00, Plastic Box: £15.00
- Юниты: Locker £65, Cupboard £70, Box Room £85, Closet £100, Garden Shed £115, Walk-in Closet £125, Room £190, 1 Bedroom Flat £240

---

## Что НЕ сделано — следующие шаги

### 1. АДМИНКА (приоритет #1)

Старая админка была удалена (`src/admin.html`, `src/css/admin.css`, `src/js/admin/`). Нужна новая админка для управления:

**Что должно редактироваться:**
- Предметы (boxes): название, описание, цена, объём (м³)
- Юниты (furniture): название, размер, цена, объём (м³)
- Страховка: тарифы для boxes и furniture
- **Collection настройки** (все из `siteConfig.collection`):
  - Ставки грузчиков (1/2/3 чел)
  - Время на м³, эффективность
  - Множители этажа (с лифтом / без)
  - Travel time: мин/миля, фиксированная задержка
  - Пороги: маленький заказ, автоапгрейд, перегруз
  - Наценки: срочность, выходные, праздники, 2-часовое окно
  - Минимальная цена
- **VAT**: вкл/выкл, процент, применять к collection/storage
- **Extras**: список доп. услуг с ценами
- Допустимые почтовые индексы
- Координаты склада
- Глобальная скидка
- Длительность: тарифы скидок по месяцам

**Как config сохраняется:**
- `localStorage` (для локальной разработки)
- `public/calculator-config.json` (для gh-pages)
- `window.__SMARTROOM_SITE_CONFIG__` (для WordPress)

Файлы конфига: `defaults.js`, `load-site-config.js`, `merge-layers.js`

### 2. БЭКЕНД (после админки)

- Реальная оплата через Stripe (сейчас фейковый `processFakePayment()` в `flow.js`)
- Сохранение заказов в базу
- API для отправки заказа
- Уведомления (email/Telegram)

### 3. WordPress интеграция

- PHP плагин для встраивания (описан в `wp_integration.md`)
- REST API для конфига
- Подгрузка конфига через `window.__SMARTROOM_SITE_CONFIG__`

---

## Архитектура (ключевое)

### State Management
```
store.js — единственный источник правды
  ├── store.modules.* — ссылки на инициализированные модули
  ├── store.currentTab — "boxes" | "furniture"
  ├── store.currentStep — 1..4
  ├── store.siteConfig — полный конфиг
  ├── store.notify() → getSnapshot() → broadcast to subscribers
  └── getSnapshot() — пересчитывает ВСЕ цены из данных модулей
```

### Модульная система
```
modules-init.js — создаёт все модули:
  items, units, durationBoxes, durationFurn,
  insurance, extras, address, date, sidebar
  
Каждый модуль:
  initModuleName({ container, onChange, config })
  → { getData(), ...publicAPI }
  
onChange → store.notify() → snapshot → sidebar re-render
```

### Config система (4 слоя, приоритет ↓)
```
1. defaults.js (самый низкий)
2. calculator-config.json (fetch)
3. localStorage
4. window.__SMARTROOM_SITE_CONFIG__ (самый высокий, WordPress)
```

### Ключевые файлы
```
src/js/calculator/
  store.js          — state + calculateCollectionFee() + getSnapshot()
  flow.js           — переходы шагов, валидация, модалки
  modules-init.js   — фабрика модулей
  sidebar.js        — рендер summary
  extras.js         — доп. услуги
  date.js           — календарь + time slots
  address.js        — адрес + property type
  postcode.js       — Google Places orchestrator
  
src/js/site-config/
  defaults.js       — ВСЕ настраиваемые константы
  merge-layers.js   — deep merge конфигов
  load-site-config.js — 4-layer loader
```

---

## Незакоммиченные файлы

В git status есть незакоммиченные изменения от предыдущих сессий:
- Удалена старая админка (admin.html, admin.css, admin.js)
- Новые файлы: flow-guard.js, checkout-validation.js, maps-driving.js, address.test.js, runtime-utils.js, CLAUDE.md
- Изменения в: animations.js, dom.js, flow.js, google-places.js, index.js, items.js, postcode.js, main.js и др.

Эти файлы уже используются в production build и задеплоены, просто не все были добавлены в один коммит.

---

## Стиль работы с пользователем

- Пользователь (Roman) — программист, общается на русском
- Предпочитает краткие ответы без лишних объяснений
- Работает итеративно: сначала обсуждает, потом говорит "делай"
- Просит собрать/закоммитить/задеплоить одной командой
- Не любит когда ломается вёрстка — всегда проверять визуально
- Проект деплоится: `npm run build` → `git push` → `npx gh-pages -d dist`

---

## Команды

```bash
npm run dev          # Dev сервер localhost:3000
npm run build        # Сборка в /dist/
npm run deploy       # Build + gh-pages deploy
npx vitest run       # Тесты
git push origin main # Push на GitHub
npx gh-pages -d dist # Deploy на GitHub Pages
```

---

## С чего начинать следующую сессию

1. Прочитать этот файл и CLAUDE.md
2. Спросить пользователя: "Делаем админку или что-то другое?"
3. Если админка — начать с дизайна UI и определения, как она будет работать (отдельная страница? модалка? SPA?)
4. Все переменные из `defaults.js` → `siteConfig.collection.*`, `siteConfig.vat.*`, `siteConfig.extras`, `siteConfig.items` должны быть редактируемые
