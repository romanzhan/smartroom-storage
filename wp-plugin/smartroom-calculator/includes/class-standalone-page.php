<?php
if (!defined('ABSPATH')) exit;

/**
 * Standalone page — outputs calculator without the active theme's header/footer.
 * Uses a rewrite rule + template_redirect + manual HTML output (no wp_head/wp_footer)
 * so the theme never gets a chance to inject its own styles/scripts.
 */
class SmartRoom_Calc_Standalone_Page {
    const DEFAULT_SLUG = 'smartroom-calculator';
    const QUERY_VAR = 'sr_calc_page';

    public static function init() {
        add_action('init', [__CLASS__, 'add_rewrite_rule']);
        add_filter('query_vars', [__CLASS__, 'add_query_var']);
        add_action('template_redirect', [__CLASS__, 'maybe_render']);
    }

    public static function get_slug() {
        $slug = SmartRoom_Calc_Settings::get('page_slug', self::DEFAULT_SLUG);
        $slug = trim((string) $slug, '/');
        return $slug !== '' ? $slug : self::DEFAULT_SLUG;
    }

    public static function get_url($suffix = '') {
        $slug = self::get_slug();
        $path = '/' . $slug . '/' . ($suffix ? trim($suffix, '/') . '/' : '');
        return home_url($path);
    }

    public static function add_rewrite_rule() {
        $slug = self::get_slug();
        $escaped = preg_quote($slug, '/');
        add_rewrite_rule(
            '^' . $escaped . '/?$',
            'index.php?' . self::QUERY_VAR . '=1',
            'top'
        );
        add_rewrite_rule(
            '^' . $escaped . '/success/?$',
            'index.php?' . self::QUERY_VAR . '=success',
            'top'
        );
        add_rewrite_rule(
            '^' . $escaped . '/cancel/?$',
            'index.php?' . self::QUERY_VAR . '=cancel',
            'top'
        );
    }

