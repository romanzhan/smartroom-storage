<?php
if (!defined('ABSPATH')) exit;

/**
 * Shortcode [smartroom_calculator]
 *
 * Renders the calculator inside an <iframe> that points at the standalone
 * calculator URL of the plugin. This gives us:
 *   - Full CSS / JS isolation from the host theme — no style leaks either way
 *   - Works identically inside Elementor editor preview and on the live page
 *   - No dependency on WP's wp_enqueue_scripts hook firing at the right time
 *
 * Dynamic height: the iframe's inner page posts its scrollHeight via
 * postMessage, parent listener resizes the iframe to match. See
 * class-standalone-page.php render_shell() for the sender side.
 *
 * Shortcode attributes:
 *   height (int, default 900)  — initial min-height in pixels
 */
class SmartRoom_Calc_Shortcode {
    public static function init() {
        add_shortcode('smartroom_calculator', [__CLASS__, 'render']);
    }

    public static function render($atts = []) {
        $atts = shortcode_atts([
            'height' => 900,
        ], is_array($atts) ? $atts : [], 'smartroom_calculator');

        $min_height = max(400, (int) $atts['height']);
        $src        = SmartRoom_Calc_Standalone_Page::get_url();
        $frame_id   = 'smartroom-calc-frame-' . wp_generate_uuid4();

        ob_start();
        ?>
<div class="smartroom-calc-embed" style="width:100%;max-width:100%">
    <iframe
        id="<?php echo esc_attr($frame_id); ?>"
        class="smartroom-calc-iframe"
        src="<?php echo esc_url($src); ?>"
        title="SmartRoom Storage Calculator"
        style="width:100%;border:0;display:block;min-height:<?php echo (int) $min_height; ?>px;overflow:hidden"
        scrolling="no"
        allow="clipboard-write"
        allowtransparency="true"
    ></iframe>
</div>
<script>
(function () {
    var frame = document.getElementById(<?php echo wp_json_encode($frame_id); ?>);
    if (!frame) return;

    // Listen for height updates from the calculator inside the iframe
    window.addEventListener('message', function (e) {
        if (!e || !e.data || typeof e.data !== 'object') return;
        if (e.data.type !== 'smartroom-calc-height') return;
        if (e.source !== frame.contentWindow) return;
        var h = parseInt(e.data.height, 10);
        if (h > 0) {
            frame.style.height = h + 'px';
        }
    });
})();
</script>
        <?php
        return ob_get_clean();
    }
}
