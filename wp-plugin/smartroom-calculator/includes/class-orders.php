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
        update_post_meta($post_id, '_sr_customer', wp_json_encode($customer));
        update_post_meta($post_id, '_sr_totals', wp_json_encode($totals));
        update_post_meta($post_id, '_sr_data', wp_json_encode($data));
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

    public static function get_customer($post_id) {
        $raw = get_post_meta($post_id, '_sr_customer', true);
        return $raw ? json_decode($raw, true) : [];
    }

    public static function get_totals($post_id) {
        $raw = get_post_meta($post_id, '_sr_totals', true);
        return $raw ? json_decode($raw, true) : [];
    }

    public static function get_data($post_id) {
        $raw = get_post_meta($post_id, '_sr_data', true);
        return $raw ? json_decode($raw, true) : [];
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
        $status  = self::get_status($post->ID);
        $cust    = self::get_customer($post->ID);
        $totals  = self::get_totals($post->ID);
        $data    = self::get_data($post->ID);
        $session = get_post_meta($post->ID, '_sr_stripe_session', true);
        $pi      = get_post_meta($post->ID, '_sr_payment_intent', true);

        echo '<style>
            .sr-box table{width:100%;border-collapse:collapse}
            .sr-box th,.sr-box td{text-align:left;padding:6px 10px;border-bottom:1px solid #eee;vertical-align:top}
            .sr-box th{width:180px;color:#64748b;font-weight:500}
            .sr-box h4{margin:20px 0 10px}
            .sr-box pre{background:#f8fafc;padding:10px;border-radius:6px;font-size:12px;max-height:280px;overflow:auto}
        </style>';

        echo '<div class="sr-box">';

        echo '<h4>Клиент</h4><table>';
        echo '<tr><th>Имя</th><td>' . esc_html($cust['name'] ?? '') . '</td></tr>';
        echo '<tr><th>Email</th><td>' . esc_html($cust['email'] ?? '') . '</td></tr>';
        echo '<tr><th>Телефон</th><td>' . esc_html($cust['phone'] ?? '') . '</td></tr>';
        echo '</table>';

        echo '<h4>Суммы</h4><table>';
        echo '<tr><th>Хранение</th><td>£' . number_format((float)($totals['storagePrice'] ?? 0), 2) . '</td></tr>';
        echo '<tr><th>Страховка</th><td>£' . number_format((float)($totals['insurancePrice'] ?? 0), 2) . '</td></tr>';
        echo '<tr><th>Перевозка</th><td>£' . number_format((float)($totals['collectionFee'] ?? 0), 2) . '</td></tr>';
        echo '<tr><th>НДС</th><td>£' . number_format((float)($totals['vatAmount'] ?? 0), 2) . '</td></tr>';
        echo '<tr><th><strong>Итого (первый платёж)</strong></th><td><strong>£' . number_format((float)($totals['subtotal'] ?? 0), 2) . '</strong></td></tr>';
        echo '<tr><th>Ежемесячно</th><td>£' . number_format((float)($totals['monthlyPayment'] ?? 0), 2) . '</td></tr>';
        echo '</table>';

        if (!empty($data['bookingDetails'])) {
            echo '<h4>Детали брони</h4><table>';
            foreach ($data['bookingDetails'] as $row) {
                echo '<tr><th>' . esc_html($row['label'] ?? '') . '</th><td>' . esc_html($row['value'] ?? '') . '</td></tr>';
            }
            echo '</table>';
        }

        echo '<h4>Stripe</h4><table>';
        echo '<tr><th>Статус</th><td>' . esc_html($status) . '</td></tr>';
        echo '<tr><th>Session ID</th><td><code>' . esc_html($session ?: '—') . '</code></td></tr>';
        echo '<tr><th>Payment Intent</th><td><code>' . esc_html($pi ?: '—') . '</code></td></tr>';
        echo '</table>';

        echo '<h4>Полные данные (JSON)</h4>';
        echo '<pre>' . esc_html(wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';

        echo '</div>';
    }
}
