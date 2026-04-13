<?php
if (!defined('ABSPATH')) exit;

/**
 * Standalone page at /smartroom-calculator/ — no theme header/footer.
 * Uses a rewrite rule + template_redirect to output a clean page.
 */
class SmartRoom_Calc_Standalone_Page {
    const SLUG = 'smartroom-calculator';
    const QUERY_VAR = 'sr_calc_page';

    public static function init() {
        add_action('init', [__CLASS__, 'add_rewrite_rule']);
        add_filter('query_vars', [__CLASS__, 'add_query_var']);
        add_action('template_redirect', [__CLASS__, 'maybe_render']);
    }

    public static function add_rewrite_rule() {
        add_rewrite_rule(
            '^' . self::SLUG . '/?$',
            'index.php?' . self::QUERY_VAR . '=1',
            'top'
        );
        add_rewrite_rule(
            '^' . self::SLUG . '/success/?$',
            'index.php?' . self::QUERY_VAR . '=success',
            'top'
        );
        add_rewrite_rule(
            '^' . self::SLUG . '/cancel/?$',
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
        SmartRoom_Calc_Shortcode::enqueue();

        $markup_file = SMARTROOM_CALC_PATH . 'templates/calculator-markup.html';
        $markup = file_exists($markup_file) ? file_get_contents($markup_file) : '<p>Markup missing.</p>';
        $markup = str_replace('./assets/', SMARTROOM_CALC_ASSETS_URL, $markup);
        $markup = str_replace('"./favicon.svg', '"' . SMARTROOM_CALC_ASSETS_URL . 'favicon.svg', $markup);

        self::render_shell('Storage Calculator', '<main>' . $markup . '</main>');
    }

    private static function render_success() {
        $session_id = isset($_GET['session_id']) ? sanitize_text_field($_GET['session_id']) : '';
        $order_id = $session_id ? SmartRoom_Calc_Orders::find_by_session($session_id) : null;

        ob_start();
        ?>
        <div class="sr-success">
            <div class="sr-success__card">
                <div class="sr-success__icon">✓</div>
                <h1>Payment successful</h1>
                <p>Thank you! Your storage booking has been confirmed.</p>
                <?php if ($order_id): ?>
                    <p class="sr-success__ref">Reference: <strong>#<?php echo esc_html($order_id); ?></strong></p>
                <?php endif; ?>
                <p>A confirmation email has been sent to you with all the booking details.</p>
                <a href="<?php echo esc_url(home_url('/')); ?>" class="sr-success__btn">Back to homepage</a>
            </div>
        </div>
        <style>
            body{margin:0;font-family:'Lexend',system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}
            .sr-success{padding:2rem;width:100%}
            .sr-success__card{max-width:480px;margin:0 auto;background:#fff;padding:3rem 2rem;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
            .sr-success__icon{width:72px;height:72px;margin:0 auto 1.5rem;border-radius:50%;background:#16a34a;color:#fff;font-size:36px;display:flex;align-items:center;justify-content:center}
            .sr-success h1{font-size:1.75rem;margin:0 0 1rem;color:#1e293b}
            .sr-success p{color:#64748b;line-height:1.6;margin:.5rem 0}
            .sr-success__ref{background:#f1f5f9;padding:.75rem;border-radius:8px;font-size:.9rem}
            .sr-success__btn{display:inline-block;margin-top:1.5rem;padding:.75rem 1.5rem;background:#0d0b9c;color:#fff;text-decoration:none;border-radius:8px;font-weight:500}
            .sr-success__btn:hover{background:#090787}
        </style>
        <?php
        self::render_shell('Payment Successful', ob_get_clean());
    }

    private static function render_cancel() {
        ob_start();
        ?>
        <div class="sr-success">
            <div class="sr-success__card">
                <div class="sr-success__icon" style="background:#dc2626">×</div>
                <h1>Payment cancelled</h1>
                <p>No worries — your booking was not completed and you haven't been charged.</p>
                <a href="<?php echo esc_url(home_url('/' . self::SLUG . '/')); ?>" class="sr-success__btn">Back to calculator</a>
            </div>
        </div>
        <style>
            body{margin:0;font-family:'Lexend',system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}
            .sr-success{padding:2rem;width:100%}
            .sr-success__card{max-width:480px;margin:0 auto;background:#fff;padding:3rem 2rem;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
            .sr-success__icon{width:72px;height:72px;margin:0 auto 1.5rem;border-radius:50%;color:#fff;font-size:36px;display:flex;align-items:center;justify-content:center}
            .sr-success h1{font-size:1.75rem;margin:0 0 1rem;color:#1e293b}
            .sr-success p{color:#64748b;line-height:1.6;margin:.5rem 0}
            .sr-success__btn{display:inline-block;margin-top:1.5rem;padding:.75rem 1.5rem;background:#0d0b9c;color:#fff;text-decoration:none;border-radius:8px;font-weight:500}
        </style>
        <?php
        self::render_shell('Payment Cancelled', ob_get_clean());
    }

    private static function render_shell($title, $body_html) {
        // Print scripts/styles that WP queued
        header('Content-Type: text/html; charset=UTF-8');
        ?><!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo esc_html($title); ?></title>
<link rel="icon" type="image/svg+xml" href="<?php echo esc_url(SMARTROOM_CALC_ASSETS_URL . 'favicon.svg'); ?>">
<?php wp_head(); ?>
</head>
<body class="smartroom-calc-app">
<?php echo $body_html; ?>
<?php wp_footer(); ?>
</body>
</html><?php
    }
}
