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

    /**
     * Build an asset URL with a cache-busting query string (file mtime).
     * Only useful for entry assets (HTML-referenced) — ESM chunks imported
     * from inside other modules cannot be cache-busted this way.
     */
    public static function asset_url($relative) {
        $file = SMARTROOM_CALC_PATH . 'assets/' . $relative;
        $v = file_exists($file) ? filemtime($file) : SMARTROOM_CALC_VERSION;
        return SMARTROOM_CALC_ASSETS_URL . $relative . '?v=' . $v;
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

        // Prevent the theme from treating this virtual URL as 404
        global $wp_query;
        if ($wp_query) {
            $wp_query->is_404 = false;
            $wp_query->is_home = false;
            $wp_query->is_page = false;
            $wp_query->is_singular = false;
        }
        status_header(200);
        nocache_headers();

        if ($v === 'success' || $v === 'cancel') {
            // Success / cancel pages are wrapped in the active theme's
            // header and footer so they look like a native part of the site.
            self::render_with_theme_chrome($v);
        } else {
            // Standalone calculator page is served isolated (no theme chrome).
            // Most users embed the calculator via [smartroom_calculator] shortcode
            // in their page builder; this URL is a fallback for direct access.
            self::render_calculator();
        }
        exit;
    }

    private static function render_with_theme_chrome($type) {
        $title = $type === 'success' ? 'Payment Successful' : 'Payment Cancelled';

        // Set a nice browser title
        add_filter('pre_get_document_title', function () use ($title) {
            return $title . ' · ' . get_bloginfo('name');
        });
        // Ask search engines not to index the confirmation URL
        add_action('wp_head', function () {
            echo '<meta name="robots" content="noindex,nofollow">' . "\n";
        });

        if ($type === 'success') {
            self::verify_stripe_session();
        }

        get_header();
        echo '<main class="sr-theme-page" style="padding:48px 20px;min-height:60vh;background:#f1f5f9">';
        if ($type === 'success') {
            self::output_success_content();
        } else {
            self::output_cancel_content();
        }
        echo '</main>';
        get_footer();
    }

    /**
     * Verify the Stripe session for the current ?session_id and mark the
     * order paid if Stripe confirms — fallback in case webhook isn't set up.
     * Must be called BEFORE rendering (since mark_paid_and_notify sends email).
     */
    private static function verify_stripe_session() {
        $session_id = isset($_GET['session_id']) ? sanitize_text_field($_GET['session_id']) : '';
        if (!$session_id) return;

        $order_id = SmartRoom_Calc_Orders::find_by_session($session_id);
        if (!$order_id) return;
        if (SmartRoom_Calc_Orders::get_status($order_id) === SmartRoom_Calc_Orders::STATUS_PAID) return;

        $session = SmartRoom_Calc_Stripe::retrieve_checkout_session($session_id);
        if (is_wp_error($session) || empty($session['payment_status'])) return;
        if ($session['payment_status'] !== 'paid' && $session['payment_status'] !== 'no_payment_required') return;

        $pi = '';
        if (!empty($session['payment_intent'])) {
            $pi = is_array($session['payment_intent'])
                ? ($session['payment_intent']['id'] ?? '')
                : $session['payment_intent'];
        }
        SmartRoom_Calc_Orders::mark_paid_and_notify($order_id, $pi);
    }

    private static function render_calculator() {
        $markup_file = SMARTROOM_CALC_PATH . 'templates/calculator-markup.html';
        $markup = file_exists($markup_file) ? file_get_contents($markup_file) : '<p>Markup missing.</p>';
        $markup = str_replace('./assets/', SMARTROOM_CALC_ASSETS_URL, $markup);
        $markup = str_replace('"./favicon.svg', '"' . SMARTROOM_CALC_ASSETS_URL . 'favicon.svg', $markup);

        self::render_shell('Storage Calculator', '<main>' . $markup . '</main>');
    }

    private static function output_success_content() {
        $session_id = isset($_GET['session_id']) ? sanitize_text_field($_GET['session_id']) : '';
        $order_id = $session_id ? SmartRoom_Calc_Orders::find_by_session($session_id) : null;
        $is_collection = $order_id ? SmartRoom_Calc_Orders::is_collection($order_id) : false;
        $has_inventory = $order_id ? SmartRoom_Calc_Orders::get_inventory($order_id) : null;
        $rest_inventory_url = rest_url('smartroom/v1/inventory');
        ?>
        <div class="sr-success-page">
            <div class="sr-success-page__card">
                <div class="sr-success-page__icon" aria-hidden="true">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h1 class="sr-success-page__title">Payment successful</h1>
                <p class="sr-success-page__lead">
                    Your booking has been confirmed. A receipt has been sent to your email.
                </p>
                <?php if ($order_id): ?>
                    <p class="sr-success-page__ref">Reference: <strong>#<?php echo esc_html($order_id); ?></strong></p>
                <?php endif; ?>

                <?php if ($is_collection): ?>
                <div id="srInventoryBlock" class="sr-inventory-block"<?php echo $has_inventory ? ' data-submitted="1"' : ''; ?>>
                    <h2 class="sr-inventory-block__title">Pickup checklist</h2>
                    <p class="sr-inventory-block__intro">
                        For home collection we need a rough list of furniture and boxes so we can plan crew size and vehicle. Enter quantities below — add anything else under "Other".
                    </p>
                    <div class="sr-inventory-scroll">
                        <table class="sr-inventory-table" aria-label="Items we are collecting">
                            <thead>
                                <tr><th scope="col">Item</th><th scope="col">Qty</th></tr>
                            </thead>
                            <tbody>
                                <?php
                                $checklist = [
                                    'Sofa / corner sofa',
                                    'Armchair',
                                    'Bed & mattress (double+)',
                                    'Single / guest bed',
                                    'Wardrobe (any)',
                                    'Chest of drawers',
                                    'Dining table',
                                    'Dining chairs',
                                    'Desk / office',
                                    'TV / large screen',
                                    'Fridge / freezer',
                                    'Washing machine / dryer',
                                    'Large moving boxes',
                                    'Medium boxes',
                                    'Suitcases / bags',
                                ];
                                foreach ($checklist as $label): ?>
                                    <tr>
                                        <td><?php echo esc_html($label); ?></td>
                                        <td>
                                            <input type="number" class="sr-inventory-qty" min="0" max="99" value="0" inputmode="numeric" data-label="<?php echo esc_attr($label); ?>" aria-label="<?php echo esc_attr($label); ?> quantity">
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                    <label class="sr-inventory-block__notes-label" for="srInventoryNotes">Other items or details</label>
                    <textarea id="srInventoryNotes" class="sr-inventory-block__notes" rows="3" placeholder="e.g. piano, garden furniture, fragile art…"></textarea>
                    <p id="srInventoryError" class="sr-inventory-error" role="alert" hidden></p>
                    <button type="button" class="sr-inventory-block__submit" id="srInventorySubmit">Submit checklist</button>
                    <p id="srInventorySuccess" class="sr-inventory-success">Thanks! We got your list.</p>
                </div>
                <?php endif; ?>

                <p class="sr-success-page__nav">
                    <a href="<?php echo esc_url(home_url('/')); ?>" class="sr-success-page__home-link">Back to homepage</a>
                </p>
            </div>
        </div>

        <style>
            .sr-success-page{max-width:720px;margin:0 auto;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1e293b}
            .sr-success-page *{box-sizing:border-box}
            .sr-success-page__card{background:#fff;padding:48px 40px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
            .sr-success-page__icon{width:80px;height:80px;margin:0 auto 24px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center}
            .sr-success-page__title{font-size:2rem;margin:0 0 16px;color:#1e293b}
            .sr-success-page__lead{color:#64748b;line-height:1.6;font-size:1.05rem;margin:0 0 12px}
            .sr-success-page__ref{background:#f1f5f9;padding:12px;border-radius:8px;font-size:.95rem;display:inline-block;margin-top:8px}
            .sr-success-page__nav{margin-top:32px}
            .sr-success-page__home-link{color:#0d0b9c;text-decoration:none;font-weight:500}
            .sr-success-page__home-link:hover{text-decoration:underline}

            .sr-inventory-block{margin-top:40px;text-align:left;padding-top:32px;border-top:1px solid #e2e8f0}
            .sr-inventory-block[data-submitted="1"] .sr-inventory-qty,
            .sr-inventory-block[data-submitted="1"] #srInventoryNotes{pointer-events:none;opacity:.6}
            .sr-inventory-block[data-submitted="1"] #srInventorySubmit{display:none}
            .sr-inventory-block[data-submitted="1"] #srInventorySuccess{display:block}
            .sr-inventory-block__title{font-size:1.25rem;margin:0 0 12px;color:#0d0b9c}
            .sr-inventory-block__intro{color:#64748b;line-height:1.6;margin:0 0 20px;font-size:.95rem}
            .sr-inventory-scroll{max-height:320px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px}
            .sr-inventory-table{width:100%;border-collapse:collapse;font-size:.92rem}
            .sr-inventory-table th{background:#f8fafc;padding:10px 14px;text-align:left;color:#64748b;font-weight:500;border-bottom:1px solid #e2e8f0;position:sticky;top:0}
            .sr-inventory-table th:last-child{text-align:center;width:90px}
            .sr-inventory-table td{padding:8px 14px;border-bottom:1px solid #f1f5f9}
            .sr-inventory-table tr:last-child td{border-bottom:none}
            .sr-inventory-qty{width:72px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:.9rem;text-align:center;font-family:inherit;outline:none}
            .sr-inventory-qty:focus{border-color:#0d0b9c;box-shadow:0 0 0 3px rgba(13,11,156,.1)}
            .sr-inventory-block__notes-label{display:block;font-weight:500;margin-bottom:6px;font-size:.9rem}
            .sr-inventory-block__notes{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:.92rem;resize:vertical;outline:none;box-sizing:border-box}
            .sr-inventory-block__notes:focus{border-color:#0d0b9c;box-shadow:0 0 0 3px rgba(13,11,156,.1)}
            .sr-inventory-error{color:#dc2626;font-size:.88rem;margin:12px 0 0}
            .sr-inventory-block__submit{margin-top:16px;padding:12px 28px;background:#0d0b9c;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s}
            .sr-inventory-block__submit:hover{background:#090787}
            .sr-inventory-block__submit:disabled{opacity:.6;cursor:not-allowed}
            .sr-inventory-success{display:none;margin-top:16px;padding:12px;background:#f0fdf4;color:#16a34a;border-radius:8px;font-weight:500;text-align:center}
        </style>

        <?php if ($is_collection): ?>
        <script>
        (function() {
            const btn = document.getElementById('srInventorySubmit');
            if (!btn) return;
            const block = document.getElementById('srInventoryBlock');
            if (block && block.dataset.submitted === '1') return;

            const errEl = document.getElementById('srInventoryError');
            const notesEl = document.getElementById('srInventoryNotes');
            const successEl = document.getElementById('srInventorySuccess');

            btn.addEventListener('click', async () => {
                const items = [];
                document.querySelectorAll('.sr-inventory-qty').forEach((inp) => {
                    const qty = parseInt(inp.value, 10) || 0;
                    const label = inp.dataset.label || '';
                    if (qty > 0 && label) items.push({ label, qty });
                });
                const notes = (notesEl?.value || '').trim();

                if (items.length === 0 && !notes) {
                    if (errEl) {
                        errEl.textContent = 'Add at least one quantity or describe items under Other.';
                        errEl.hidden = false;
                    }
                    return;
                }
                if (errEl) errEl.hidden = true;
                btn.disabled = true;
                btn.textContent = 'Submitting…';

                try {
                    const res = await fetch(<?php echo wp_json_encode($rest_inventory_url); ?>, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: <?php echo wp_json_encode($session_id); ?>,
                            items,
                            notes,
                        }),
                    });
                    if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        throw new Error(body.message || 'Submission failed');
                    }
                    block.dataset.submitted = '1';
                    if (successEl) successEl.style.display = 'block';
                } catch (err) {
                    if (errEl) {
                        errEl.textContent = 'Could not submit: ' + (err.message || 'unknown error');
                        errEl.hidden = false;
                    }
                    btn.disabled = false;
                    btn.textContent = 'Submit checklist';
                }
            });
        })();
        </script>
        <?php endif; ?>
        <?php
    }

    private static function output_cancel_content() {
        ?>
        <div class="sr-status-page">
            <div class="sr-status-page__card">
                <div class="sr-status-page__icon sr-status-page__icon--err" aria-hidden="true">×</div>
                <h1 class="sr-status-page__title">Payment cancelled</h1>
                <p>No worries — your booking was not completed and you haven't been charged.</p>
                <a href="<?php echo esc_url(home_url('/')); ?>" class="sr-status-page__btn">Back to homepage</a>
            </div>
        </div>
        <style>
            .sr-status-page{max-width:480px;margin:0 auto;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1e293b}
            .sr-status-page__card{background:#fff;padding:48px 32px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
            .sr-status-page__icon{width:72px;height:72px;margin:0 auto 20px;border-radius:50%;color:#fff;font-size:36px;line-height:72px;display:block}
            .sr-status-page__icon--ok{background:#16a34a}
            .sr-status-page__icon--err{background:#dc2626}
            .sr-status-page__title{font-size:1.75rem;margin:0 0 12px;color:#1e293b}
            .sr-status-page p{color:#64748b;line-height:1.6;margin:.5rem 0}
            .sr-status-page__btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#0d0b9c;color:#fff;text-decoration:none;border-radius:8px;font-weight:500}
            .sr-status-page__btn:hover{background:#090787}
        </style>
        <?php
    }

    /**
     * Render the isolated standalone calculator page — no theme chrome.
     * Outputs a minimal HTML shell with just the calculator bundle.
     * Used only for direct access to /smartroom-calculator/; most installs
     * embed the calculator via the [smartroom_calculator] shortcode inside
     * a theme / Elementor page instead.
     */
    private static function render_shell($title, $body_html) {
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
<link rel="stylesheet" href="<?php echo esc_url(self::asset_url('runtime-utils.css')); ?>">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollToPlugin.min.js"></script>
<link rel="modulepreload" crossorigin href="<?php echo esc_url(self::asset_url('modulepreload-polyfill.js')); ?>">
<link rel="modulepreload" crossorigin href="<?php echo esc_url(self::asset_url('runtime-utils.js')); ?>">
<link rel="modulepreload" crossorigin href="<?php echo esc_url(self::asset_url('load-site-config.js')); ?>">
<link rel="modulepreload" crossorigin href="<?php echo esc_url(self::asset_url('calculator.js')); ?>">
<script>window.__SMARTROOM_SITE_CONFIG__ = <?php echo $config_json; ?>;</script>
<style>
html, body { background: transparent; }

/* ── Embedded (iframe) mode overrides ─────────────────────────
 * When the calculator is loaded inside an iframe via the [smartroom_calculator]
 * shortcode, we MUST neutralise any viewport-based sizing (min-height: 100vh,
 * etc). Otherwise setting the iframe height from the parent → grows viewport
 * → grows the 100vh element → grows body.scrollHeight → parent sets bigger
 * height → infinite feedback loop that can crash the browser.
 *
 * We hide the big marketing hero (video + title) in embedded mode — users
 * wrap the iframe in their own section in Elementor, they don't need our hero.
 */
html.sr-embedded,
body.sr-embedded {
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
    background: transparent !important;
}
body.sr-embedded .storage-hero {
    min-height: auto !important;
    height: auto !important;
    padding: 20px 16px !important;
    background: transparent !important;
    display: block !important;
}
body.sr-embedded .storage-hero__video,
body.sr-embedded .storage-hero__overlay,
body.sr-embedded .storage-hero__title {
    display: none !important;
}
body.sr-embedded .storage-hero__content {
    max-width: none !important;
    width: 100% !important;
    padding: 0 !important;
    position: static !important;
}
</style>
</head>
<body class="smartroom-calc-app">
<script>
/* Mark as embedded BEFORE anything else renders — CSS overrides kick in immediately */
(function () {
    if (window.parent !== window) {
        document.documentElement.className += ' sr-embedded';
        document.body.className += ' sr-embedded';
    }
})();
</script>
<?php echo $body_html; ?>
<script type="module" crossorigin src="<?php echo esc_url(self::asset_url('wp.js')); ?>"></script>
<script>
/* Iframe host communication — auto-resize & break out of iframe for Stripe */
(function () {
    if (window.parent === window) return; // not in iframe, nothing to do

    var MAX_HEIGHT = 15000;       // hard cap — protects against runaway loops
    var MIN_DELTA  = 4;           // skip reports smaller than this
    var RUNAWAY_STEPS = 12;       // consecutive growths of < 20px that trigger freeze

    var lastReported = 0;
    var rafPending = false;
    var growCount = 0;
    var frozen = false;

    function measure() {
        if (!document.body) return 0;
        var h = Math.max(
            document.body.offsetHeight || 0,
            document.body.scrollHeight || 0
        );
        return Math.min(Math.round(h), MAX_HEIGHT);
    }

    function doPost() {
        rafPending = false;
        if (frozen) return;

        var h = measure();
        if (h <= 0) return;

        // Detect slow runaway: small steady growth across many ticks
        if (h > lastReported && (h - lastReported) < 20) {
            growCount++;
            if (growCount > RUNAWAY_STEPS) {
                frozen = true;
                console.warn('[SmartRoom] iframe height runaway detected — freezing at', lastReported);
                return;
            }
        } else {
            growCount = 0;
        }

        if (Math.abs(h - lastReported) < MIN_DELTA) return;

        lastReported = h;
        try {
            window.parent.postMessage(
                { type: 'smartroom-calc-height', height: h },
                '*'
            );
        } catch (e) { /* noop */ }
    }

    function schedulePost() {
        if (rafPending || frozen) return;
        rafPending = true;
        if (window.requestAnimationFrame) {
            requestAnimationFrame(doPost);
        } else {
            setTimeout(doPost, 50);
        }
    }

    window.addEventListener('load', schedulePost);
    window.addEventListener('resize', schedulePost);

    if ('ResizeObserver' in window) {
        try {
            var ro = new ResizeObserver(schedulePost);
            if (document.body) ro.observe(document.body);
        } catch (e) {}
    }

    if ('MutationObserver' in window) {
        try {
            var mo = new MutationObserver(schedulePost);
            if (document.body) {
                mo.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                });
            }
        } catch (e) {}
    }

    schedulePost();
})();
</script>
</body>
</html><?php
    }
}
