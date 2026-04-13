<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Settings {
    public static function init() {
        // no-op, used as wrapper
    }

    public static function get($key, $default = null) {
        $opts = get_option(SMARTROOM_CALC_OPT_SETTINGS, []);
        return $opts[$key] ?? $default;
    }

    public static function all() {
        return get_option(SMARTROOM_CALC_OPT_SETTINGS, []);
    }

    public static function save($data) {
        $current = self::all();
        $new = array_merge($current, $data);
        update_option(SMARTROOM_CALC_OPT_SETTINGS, $new);
        return $new;
    }

    public static function get_site_config() {
        return get_option(SMARTROOM_CALC_OPT_CONFIG, null);
    }

    public static function save_site_config($config) {
        update_option(SMARTROOM_CALC_OPT_CONFIG, $config);
    }

    public static function is_live() {
        return self::get('stripe_mode', 'test') === 'live';
    }

    public static function stripe_pk() {
        return self::is_live() ? self::get('stripe_live_pk') : self::get('stripe_test_pk');
    }

    public static function stripe_sk() {
        return self::is_live() ? self::get('stripe_live_sk') : self::get('stripe_test_sk');
    }

    public static function stripe_webhook_secret() {
        return self::is_live() ? self::get('stripe_live_whsec') : self::get('stripe_test_whsec');
    }
}
