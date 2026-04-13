<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Shortcode {
    const HANDLE = 'smartroom-calc';

    public static function init() {
        add_shortcode('smartroom_calculator', [__CLASS__, 'render']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'register_assets']);
    }

    public static function register_assets() {
        // Register (not enqueue) — enqueue on demand when shortcode renders
        wp_register_style(
            self::HANDLE,
            SMARTROOM_CALC_ASSETS_URL . 'runtime-utils.css',
            [],
            SMARTROOM_CALC_VERSION
        );

        // GSAP from CDN (as required by the calculator)
        wp_register_script(
            'gsap',
            'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
            [],
            '3.12.5',
            false
        );
        wp_register_script(
            'gsap-scrollto',
            'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollToPlugin.min.js',
            ['gsap'],
            '3.12.5',
            false
        );

        wp_register_script(
            self::HANDLE,
            SMARTROOM_CALC_ASSETS_URL . 'wp.js',
            ['gsap', 'gsap-scrollto'],
            SMARTROOM_CALC_VERSION,
            true
        );

        // Module type (Vite output is ES modules)
        add_filter('script_loader_tag', [__CLASS__, 'add_module_type'], 10, 3);
    }

    public static function add_module_type($tag, $handle, $src) {
        $modules = [self::HANDLE];
        if (in_array($handle, $modules, true)) {
            return '<script type="module" crossorigin src="' . esc_url($src) . '"></script>' . "\n";
        }
        return $tag;
    }

    public static function enqueue() {
        wp_enqueue_style(self::HANDLE);
        wp_enqueue_script('gsap');
        wp_enqueue_script('gsap-scrollto');
        wp_enqueue_script(self::HANDLE);

        // Pass config + endpoints to JS
        $site_config = SmartRoom_Calc_Settings::get_site_config();
        if (!is_array($site_config)) {
            $site_config = [];
        }
        $site_config['checkoutEndpoint'] = rest_url('smartroom/v1/checkout');
        $site_config['wpNonce'] = wp_create_nonce('wp_rest');

        // Inject as global BEFORE the module script
        $json = wp_json_encode($site_config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        wp_add_inline_script(
            self::HANDLE,
            'window.__SMARTROOM_SITE_CONFIG__ = ' . $json . ';',
            'before'
        );

        // Preload hints (Vite modulepreload)
        add_action('wp_head', [__CLASS__, 'preload_hints'], 5);
    }

    public static function preload_hints() {
        $assets = [
            'modulepreload-polyfill.js',
            'runtime-utils.js',
            'load-site-config.js',
            'calculator.js',
        ];
        foreach ($assets as $a) {
            echo '<link rel="modulepreload" crossorigin href="' . esc_url(SMARTROOM_CALC_ASSETS_URL . $a) . '">' . "\n";
        }
    }

    public static function render($atts = []) {
        self::enqueue();

        $markup_file = SMARTROOM_CALC_PATH . 'templates/calculator-markup.html';
        if (!file_exists($markup_file)) {
            return '<div class="smartroom-calc-error">Calculator markup missing. Rebuild the plugin.</div>';
        }

        $markup = file_get_contents($markup_file);

        // Rewrite any remaining relative asset URLs to plugin assets URL
        $markup = str_replace('./assets/', SMARTROOM_CALC_ASSETS_URL, $markup);
        $markup = str_replace('"./favicon.svg', '"' . SMARTROOM_CALC_ASSETS_URL . 'favicon.svg', $markup);

        return '<div class="smartroom-calc-app"><main>' . $markup . '</main></div>';
    }
}
