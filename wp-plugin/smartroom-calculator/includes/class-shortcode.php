<?php
if (!defined('ABSPATH')) exit;

/**
 * Shortcode [smartroom_calculator]
 *
 * Outputs a SMALL self-contained widget — the same pill-style postcode
 * input used on the calculator's initial view, nothing more. When the
 * user picks a Google Places suggestion and clicks the submit arrow,
 * the browser navigates to the full calculator page (plugin standalone
 * URL) with ?place_id=... in the query string.
 *
 * Key points:
 *  - NO iframe — two separate pages, connected only via the URL query
 *  - NO theme CSS leak — widget CSS is scoped under .smartroom-widget
 *    and inlined (only the rules we need, ~150 lines)
 *  - NO Google API key in browser — autocomplete goes through the
 *    /wp-json/smartroom/v1/places/autocomplete server-side proxy
 */
class SmartRoom_Calc_Shortcode {
    public static function init() {
        add_shortcode('smartroom_calculator', [__CLASS__, 'render']);
    }

    public static function render($atts = []) {
        $widget_id      = 'sr-widget-' . wp_generate_uuid4();
        $autocomplete_url = rest_url('smartroom/v1/places/autocomplete');
        $target_url     = SmartRoom_Calc_Standalone_Page::get_url();
        $mapsOk         = (bool) SmartRoom_Calc_Settings::get('google_maps_api_key', '');

        ob_start();
        ?>
<div class="smartroom-widget" id="<?php echo esc_attr($widget_id); ?>">
    <style><?php echo self::widget_css(); ?></style>

    <form class="sw-form<?php echo $mapsOk ? '' : ' sw-form--no-api'; ?>" novalidate>
        <div class="sw-panel">
            <div class="sw-input-wrap">
                <input
                    type="text"
                    class="sw-input"
                    placeholder="Enter Postcode"
                    autocomplete="off"
                    spellcheck="false"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded="false"
                    aria-haspopup="listbox"
                    <?php if (!$mapsOk) echo 'disabled'; ?>
                />
                <ul class="sw-dropdown" role="listbox" hidden></ul>
            </div>
            <button
                type="submit"
                class="sw-submit"
                aria-label="Get prices"
                <?php if (!$mapsOk) echo 'disabled'; ?>
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
        <div class="sw-messages" aria-live="polite">
            <p class="sw-helper">We collect boxes and furniture, store them, and deliver back anywhere in the world — even item by item.</p>
            <p class="sw-error">Please select a Postcode from the suggestions to continue</p>
        </div>
    </form>
</div>

<script>
(function () {
    var ROOT_ID = <?php echo wp_json_encode($widget_id); ?>;
    var AC_URL  = <?php echo wp_json_encode($autocomplete_url); ?>;
    var TARGET  = <?php echo wp_json_encode($target_url); ?>;

    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var form   = root.querySelector('.sw-form');
    var input  = root.querySelector('.sw-input');
    var list   = root.querySelector('.sw-dropdown');
    var submit = root.querySelector('.sw-submit');
    if (!form || !input || !list) return;

    var selected = null; // { placeId, text }
    var debounceTimer = null;
    var requestSeq = 0;

    function debounce(fn, ms) {
        return function () {
            var args = arguments;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () { fn.apply(null, args); }, ms);
        };
    }

    function hideList() {
        list.hidden = true;
        list.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
    }

    function showList() {
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    }

    function clearError() {
        form.classList.remove('is-invalid');
    }

    function markInvalid() {
        form.classList.add('is-invalid');
    }

    function renderList(items) {
        list.innerHTML = '';
        if (!items || !items.length) {
            hideList();
            return;
        }
        items.forEach(function (item, idx) {
            var li = document.createElement('li');
            li.className = 'sw-dropdown__item';
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.dataset.placeId = item.placeId || '';
            li.dataset.text = item.text || '';
            li.innerHTML =
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '<span>' + escapeHtml(item.text || '') + '</span>';
            li.addEventListener('click', function () {
                selected = { placeId: item.placeId, text: item.text };
                input.value = item.text || '';
                hideList();
                clearError();
            });
            list.appendChild(li);
        });
        showList();
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    var fetchSuggestions = debounce(async function () {
        var q = input.value.trim();
        if (q.length < 2) {
            hideList();
            return;
        }
        var mySeq = ++requestSeq;
        try {
            var res = await fetch(AC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: q }),
            });
            if (mySeq !== requestSeq) return; // stale response
            if (!res.ok) {
                hideList();
                return;
            }
            var data = await res.json();
            if (mySeq !== requestSeq) return;
            renderList(data && data.suggestions ? data.suggestions : []);
        } catch (e) {
            hideList();
        }
    }, 300);

