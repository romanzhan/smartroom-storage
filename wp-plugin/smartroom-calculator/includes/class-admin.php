<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Admin {
    const MENU_SLUG = 'smartroom-calc';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_init', [__CLASS__, 'handle_save']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_admin_assets']);
    }

    public static function register_menu() {
        add_menu_page(
            'SmartRoom Calculator',
            'SmartRoom',
            'manage_options',
            self::MENU_SLUG,
            [__CLASS__, 'render_dashboard'],
            'dashicons-calculator',
            30
        );
        add_submenu_page(self::MENU_SLUG, 'Обзор', 'Обзор', 'manage_options', self::MENU_SLUG, [__CLASS__, 'render_dashboard']);
        add_submenu_page(self::MENU_SLUG, 'Заказы', 'Заказы', 'manage_options', 'edit.php?post_type=' . SMARTROOM_CALC_CPT);
        add_submenu_page(self::MENU_SLUG, 'Настройки калькулятора', 'Настройки калькулятора', 'manage_options', 'smartroom-calc-config', [__CLASS__, 'render_config_page']);
        add_submenu_page(self::MENU_SLUG, 'Stripe и Email', 'Stripe и Email', 'manage_options', 'smartroom-calc-settings', [__CLASS__, 'render_settings_page']);
    }

    public static function enqueue_admin_assets($hook) {
        if (strpos((string) $hook, 'smartroom-calc') === false) return;

        wp_enqueue_style(
            'smartroom-admin',
            SMARTROOM_CALC_ASSETS_URL . 'admin.css',
            [],
            SMARTROOM_CALC_VERSION
        );
    }

    // ─────────── Dashboard ───────────
    public static function render_dashboard() {
        $order_count = wp_count_posts(SMARTROOM_CALC_CPT);
        $total_orders = $order_count->publish ?? 0;

        // Get paid orders
        $paid_q = new WP_Query([
            'post_type'      => SMARTROOM_CALC_CPT,
            'meta_key'       => '_sr_status',
            'meta_value'     => SmartRoom_Calc_Orders::STATUS_PAID,
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ]);
        $paid_count = $paid_q->found_posts;
        $paid_total = 0;
        foreach ($paid_q->posts as $pid) {
            $t = SmartRoom_Calc_Orders::get_totals($pid);
            $paid_total += (float)($t['subtotal'] ?? 0);
        }

        $settings = SmartRoom_Calc_Settings::all();
        $stripe_configured = !empty(SmartRoom_Calc_Settings::stripe_sk()) && !empty(SmartRoom_Calc_Settings::stripe_pk());
        $mode = $settings['stripe_mode'] ?? 'test';
        ?>
        <div class="wrap">
            <h1>SmartRoom Storage Calculator</h1>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0">
                <div class="postbox" style="padding:20px">
                    <div style="font-size:13px;color:#64748b">Всего заказов</div>
                    <div style="font-size:28px;font-weight:700;margin-top:4px"><?php echo (int) $total_orders; ?></div>
                </div>
                <div class="postbox" style="padding:20px">
                    <div style="font-size:13px;color:#64748b">Оплачено</div>
                    <div style="font-size:28px;font-weight:700;margin-top:4px;color:#16a34a"><?php echo (int) $paid_count; ?></div>
                </div>
                <div class="postbox" style="padding:20px">
                    <div style="font-size:13px;color:#64748b">Оборот</div>
                    <div style="font-size:28px;font-weight:700;margin-top:4px">£<?php echo number_format($paid_total, 2); ?></div>
                </div>
                <div class="postbox" style="padding:20px">
                    <div style="font-size:13px;color:#64748b">Stripe</div>
                    <div style="font-size:16px;font-weight:600;margin-top:8px">
                        <?php if ($stripe_configured): ?>
                            <span style="color:#16a34a">● Настроен</span> (<?php echo esc_html($mode); ?>)
                        <?php else: ?>
                            <span style="color:#dc2626">● Не настроен</span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <div class="postbox" style="padding:20px">
                <h2>Быстрый старт</h2>
                <ol style="line-height:1.8">
                    <li>Перейдите в <a href="<?php echo esc_url(admin_url('admin.php?page=smartroom-calc-settings')); ?>">Stripe и Email</a> и вставьте тестовые ключи Stripe (pk_test_... и sk_test_...)</li>
                    <li>В Stripe Dashboard → Developers → Webhooks добавьте endpoint:<br>
                        <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px"><?php echo esc_url(rest_url('smartroom/v1/webhook')); ?></code><br>
                        <small>Выберите события: <code>checkout.session.completed</code>, <code>checkout.session.expired</code>, <code>payment_intent.payment_failed</code></small><br>
                        <small>Скопируйте Signing secret (whsec_...) и вставьте в настройки плагина.</small>
                    </li>
                    <li>Настройте калькулятор в <a href="<?php echo esc_url(admin_url('admin.php?page=smartroom-calc-config')); ?>">Настройки калькулятора</a></li>
                    <li>Калькулятор доступен по адресу: <a href="<?php echo esc_url(home_url('/smartroom-calculator/')); ?>" target="_blank"><?php echo esc_html(home_url('/smartroom-calculator/')); ?></a></li>
                    <li>Или вставьте шорткод <code>[smartroom_calculator]</code> на любую страницу</li>
                </ol>
            </div>
        </div>
        <?php
    }

    // ─────────── Settings page (Stripe + email) ───────────
    public static function render_settings_page() {
        $s = SmartRoom_Calc_Settings::all();
        if (isset($_GET['saved'])) {
            echo '<div class="notice notice-success is-dismissible"><p>Настройки сохранены.</p></div>';
        }
        ?>
        <div class="wrap">
            <h1>Stripe и Email</h1>
            <form method="post" action="">
                <?php wp_nonce_field('sr_save_settings', 'sr_nonce'); ?>
                <input type="hidden" name="sr_action" value="save_settings">

                <h2>Режим Stripe</h2>
                <table class="form-table">
                    <tr>
                        <th>Режим</th>
                        <td>
                            <label><input type="radio" name="stripe_mode" value="test" <?php checked($s['stripe_mode'] ?? 'test', 'test'); ?>> Test</label> &nbsp;
                            <label><input type="radio" name="stripe_mode" value="live" <?php checked($s['stripe_mode'] ?? 'test', 'live'); ?>> Live</label>
                        </td>
                    </tr>
                </table>

                <h2>Ключи Stripe — Test</h2>
                <table class="form-table">
                    <tr>
                        <th><label for="stripe_test_pk">Publishable key</label></th>
                        <td><input type="text" class="regular-text" id="stripe_test_pk" name="stripe_test_pk" value="<?php echo esc_attr($s['stripe_test_pk'] ?? ''); ?>" placeholder="pk_test_..."></td>
                    </tr>
                    <tr>
                        <th><label for="stripe_test_sk">Secret key</label></th>
                        <td><input type="password" class="regular-text" id="stripe_test_sk" name="stripe_test_sk" value="<?php echo esc_attr($s['stripe_test_sk'] ?? ''); ?>" placeholder="sk_test_..."></td>
                    </tr>
                    <tr>
                        <th><label for="stripe_test_whsec">Webhook signing secret</label></th>
                        <td><input type="password" class="regular-text" id="stripe_test_whsec" name="stripe_test_whsec" value="<?php echo esc_attr($s['stripe_test_whsec'] ?? ''); ?>" placeholder="whsec_..."></td>
                    </tr>
                </table>

                <h2>Ключи Stripe — Live</h2>
                <table class="form-table">
                    <tr>
                        <th><label for="stripe_live_pk">Publishable key</label></th>
                        <td><input type="text" class="regular-text" id="stripe_live_pk" name="stripe_live_pk" value="<?php echo esc_attr($s['stripe_live_pk'] ?? ''); ?>" placeholder="pk_live_..."></td>
                    </tr>
                    <tr>
                        <th><label for="stripe_live_sk">Secret key</label></th>
                        <td><input type="password" class="regular-text" id="stripe_live_sk" name="stripe_live_sk" value="<?php echo esc_attr($s['stripe_live_sk'] ?? ''); ?>" placeholder="sk_live_..."></td>
                    </tr>
                    <tr>
                        <th><label for="stripe_live_whsec">Webhook signing secret</label></th>
                        <td><input type="password" class="regular-text" id="stripe_live_whsec" name="stripe_live_whsec" value="<?php echo esc_attr($s['stripe_live_whsec'] ?? ''); ?>" placeholder="whsec_..."></td>
                    </tr>
                </table>

                <h2>Валюта и URLs</h2>
                <table class="form-table">
                    <tr>
                        <th><label for="currency">Валюта</label></th>
                        <td>
                            <select name="currency" id="currency">
                                <?php foreach (['gbp' => 'GBP (£)', 'eur' => 'EUR (€)', 'usd' => 'USD ($)'] as $k => $v): ?>
                                    <option value="<?php echo esc_attr($k); ?>" <?php selected($s['currency'] ?? 'gbp', $k); ?>><?php echo esc_html($v); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="success_url">Success URL</label></th>
                        <td><input type="url" class="regular-text" id="success_url" name="success_url" value="<?php echo esc_attr($s['success_url'] ?? ''); ?>"></td>
                    </tr>
                    <tr>
                        <th><label for="cancel_url">Cancel URL</label></th>
                        <td><input type="url" class="regular-text" id="cancel_url" name="cancel_url" value="<?php echo esc_attr($s['cancel_url'] ?? ''); ?>"></td>
                    </tr>
                </table>

                <h2>Уведомления по email</h2>
                <table class="form-table">
                    <tr>
                        <th><label for="admin_email">Email администратора</label></th>
                        <td><input type="email" class="regular-text" id="admin_email" name="admin_email" value="<?php echo esc_attr($s['admin_email'] ?? get_option('admin_email')); ?>"></td>
                    </tr>
                    <tr>
                        <th>Отправлять клиенту</th>
                        <td><label><input type="checkbox" name="email_customer" value="1" <?php checked(!empty($s['email_customer'])); ?>> Отправлять подтверждение заказа клиенту</label></td>
                    </tr>
                    <tr>
                        <th>Отправлять админу</th>
                        <td><label><input type="checkbox" name="email_admin" value="1" <?php checked(!empty($s['email_admin'])); ?>> Отправлять уведомление админу о новом оплаченном заказе</label></td>
                    </tr>
                </table>

                <h2>Webhook endpoint</h2>
                <p>Добавьте этот URL в Stripe Dashboard → Developers → Webhooks:</p>
                <code style="background:#f1f5f9;padding:8px 12px;border-radius:4px;display:inline-block;font-size:14px"><?php echo esc_url(rest_url('smartroom/v1/webhook')); ?></code>
                <p><small>События: <code>checkout.session.completed</code>, <code>checkout.session.expired</code>, <code>payment_intent.payment_failed</code></small></p>

                <?php submit_button('Сохранить настройки'); ?>
            </form>
        </div>
        <?php
    }

    // ─────────── Config page (calculator config) ───────────
    public static function render_config_page() {
        // Serve admin.html inside an iframe with data bridge.
        // Simpler: pass config to JS, let admin.js save to REST endpoint.
        $config = SmartRoom_Calc_Settings::get_site_config();
        ?>
        <div class="wrap">
            <h1>Настройки калькулятора</h1>
            <p>Все параметры калькулятора: цены, тарифы, скидки, формулы.</p>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:0;margin-top:20px;overflow:hidden;min-height:700px">
                <iframe src="<?php echo esc_url(SMARTROOM_CALC_ASSETS_URL . 'admin/admin.html'); ?>" style="width:100%;height:85vh;border:0;display:block"></iframe>
            </div>
            <p style="margin-top:16px;color:#64748b;font-size:13px">
                Изменения сохраняются в <code>localStorage</code> браузера. Для применения на всех пользователях нажмите «Экспорт JSON» и загрузите конфиг через REST API или вставьте в базу вручную (опция <code><?php echo esc_html(SMARTROOM_CALC_OPT_CONFIG); ?></code>).
            </p>
        </div>
        <?php
    }

    // ─────────── Save handler ───────────
    public static function handle_save() {
        if (!isset($_POST['sr_action']) || $_POST['sr_action'] !== 'save_settings') return;
        if (!current_user_can('manage_options')) return;
        check_admin_referer('sr_save_settings', 'sr_nonce');

        $fields = [
            'stripe_mode', 'stripe_test_pk', 'stripe_test_sk', 'stripe_test_whsec',
            'stripe_live_pk', 'stripe_live_sk', 'stripe_live_whsec',
            'currency', 'success_url', 'cancel_url', 'admin_email',
        ];
        $data = [];
        foreach ($fields as $f) {
            if (isset($_POST[$f])) {
                $data[$f] = sanitize_text_field(wp_unslash($_POST[$f]));
            }
        }
        $data['email_customer'] = !empty($_POST['email_customer']) ? 1 : 0;
        $data['email_admin'] = !empty($_POST['email_admin']) ? 1 : 0;

        SmartRoom_Calc_Settings::save($data);

        wp_safe_redirect(add_query_arg('saved', '1', admin_url('admin.php?page=smartroom-calc-settings')));
        exit;
    }
}