    public static function add_query_var($vars) {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    public static function maybe_render() {
        $v = get_query_var(self::QUERY_VAR);
        if (!$v) return;

        status_header(200);
        nocache_headers();

        if ($v === 'success') {
            self::render_success();
        } elseif ($v === 'cancel') {
            self::render_cancel();
        } else {
            self::render_calculator();
        }
        exit;
    }

    private static function render_calculator() {
        $markup_file = SMARTROOM_CALC_PATH . 'templates/calculator-markup.html';
        $markup = file_exists($markup_file) ? file_get_contents($markup_file) : '<p>Markup missing.</p>';
        $markup = str_replace('./assets/', SMARTROOM_CALC_ASSETS_URL, $markup);
        $markup = str_replace('"./favicon.svg', '"' . SMARTROOM_CALC_ASSETS_URL . 'favicon.svg', $markup);

        self::render_shell('Storage Calculator', '<main>' . $markup . '</main>', true);
    }

    private static function render_success() {
        $session_id = isset($_GET['session_id']) ? sanitize_text_field($_GET['session_id']) : '';
        $order_id = $session_id ? SmartRoom_Calc_Orders::find_by_session($session_id) : null;

        ob_start();
        ?>
        <div class="sr-status">
            <div class="sr-status__card">
                <div class="sr-status__icon sr-status__icon--ok">✓</div>
                <h1>Payment successful</h1>
                <p>Thank you! Your storage booking has been confirmed.</p>
                <?php if ($order_id): ?>
                    <p class="sr-status__ref">Reference: <strong>#<?php echo esc_html($order_id); ?></strong></p>
                <?php endif; ?>
                <p>A confirmation email has been sent to you with all the booking details.</p>
                <a href="<?php echo esc_url(home_url('/')); ?>" class="sr-status__btn">Back to homepage</a>
            </div>
        </div>
        <?php
        self::render_shell('Payment Successful', ob_get_clean(), false);
    }

    private static function render_cancel() {
        ob_start();
        ?>
        <div class="sr-status">
            <div class="sr-status__card">
                <div class="sr-status__icon sr-status__icon--err">×</div>
                <h1>Payment cancelled</h1>
                <p>No worries — your booking was not completed and you haven't been charged.</p>
                <a href="<?php echo esc_url(self::get_url()); ?>" class="sr-status__btn">Back to calculator</a>
            </div>
        </div>
        <?php
        self::render_shell('Payment Cancelled', ob_get_clean(), false);
    }

    /**
     * Render standalone HTML shell WITHOUT wp_head()/wp_footer().
     * This ensures the active theme cannot inject its own styles/scripts.
     *
     * @param string $title
     * @param string $body_html
     * @param bool   $load_calculator  If true, loads full calculator JS/CSS. If false, only minimal inline styles.
     */
    private static function render_shell($title, $body_html, $load_calculator) {
        while (ob_get_level() > 0) {
            @ob_end_clean();
        }
        header('Content-Type: text/html; charset=UTF-8');

        $url = SMARTROOM_CALC_ASSETS_URL;

        // Build site config for JS
        $site_config = SmartRoom_Calc_Settings::get_site_config();
        if (!is_array($site_config)) {
            $site_config = [];
        }
        $site_config['checkoutEndpoint'] = rest_url('smartroom/v1/checkout');
        $site_config['wpNonce'] = wp_create_nonce('wp_rest');
        $gkey = SmartRoom_Calc_Settings::get('google_maps_api_key', '');
        if ($gkey) {
            $site_config['googleMapsApiKey'] = $gkey;
        }
        $config_json = wp_json_encode($site_config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        ?><!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo esc_html($title); ?></title>
<link rel="icon" type="image/svg+xml" href="<?php echo esc_url($url . 'favicon.svg'); ?>">
<?php if ($load_calculator): ?>
<link rel="stylesheet" href="<?php echo esc_url($url . 'runtime-utils.css'); ?>">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollToPlugin.min.js"></script>
<link rel="modulepreload" crossorigin href="<?php echo esc_url($url . 'modulepreload-polyfill.js'); ?>">
<link rel="modulepreload" crossorigin href="<?php echo esc_url($url . 'runtime-utils.js'); ?>">
<link rel="modulepreload" crossorigin href="<?php echo esc_url($url . 'load-site-config.js'); ?>">
<link rel="modulepreload" crossorigin href="<?php echo esc_url($url . 'calculator.js'); ?>">
<script>window.__SMARTROOM_SITE_CONFIG__ = <?php echo $config_json; ?>;</script>
<?php else: ?>
<style>
    body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#1e293b}
    .sr-status{padding:2rem;width:100%}
    .sr-status__card{max-width:480px;margin:0 auto;background:#fff;padding:3rem 2rem;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
    .sr-status__icon{width:72px;height:72px;margin:0 auto 1.5rem;border-radius:50%;color:#fff;font-size:36px;display:flex;align-items:center;justify-content:center}
    .sr-status__icon--ok{background:#16a34a}
    .sr-status__icon--err{background:#dc2626}
    .sr-status h1{font-size:1.75rem;margin:0 0 1rem;color:#1e293b}
    .sr-status p{color:#64748b;line-height:1.6;margin:.5rem 0}
    .sr-status__ref{background:#f1f5f9;padding:.75rem;border-radius:8px;font-size:.9rem}
    .sr-status__btn{display:inline-block;margin-top:1.5rem;padding:.75rem 1.5rem;background:#0d0b9c;color:#fff;text-decoration:none;border-radius:8px;font-weight:500}
    .sr-status__btn:hover{background:#090787}
</style>
<?php endif; ?>
</head>
<body class="smartroom-calc-app">
<?php echo $body_html; ?>
<?php if ($load_calculator): ?>
<script type="module" crossorigin src="<?php echo esc_url($url . 'wp.js'); ?>"></script>
<?php endif; ?>
</body>
</html><?php
    }
}