    input.addEventListener('input', function () {
        selected = null; // user is typing → invalidate previous selection
        clearError();
        fetchSuggestions();
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!root.contains(e.target)) hideList();
    });

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
        var items = list.querySelectorAll('.sw-dropdown__item');
        if (!items.length) return;
        var cur = list.querySelector('.sw-dropdown__item.is-active');
        var idx = cur ? Array.prototype.indexOf.call(items, cur) : -1;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = Math.min(idx + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = Math.max(idx - 1, 0);
        } else if (e.key === 'Enter' && cur) {
            e.preventDefault();
            cur.click();
            return;
        } else if (e.key === 'Escape') {
            hideList();
            return;
        } else {
            return;
        }
        items.forEach(function (it, i) {
            it.classList.toggle('is-active', i === idx);
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!selected || !selected.placeId) {
            markInvalid();
            input.focus();
            return;
        }
        submit.classList.add('is-loading');
        var url = TARGET + (TARGET.indexOf('?') >= 0 ? '&' : '?') +
            'place_id=' + encodeURIComponent(selected.placeId) +
            '&postcode=' + encodeURIComponent(selected.text || '');
        window.location.assign(url);
    });
})();
</script>
        <?php
        return ob_get_clean();
    }

    /**
     * Inline CSS for the widget — scoped under .smartroom-widget so theme
     * rules don't leak in and widget rules don't leak out. Derived from
     * the .storage-form* rules in src/css/storage-style.css.
     */
    private static function widget_css() {
        return <<<CSS
.smartroom-widget{
  box-sizing:border-box;font-family:"Lexend",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  max-width:800px;margin:0 auto;width:100%;color:#111827;line-height:1.4;
}
.smartroom-widget *,.smartroom-widget *::before,.smartroom-widget *::after{box-sizing:border-box}
.smartroom-widget .sw-form{display:flex;flex-direction:column;align-items:center;width:100%;margin:0}
.smartroom-widget .sw-panel{
  display:flex;align-items:center;background:#fff;border-radius:100px;padding:4px;
  width:100%;max-width:800px;border:1px solid transparent;position:relative;
  box-shadow:0 4px 14px rgba(0,0,0,.08);height:58px;
}
.smartroom-widget .sw-form.is-invalid .sw-panel{border-color:#ff3b30}
.smartroom-widget .sw-input-wrap{
  flex-grow:1;display:flex;align-items:center;margin-right:8px;position:relative;
}
.smartroom-widget .sw-input{
  width:100%;border:none;background:transparent;font-family:inherit;font-size:1.1rem;
  color:#111827;outline:none;padding:10px 0 10px 16px;margin:0;
}
.smartroom-widget .sw-input::placeholder{color:#9ca3af;font-weight:400}
.smartroom-widget .sw-input:disabled{cursor:not-allowed;opacity:.6}
.smartroom-widget .sw-dropdown{
  position:absolute;top:calc(100% + 12px);left:0;width:100%;min-width:200px;
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -2px rgba(0,0,0,.05);
  list-style:none;padding:8px 0;margin:0;z-index:1000;max-height:240px;overflow-y:auto;
  scrollbar-width:none;-ms-overflow-style:none;
}
.smartroom-widget .sw-dropdown::-webkit-scrollbar{display:none}
.smartroom-widget .sw-dropdown[hidden]{display:none}
.smartroom-widget .sw-dropdown__item{
  padding:12px 16px;cursor:pointer;font-size:1rem;color:#111827;
  transition:background-color .2s;text-align:left;display:flex;align-items:center;gap:8px;
}
.smartroom-widget .sw-dropdown__item svg{flex-shrink:0}
.smartroom-widget .sw-dropdown__item:hover,
.smartroom-widget .sw-dropdown__item.is-active{background-color:#f3f4f6}
.smartroom-widget .sw-submit{
  display:flex;align-items:center;justify-content:center;width:48px;height:48px;
  border-radius:50%;background-color:#0d0b9c;color:#fff;border:none;cursor:pointer;
  flex-shrink:0;transition:background-color .2s;padding:0;font:inherit;
}
.smartroom-widget .sw-submit:hover:not(:disabled){background-color:#0a087a}
.smartroom-widget .sw-submit:disabled{opacity:.6;cursor:not-allowed}
.smartroom-widget .sw-submit.is-loading svg{display:none}
.smartroom-widget .sw-submit.is-loading::after{
  content:"";display:block;width:22px;height:22px;
  border:2px solid #fff;border-bottom-color:transparent;border-radius:50%;
  animation:sw-spin .8s linear infinite;
}
@keyframes sw-spin{100%{transform:rotate(360deg)}}
.smartroom-widget .sw-messages{
  margin:1rem auto 0;max-width:800px;height:20px;position:relative;width:100%;
  padding:0 20px;text-align:center;
}
.smartroom-widget .sw-helper,
.smartroom-widget .sw-error{
  position:absolute;top:0;left:20px;width:calc(100% - 40px);font-size:.9rem;
  text-align:center;margin:0;
}
.smartroom-widget .sw-helper{color:#6b7280;font-weight:300;opacity:1}
.smartroom-widget .sw-error{color:#ff3b30;font-weight:400;opacity:0}
.smartroom-widget .sw-form.is-invalid .sw-helper{opacity:0}
.smartroom-widget .sw-form.is-invalid .sw-error{opacity:1}
.smartroom-widget .sw-form--no-api .sw-messages .sw-helper{
  color:#ef4444;opacity:1;
}
@media (max-width:520px){
  .smartroom-widget .sw-panel{height:52px}
  .smartroom-widget .sw-input{font-size:1rem;padding-left:14px}
  .smartroom-widget .sw-submit{width:44px;height:44px}
  .smartroom-widget .sw-submit svg{width:22px;height:22px}
}
CSS;
    }
}
