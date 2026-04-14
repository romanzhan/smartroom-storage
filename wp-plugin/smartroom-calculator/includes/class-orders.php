<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Orders {
    const STATUS_PENDING = 'pending';
    const STATUS_PAID    = 'paid';
    const STATUS_FAILED  = 'failed';
    const STATUS_REFUND  = 'refunded';

    public static function init() {
        add_action('init', [__CLASS__, 'register_post_type']);
        add_filter('manage_' . SMARTROOM_CALC_CPT . '_posts_columns', [__CLASS__, 'admin_columns']);
        add_action('manage_' . SMARTROOM_CALC_CPT . '_posts_custom_column', [__CLASS__, 'admin_column_content'], 10, 2);
        add_filter('post_row_actions', [__CLASS__, 'row_actions'], 10, 2);
        add_action('add_meta_boxes', [__CLASS__, 'add_meta_boxes']);
    }

    public static function register_post_type() {
        register_post_type(SMARTROOM_CALC_CPT, [
            'labels' => [
                'name'          => 'Заказы калькулятора',
                'singular_name' => 'Заказ',
                'menu_name'     => 'Заказы',
                'all_items'     => 'Все заказы',
                'view_item'     => 'Посмотреть заказ',
                'search_items'  => 'Поиск заказов',
                'not_found'     => 'Заказов не найдено',
            ],
            'public'            => false,
            'show_ui'           => true,
            'show_in_menu'      => false, // shown under SmartRoom menu
            'show_in_rest'      => false,
            'supports'          => ['title'],
            'capability_type'   => 'post',
            'map_meta_cap'      => true,
        ]);
    }

    public static function create($data, $totals, $customer) {
        $title = sprintf(
            '#%s — %s (£%.2f)',
            date('Ymd-His'),
            $customer['name'] ?? 'Unknown',
            $totals['subtotal'] ?? 0
        );

        $post_id = wp_insert_post([
            'post_type'   => SMARTROOM_CALC_CPT,
            'post_status' => 'publish',
            'post_title'  => wp_strip_all_tags($title),
        ]);

        if (is_wp_error($post_id) || !$post_id) {
            return false;
        }

        update_post_meta($post_id, '_sr_status', self::STATUS_PENDING);
        // Store as arrays — WP auto-serializes, avoids wp_unslash() mangling
        // backslashes in JSON strings (which previously corrupted \u00a3 → u00a3)
        update_post_meta($post_id, '_sr_customer', $customer);
        update_post_meta($post_id, '_sr_totals', $totals);
        update_post_meta($post_id, '_sr_data', $data);
        update_post_meta($post_id, '_sr_created', time());

        return $post_id;
    }

    public static function set_stripe_session($post_id, $session_id) {
        update_post_meta($post_id, '_sr_stripe_session', $session_id);
    }

    public static function mark_paid($post_id, $payment_intent_id = '') {
        update_post_meta($post_id, '_sr_status', self::STATUS_PAID);
        update_post_meta($post_id, '_sr_paid_at', time());
        if ($payment_intent_id) {
            update_post_meta($post_id, '_sr_payment_intent', $payment_intent_id);
        }
    }

    /**
     * Mark order as paid AND fire email notifications exactly once.
     * Safe to call multiple times — emails are sent only on the first transition.
     *
     * @return bool True if this call did the marking, false if already paid.
     */
    public static function mark_paid_and_notify($post_id, $payment_intent_id = '') {
        $was = self::get_status($post_id);
        if ($was === self::STATUS_PAID) {
            return false;
        }
        self::mark_paid($post_id, $payment_intent_id);
        if (class_exists('SmartRoom_Calc_Email')) {
            SmartRoom_Calc_Email::send_order_confirmation($post_id);
        }
        return true;
    }

    public static function get_mode($post_id) {
        $data = self::get_data($post_id);
        return $data['address']['mode'] ?? '';
    }

    public static function is_collection($post_id) {
        return self::get_mode($post_id) === 'collection';
    }

    public static function save_inventory($post_id, $inventory) {
        update_post_meta($post_id, '_sr_inventory', $inventory);
        update_post_meta($post_id, '_sr_inventory_submitted_at', time());
    }

    public static function get_inventory($post_id) {
        $raw = get_post_meta($post_id, '_sr_inventory', true);
        $decoded = self::decode_meta($raw);
        return !empty($decoded) ? $decoded : null;
    }

    public static function mark_failed($post_id) {
        update_post_meta($post_id, '_sr_status', self::STATUS_FAILED);
    }

    public static function find_by_session($session_id) {
        $q = new WP_Query([
            'post_type'      => SMARTROOM_CALC_CPT,
            'meta_key'       => '_sr_stripe_session',
            'meta_value'     => $session_id,
            'posts_per_page' => 1,
            'post_status'    => 'publish',
            'fields'         => 'ids',
        ]);
        return $q->have_posts() ? $q->posts[0] : null;
    }

    /**
     * Decode a meta value that might be:
     *  - a PHP array (new format — stored directly via update_post_meta)
     *  - a JSON string (old format — from wp_json_encode)
     *  - a corrupted JSON string where \u0000 escapes lost their backslash
     *    due to wp_unslash() in update_post_meta. We attempt to unmangle.
     */
    private static function decode_meta($raw) {
        if (is_array($raw)) return $raw;
        if (!is_string($raw) || $raw === '') return [];

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // Corrupted JSON — try re-adding stripped backslashes before unicode escapes
        $fixed = preg_replace('/(?<![\\\\])u([0-9a-fA-F]{4})/', '\\\\u$1', $raw);
        $decoded2 = json_decode($fixed, true);
        if (is_array($decoded2)) {
            return $decoded2;
        }

        return [];
    }

    public static function get_customer($post_id) {
        return self::decode_meta(get_post_meta($post_id, '_sr_customer', true));
    }

    public static function get_totals($post_id) {
        return self::decode_meta(get_post_meta($post_id, '_sr_totals', true));
    }

    public static function get_data($post_id) {
        return self::decode_meta(get_post_meta($post_id, '_sr_data', true));
    }

    public static function get_status($post_id) {
        return get_post_meta($post_id, '_sr_status', true);
    }

    // ── Admin UI ──
    public static function admin_columns($columns) {
        return [
            'cb'        => $columns['cb'] ?? '',
            'title'     => 'Заказ',
            'sr_status' => 'Статус',
            'sr_cust'   => 'Клиент',
            'sr_total'  => 'Сумма',
            'sr_date'   => 'Дата',
        ];
    }

    public static function admin_column_content($column, $post_id) {
        switch ($column) {
            case 'sr_status':
                $status = self::get_status($post_id);
                $labels = [
                    self::STATUS_PENDING => '<span style="color:#d97706">Ожидает оплаты</span>',
                    self::STATUS_PAID    => '<span style="color:#16a34a;font-weight:600">Оплачен</span>',
                    self::STATUS_FAILED  => '<span style="color:#dc2626">Ошибка</span>',
                    self::STATUS_REFUND  => '<span style="color:#64748b">Возврат</span>',
                ];
                echo $labels[$status] ?? esc_html($status);
                break;
            case 'sr_cust':
                $c = self::get_customer($post_id);
                echo esc_html(($c['name'] ?? '—') . ' · ' . ($c['email'] ?? ''));
                break;
            case 'sr_total':
                $t = self::get_totals($post_id);
                echo '£' . number_format((float)($t['subtotal'] ?? 0), 2);
                break;
            case 'sr_date':
                $ts = (int) get_post_meta($post_id, '_sr_created', true);
                echo $ts ? esc_html(date('d.m.Y H:i', $ts)) : '—';
                break;
        }
    }

    public static function row_actions($actions, $post) {
        if ($post->post_type !== SMARTROOM_CALC_CPT) return $actions;
        unset($actions['inline hide-if-no-js'], $actions['view']);
        return $actions;
    }

    public static function add_meta_boxes() {
        add_meta_box(
            'sr_order_details',
            'Детали заказа',
            [__CLASS__, 'render_details_box'],
            SMARTROOM_CALC_CPT,
            'normal',
            'high'
        );
    }

    public static function render_details_box($post) {
        $status    = self::get_status($post->ID);
        $cust      = self::get_customer($post->ID);
        $totals    = self::get_totals($post->ID);
        $data      = self::get_data($post->ID);
        $session   = get_post_meta($post->ID, '_sr_stripe_session', true);
        $pi        = get_post_meta($post->ID, '_sr_payment_intent', true);
        $inventory = self::get_inventory($post->ID);

        $addr    = $data['address'] ?? [];
        $date    = $data['date'] ?? [];
        $items   = $data['items'] ?? [];
        $extras  = $data['extras'] ?? [];
        $ins     = $data['insurance'] ?? [];
        $tab     = $data['tab'] ?? '';
        $duration = $data['duration'] ?? null;
        $isRolling = !empty($data['isRolling']);

        // Preload extras catalog to map ids to names/prices
        $extras_catalog = [];
        $site_config = SmartRoom_Calc_Settings::get_site_config();
        if (is_array($site_config) && !empty($site_config['extras'])) {
            foreach ($site_config['extras'] as $e) {
                if (!empty($e['id'])) $extras_catalog[$e['id']] = $e;
            }
        }

        $status_labels = [
            self::STATUS_PENDING => ['Ожидает оплаты', '#d97706', '#fef3c7'],
            self::STATUS_PAID    => ['Оплачен',        '#16a34a', '#dcfce7'],
            self::STATUS_FAILED  => ['Ошибка',          '#dc2626', '#fee2e2'],
            self::STATUS_REFUND  => ['Возврат',         '#64748b', '#f1f5f9'],
        ];
        $sl = $status_labels[$status] ?? [$status, '#64748b', '#f1f5f9'];

        $property_type = ($addr['propType'] ?? 'ground') === 'apartment' ? 'Квартира' : 'Первый этаж';
        $lift_yes = ($addr['lift'] ?? 'yes') === 'yes';

        $date_str = '';
        if (!empty($date['iso'])) {
            $ts = strtotime($date['iso']);
            if ($ts) $date_str = date_i18n('D, j M Y', $ts);
        }

        $maps_url = '';
        if (!empty($addr['lat']) && !empty($addr['lng'])) {
            $maps_url = sprintf('https://www.google.com/maps?q=%s,%s',
                urlencode($addr['lat']), urlencode($addr['lng']));
        }

        ?>
<style>
.sr-od{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;color:#1e293b}
.sr-od__status{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:600;font-size:13px;margin-bottom:4px}
.sr-od__section{margin:0 0 20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px}
.sr-od__section h3{margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600;display:flex;align-items:center;gap:8px}
.sr-od__section h3 .sr-od__icon{font-size:18px}
.sr-od__row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
.sr-od__row:last-child{border-bottom:none}
.sr-od__row dt{color:#64748b;flex:0 0 auto;margin-right:16px}
.sr-od__row dd{margin:0;text-align:right;color:#1e293b;font-weight:500}
.sr-od__row dd a{color:#0d0b9c;text-decoration:none}
.sr-od__row dd a:hover{text-decoration:underline}
.sr-od__row--total{font-size:16px;padding-top:12px;border-top:2px solid #cbd5e1;margin-top:6px}
.sr-od__row--total dt{color:#0d0b9c;font-weight:700}
.sr-od__row--total dd{color:#0d0b9c;font-weight:700}
.sr-od__items{list-style:none;margin:0;padding:0}
.sr-od__items li{padding:8px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between}
.sr-od__items li:last-child{margin-bottom:0}
.sr-od__items li .sr-od__item-name{font-weight:500}
.sr-od__items li .sr-od__item-price{color:#64748b}
.sr-od__tag{display:inline-block;padding:2px 8px;background:#e0e7ff;color:#0d0b9c;border-radius:4px;font-size:11px;font-weight:500;margin-left:6px;text-transform:uppercase}
.sr-od code{background:#fff;padding:2px 6px;border-radius:4px;font-size:12px;border:1px solid #e2e8f0}
.sr-od__notes{background:#fff;padding:10px 12px;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-wrap;font-size:13px;color:#1e293b}
</style>

<div class="sr-od">
    <span class="sr-od__status" style="background:<?php echo $sl[2]; ?>;color:<?php echo $sl[1]; ?>">
        <?php echo esc_html($sl[0]); ?>
    </span>

    <!-- Клиент -->
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">👤</span> Клиент</h3>
        <dl style="margin:0">
            <div class="sr-od__row"><dt>Имя</dt><dd><?php echo esc_html($cust['name'] ?? '—'); ?></dd></div>
            <div class="sr-od__row"><dt>Email</dt><dd><?php if (!empty($cust['email'])): ?><a href="mailto:<?php echo esc_attr($cust['email']); ?>"><?php echo esc_html($cust['email']); ?></a><?php else: ?>—<?php endif; ?></dd></div>
            <div class="sr-od__row"><dt>Телефон</dt><dd><?php if (!empty($cust['phone'])): ?><a href="tel:<?php echo esc_attr($cust['phone']); ?>"><?php echo esc_html($cust['phone']); ?></a><?php else: ?>—<?php endif; ?></dd></div>
        </dl>
    </div>

    <!-- Что хранит -->
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">📦</span> Заказ
            <?php if ($tab === 'furniture'): ?><span class="sr-od__tag">Мебель</span>
            <?php elseif ($tab === 'boxes'): ?><span class="sr-od__tag">Коробки</span>
            <?php endif; ?>
        </h3>
        <?php if (!empty($items)): ?>
        <ul class="sr-od__items">
            <?php foreach ($items as $it):
                $qty = (int) ($it['qty'] ?? 0);
                $price = (float) ($it['price'] ?? 0);
                $line = $qty * $price;
                ?>
                <li>
                    <span class="sr-od__item-name"><?php echo $qty; ?>× <?php echo esc_html($it['name'] ?? ''); ?></span>
                    <span class="sr-od__item-price">£<?php echo number_format($price, 2); ?> / 4 нед. = <strong style="color:#1e293b">£<?php echo number_format($line, 2); ?></strong></span>
                </li>
            <?php endforeach; ?>
        </ul>
        <?php endif; ?>
        <dl style="margin:12px 0 0">
            <div class="sr-od__row"><dt>Срок хранения</dt><dd>
                <?php
                if ($isRolling) echo 'Помесячно (rolling)';
                elseif ($duration) echo esc_html($duration . ' мес.');
                else echo '—';
                ?>
            </dd></div>
            <?php if (!empty($ins['price'])): ?>
            <div class="sr-od__row"><dt>Страховка</dt><dd>£<?php echo number_format((float)$ins['cover'], 0, '.', ','); ?> покрытие · £<?php echo number_format((float)$ins['price'], 2); ?>/мес</dd></div>
            <?php endif; ?>
        </dl>
    </div>

    <!-- Доставка -->
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">🚚</span> Доставка
            <?php if (!empty($addr['mode'])): ?>
                <span class="sr-od__tag"><?php echo $addr['mode'] === 'collection' ? 'Home Collection' : 'Drop-off'; ?></span>
            <?php endif; ?>
        </h3>
        <dl style="margin:0">
            <?php if ($addr['mode'] === 'collection'): ?>
                <div class="sr-od__row"><dt>Адрес</dt><dd><?php echo esc_html($addr['address'] ?? '—'); ?></dd></div>
                <?php if ($maps_url): ?>
                <div class="sr-od__row"><dt>На карте</dt><dd><a href="<?php echo esc_url($maps_url); ?>" target="_blank" rel="noopener">Открыть в Google Maps →</a></dd></div>
                <?php endif; ?>
                <?php if (isset($addr['distanceMiles']) && is_numeric($addr['distanceMiles'])): ?>
                <div class="sr-od__row"><dt>Расстояние до склада</dt><dd><?php echo number_format((float)$addr['distanceMiles'], 1); ?> миль</dd></div>
                <?php endif; ?>
                <div class="sr-od__row"><dt>Тип недвижимости</dt><dd><?php echo esc_html($property_type); ?>
                    <?php if (($addr['propType'] ?? '') === 'apartment'): ?>
                        · <?php echo (int)($addr['floor'] ?? 1); ?> этаж
                        · <?php echo $lift_yes ? 'есть лифт' : 'без лифта'; ?>
                    <?php endif; ?>
                </dd></div>
                <?php if (!empty($addr['instructions'])): ?>
                <div class="sr-od__row"><dt>Комментарий</dt><dd><?php echo esc_html($addr['instructions']); ?></dd></div>
                <?php endif; ?>
            <?php elseif ($addr['mode'] === 'dropoff'): ?>
                <div class="sr-od__row"><dt>Склад</dt><dd><?php
                    $fac = $addr['facility'] ?? '';
                    echo esc_html($fac === 'bloomsbury' ? 'Bloomsbury (WC1N 3QA)' : ($fac === 'hackney' ? 'Hackney (N16 8DR)' : '—'));
                ?></dd></div>
            <?php endif; ?>
            <?php if ($date_str): ?>
            <div class="sr-od__row"><dt>Дата</dt><dd><?php echo esc_html($date_str); ?></dd></div>
            <?php endif; ?>
            <?php if (!empty($date['timeWindow'])): ?>
            <div class="sr-od__row"><dt>Временное окно</dt><dd><?php echo esc_html($date['timeWindow']); ?></dd></div>
            <?php endif; ?>
        </dl>
    </div>

    <!-- Extras -->
    <?php
    $extra_rows = [];
    if (!empty($extras['quantities']) && is_array($extras['quantities'])) {
        foreach ($extras['quantities'] as $eid => $qty) {
            $qty = (int) $qty;
            if ($qty <= 0) continue;
            $meta = $extras_catalog[$eid] ?? ['name' => $eid, 'price' => 0];
            $extra_rows[] = ['name' => $meta['name'], 'qty' => $qty, 'price' => (float)$meta['price'], 'type' => 'qty'];
        }
    }
    if (!empty($extras['flags']) && is_array($extras['flags'])) {
        foreach ($extras['flags'] as $eid) {
            $meta = $extras_catalog[$eid] ?? ['name' => $eid];
            $extra_rows[] = ['name' => $meta['name'], 'type' => 'flag'];
        }
    }
    if ($extra_rows):
    ?>
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">➕</span> Дополнительные услуги</h3>
        <ul class="sr-od__items">
            <?php foreach ($extra_rows as $ex): ?>
                <li>
                    <span class="sr-od__item-name">
                        <?php if ($ex['type'] === 'qty'): ?>
                            <?php echo $ex['qty']; ?>× <?php echo esc_html($ex['name']); ?>
                        <?php else: ?>
                            <?php echo esc_html($ex['name']); ?>
                        <?php endif; ?>
                    </span>
                    <span class="sr-od__item-price">
                        <?php if ($ex['type'] === 'qty'): ?>
                            £<?php echo number_format($ex['qty'] * $ex['price'], 2); ?>
                        <?php else: ?>
                            по запросу
                        <?php endif; ?>
                    </span>
                </li>
            <?php endforeach; ?>
        </ul>
    </div>
    <?php endif; ?>

    <!-- Pickup checklist (если сабмитнут) -->
    <?php if ($inventory && (!empty($inventory['items']) || !empty($inventory['notes']))): ?>
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">📝</span> Pickup Checklist (от клиента)</h3>
        <?php if (!empty($inventory['items'])): ?>
        <ul class="sr-od__items">
            <?php foreach ($inventory['items'] as $it): ?>
                <li>
                    <span class="sr-od__item-name"><?php echo (int)($it['qty'] ?? 0); ?>× <?php echo esc_html($it['label'] ?? ''); ?></span>
                </li>
            <?php endforeach; ?>
        </ul>
        <?php endif; ?>
        <?php if (!empty($inventory['notes'])): ?>
            <p style="margin:12px 0 4px;color:#64748b;font-size:13px">Комментарий:</p>
            <div class="sr-od__notes"><?php echo esc_html($inventory['notes']); ?></div>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <!-- Суммы -->
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">💰</span> Суммы</h3>
        <dl style="margin:0">
            <div class="sr-od__row"><dt>Хранение (первый месяц)</dt><dd>£<?php echo number_format((float)($totals['storagePrice'] ?? 0), 2); ?></dd></div>
            <?php if (!empty($totals['insurancePrice'])): ?>
            <div class="sr-od__row"><dt>Страховка</dt><dd>£<?php echo number_format((float)$totals['insurancePrice'], 2); ?></dd></div>
            <?php endif; ?>
            <?php if (!empty($totals['collectionFee'])): ?>
            <div class="sr-od__row"><dt>Перевозка</dt><dd>£<?php echo number_format((float)$totals['collectionFee'], 2); ?></dd></div>
            <?php endif; ?>
            <?php if (!empty($totals['vatAmount'])): ?>
            <div class="sr-od__row"><dt style="color:#94a3b8">в т.ч. НДС</dt><dd style="color:#94a3b8">£<?php echo number_format((float)$totals['vatAmount'], 2); ?></dd></div>
            <?php endif; ?>
            <div class="sr-od__row sr-od__row--total"><dt>Итого оплачено</dt><dd>£<?php echo number_format((float)($totals['subtotal'] ?? 0), 2); ?></dd></div>
            <?php if (!empty($totals['monthlyPayment'])): ?>
            <div class="sr-od__row"><dt>Ежемесячно (со 2-го мес.)</dt><dd>£<?php echo number_format((float)$totals['monthlyPayment'], 2); ?></dd></div>
            <?php endif; ?>
        </dl>
    </div>

    <!-- Stripe -->
    <div class="sr-od__section">
        <h3><span class="sr-od__icon">💳</span> Stripe</h3>
        <dl style="margin:0">
            <div class="sr-od__row"><dt>Session ID</dt><dd><code><?php echo esc_html($session ?: '—'); ?></code></dd></div>
            <div class="sr-od__row"><dt>Payment Intent</dt><dd><code><?php echo esc_html($pi ?: '—'); ?></code></dd></div>
            <?php if ($session): ?>
            <div class="sr-od__row"><dt>Dashboard</dt><dd><a href="https://dashboard.stripe.com/test/payments/<?php echo esc_attr($pi ?: ''); ?>" target="_blank" rel="noopener">Открыть в Stripe →</a></dd></div>
            <?php endif; ?>
        </dl>
    </div>
</div>
        <?php
    }
}
