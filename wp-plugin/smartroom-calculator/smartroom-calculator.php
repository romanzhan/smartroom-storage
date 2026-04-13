<?php
/**
 * Plugin Name: SmartRoom Storage Calculator
 * Plugin URI:  https://smartroom.co.uk/
 * Description: Multi-step storage calculator with Stripe Checkout integration. Provides a shortcode [smartroom_calculator] and a standalone page at /smartroom-calculator.
 * Version:     1.0.0
 * Author:      SmartRoom
 * License:     GPL-2.0-or-later
 * Text Domain: smartroom-calculator
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SMARTROOM_CALC_VERSION', '1.0.0');
define('SMARTROOM_CALC_FILE', __FILE__);
define('SMARTROOM_CALC_PATH', plugin_dir_path(__FILE__));
define('SMARTROOM_CALC_URL', plugin_dir_url(__FILE__));
define('SMARTROOM_CALC_ASSETS_URL', SMARTROOM_CALC_URL . 'assets/');
define('SMARTROOM_CALC_OPT_SETTINGS', 'smartroom_calc_settings');
define('SMARTROOM_CALC_OPT_CONFIG', 'smartroom_calc_site_config');
define('SMARTROOM_CALC_CPT', 'sr_order');

// ── Includes ─────────────────────────────────────────────
require_once SMARTROOM_CALC_PATH . 'includes/class-settings.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-orders.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-shortcode.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-admin.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-stripe.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-rest-api.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-email.php';
require_once SMARTROOM_CALC_PATH . 'includes/class-standalone-page.php';

// ── Init ─────────────────────────────────────────────────
add_action('plugins_loaded', function () {
    SmartRoom_Calc_Settings::init();
    SmartRoom_Calc_Orders::init();
    SmartRoom_Calc_Shortcode::init();
    SmartRoom_Calc_Admin::init();
    SmartRoom_Calc_Stripe::init();
    SmartRoom_Calc_Rest_Api::init();
    SmartRoom_Calc_Email::init();
    SmartRoom_Calc_Standalone_Page::init();
});

// ── Activation / Deactivation ────────────────────────────
register_activation_hook(__FILE__, function () {
    // Register CPT before flushing rewrite rules
    require_once SMARTROOM_CALC_PATH . 'includes/class-orders.php';
    SmartRoom_Calc_Orders::register_post_type();

    require_once SMARTROOM_CALC_PATH . 'includes/class-standalone-page.php';
    SmartRoom_Calc_Standalone_Page::add_rewrite_rule();

    flush_rewrite_rules();

    // Seed default settings if not exists
    if (get_option(SMARTROOM_CALC_OPT_SETTINGS) === false) {
        add_option(SMARTROOM_CALC_OPT_SETTINGS, [
            'stripe_mode'           => 'test',
            'stripe_test_pk'        => '',
            'stripe_test_sk'        => '',
            'stripe_test_whsec'     => '',
            'stripe_live_pk'        => '',
            'stripe_live_sk'        => '',
            'stripe_live_whsec'     => '',
            'currency'              => 'gbp',
            'admin_email'           => get_option('admin_email'),
            'email_customer'        => 1,
            'email_admin'           => 1,
            'success_url'           => home_url('/smartroom-calculator/success/'),
            'cancel_url'            => home_url('/smartroom-calculator/'),
        ]);
    }
});

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
