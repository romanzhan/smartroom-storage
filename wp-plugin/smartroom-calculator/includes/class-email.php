<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Email {
    public static function init() {
        // no-op
    }

    public static function send_inventory_submitted($order_id, $inventory) {
        $settings = SmartRoom_Calc_Settings::all();
        if (empty($settings['email_admin'])) return;

        $customer = SmartRoom_Calc_Orders::get_customer($order_id);
        $subject  = sprintf('[SmartRoom] Pickup checklist submitted — order #%d', $order_id);

        $lines = [];
        foreach (($inventory['items'] ?? []) as $it) {
            if (!empty($it['qty']) && !empty($it['label'])) {
                $lines[] = sprintf('%dx %s', (int) $it['qty'], $it['label']);
            }
        }
        $notes = $inventory['notes'] ?? '';

        ob_start(); ?>
<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1e293b;padding:20px;background:#f1f5f9">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
<h2 style="color:#0d0b9c;margin-top:0">Pickup checklist submitted</h2>
<p>Customer <strong><?php echo esc_html($customer['name'] ?? ''); ?></strong> (<?php echo esc_html($customer['email'] ?? ''); ?>) submitted a pickup checklist for order #<?php echo esc_html($order_id); ?>.</p>
<h3>Items</h3>
<?php if ($lines): ?>
<ul><?php foreach ($lines as $l): ?><li><?php echo esc_html($l); ?></li><?php endforeach; ?></ul>
<?php else: ?>
<p><em>No items marked.</em></p>
<?php endif; ?>
<?php if ($notes): ?>
<h3>Notes</h3>
<p style="background:#f8fafc;padding:12px;border-radius:6px;white-space:pre-wrap"><?php echo esc_html($notes); ?></p>
<?php endif; ?>
<p style="margin-top:24px"><a href="<?php echo esc_url(admin_url('post.php?post=' . $order_id . '&action=edit')); ?>" style="background:#0d0b9c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View order in admin</a></p>
</div>
</body></html>
        <?php
        $body = ob_get_clean();

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . get_bloginfo('name') . ' <' . get_option('admin_email') . '>',
        ];

        $admin_email = $settings['admin_email'] ?? get_option('admin_email');
        wp_mail($admin_email, $subject, $body, $headers);
    }

    public static function send_order_confirmation($order_id) {
        $settings = SmartRoom_Calc_Settings::all();
        $customer = SmartRoom_Calc_Orders::get_customer($order_id);
        $totals   = SmartRoom_Calc_Orders::get_totals($order_id);
        $data     = SmartRoom_Calc_Orders::get_data($order_id);

        $subject_c = sprintf('SmartRoom Booking Confirmation #%d', $order_id);
        $subject_a = sprintf('[SmartRoom] New paid order #%d — £%.2f', $order_id, (float)($totals['subtotal'] ?? 0));

        $body = self::build_body($order_id, $customer, $totals, $data);

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . get_bloginfo('name') . ' <' . (get_option('admin_email')) . '>',
        ];

        // Customer
        if (!empty($settings['email_customer']) && !empty($customer['email'])) {
            wp_mail($customer['email'], $subject_c, $body, $headers);
        }

        // Admin
        if (!empty($settings['email_admin'])) {
            $admin_email = $settings['admin_email'] ?? get_option('admin_email');
            wp_mail($admin_email, $subject_a, $body, $headers);
        }
    }

    private static function build_body($order_id, $customer, $totals, $data) {
        $addr     = $data['address'] ?? [];
        $date     = $data['date'] ?? [];
        $items    = $data['items'] ?? [];
        $extras   = $data['extras'] ?? [];
        $ins      = $data['insurance'] ?? [];
        $tab      = $data['tab'] ?? '';
        $duration = $data['duration'] ?? null;
        $isRolling = !empty($data['isRolling']);

        // Build extras catalog lookup
        $extras_catalog = [];
        $site_config = SmartRoom_Calc_Settings::get_site_config();
        if (is_array($site_config) && !empty($site_config['extras'])) {
            foreach ($site_config['extras'] as $e) {
                if (!empty($e['id'])) $extras_catalog[$e['id']] = $e;
            }
        }

        $date_str = '';
        if (!empty($date['iso'])) {
            $ts = strtotime($date['iso']);
            if ($ts) $date_str = date_i18n('D, j M Y', $ts);
        }

        $extra_rows = [];
        if (!empty($extras['quantities']) && is_array($extras['quantities'])) {
            foreach ($extras['quantities'] as $eid => $qty) {
                $qty = (int) $qty;
                if ($qty <= 0) continue;
                $meta = $extras_catalog[$eid] ?? ['name' => $eid, 'price' => 0];
                $extra_rows[] = [
                    'name'  => $meta['name'],
                    'qty'   => $qty,
                    'price' => (float) ($meta['price'] ?? 0),
                    'type'  => 'qty',
                ];
            }
        }
        if (!empty($extras['flags']) && is_array($extras['flags'])) {
            foreach ($extras['flags'] as $eid) {
                $meta = $extras_catalog[$eid] ?? ['name' => $eid];
                $extra_rows[] = ['name' => $meta['name'], 'type' => 'flag'];
            }
        }

        ob_start();
        ?>
<!doctype html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d0b9c 0%,#1e1bbf 100%);color:#fff;padding:32px 24px;text-align:center">
    <div style="width:56px;height:56px;margin:0 auto 16px;background:rgba(255,255,255,.2);border-radius:50%;display:inline-block;line-height:56px;font-size:28px">✓</div>
    <h1 style="margin:0;font-size:24px;font-weight:600">Booking Confirmed</h1>
    <p style="margin:8px 0 0;font-size:14px;opacity:.9">Order #<?php echo esc_html($order_id); ?></p>
  </div>

  <!-- Body -->
  <div style="padding:28px 24px">
    <p style="margin:0 0 16px;font-size:16px">Hi <strong><?php echo esc_html($customer['name'] ?? ''); ?></strong>,</p>
    <p style="margin:0 0 24px;color:#64748b;line-height:1.6">
      Thank you for booking with SmartRoom. Your payment has been received and we've saved everything below. We'll be in touch shortly to confirm the details.
    </p>

    <!-- What you're storing -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
      <h2 style="margin:0 0 12px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600">
        <?php echo $tab === 'furniture' ? 'Furniture storage' : 'Box storage'; ?>
      </h2>
      <?php foreach ($items as $it):
        $qty = (int)($it['qty'] ?? 0);
        $price = (float)($it['price'] ?? 0);
      ?>
        <div style="padding:8px 0;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0">
          <span><?php echo $qty; ?>× <?php echo esc_html($it['name'] ?? ''); ?></span>
          <span style="color:#64748b">£<?php echo number_format($price, 2); ?> / 4 wk</span>
        </div>
      <?php endforeach; ?>
      <div style="padding:10px 0 0;display:flex;justify-content:space-between;font-size:14px">
        <span style="color:#64748b">Duration</span>
        <span><?php echo $isRolling ? 'Rolling monthly' : ($duration ? esc_html($duration) . ' months' : '—'); ?></span>
      </div>
      <?php if (!empty($ins['price'])): ?>
      <div style="padding:6px 0 0;display:flex;justify-content:space-between;font-size:14px">
        <span style="color:#64748b">Insurance</span>
        <span>£<?php echo number_format((float)$ins['cover'], 0, '.', ','); ?> cover · £<?php echo number_format((float)$ins['price'], 2); ?>/mo</span>
      </div>
      <?php endif; ?>
    </div>

    <!-- Delivery -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
      <h2 style="margin:0 0 12px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600">
        <?php echo ($addr['mode'] ?? '') === 'collection' ? 'Home Collection' : 'Drop-off'; ?>
      </h2>
      <?php if (($addr['mode'] ?? '') === 'collection'): ?>
        <p style="margin:0 0 8px;font-size:15px;font-weight:500"><?php echo esc_html($addr['address'] ?? ''); ?></p>
        <p style="margin:0;color:#64748b;font-size:14px">
          <?php
          if (($addr['propType'] ?? '') === 'apartment') {
              $floor = (int)($addr['floor'] ?? 1);
              $lift = ($addr['lift'] ?? '') === 'yes';
              echo 'Apartment · floor ' . $floor . ' · ' . ($lift ? 'with lift' : 'no lift');
          } else {
              echo 'Ground floor';
          }
          ?>
        </p>
        <?php if (!empty($addr['instructions'])): ?>
          <p style="margin:10px 0 0;padding:10px;background:#fff;border-radius:6px;font-size:13px;color:#475569">
            <strong style="color:#1e293b">Notes:</strong> <?php echo esc_html($addr['instructions']); ?>
          </p>
        <?php endif; ?>
      <?php elseif (($addr['mode'] ?? '') === 'dropoff'): ?>
        <p style="margin:0;font-size:15px">
          <?php
          $fac = $addr['facility'] ?? '';
          echo esc_html($fac === 'bloomsbury' ? 'Bloomsbury (WC1N 3QA)' : ($fac === 'hackney' ? 'Hackney (N16 8DR)' : '—'));
          ?>
        </p>
      <?php endif; ?>
      <?php if ($date_str || !empty($date['timeWindow'])): ?>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:14px">
        <span style="color:#64748b">Pickup date</span>
        <span style="font-weight:500"><?php echo esc_html(trim($date_str . ' ' . ($date['timeWindow'] ?? ''))); ?></span>
      </div>
      <?php endif; ?>
    </div>

    <!-- Extras -->
    <?php if ($extra_rows): ?>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px">
      <h2 style="margin:0 0 12px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600">Add-on services</h2>
      <?php foreach ($extra_rows as $ex): ?>
        <div style="padding:6px 0;display:flex;justify-content:space-between;font-size:14px">
          <?php if ($ex['type'] === 'qty'): ?>
            <span><?php echo $ex['qty']; ?>× <?php echo esc_html($ex['name']); ?></span>
            <span style="color:#64748b">£<?php echo number_format($ex['qty'] * $ex['price'], 2); ?></span>
          <?php else: ?>
            <span><?php echo esc_html($ex['name']); ?></span>
            <span style="color:#64748b">on request</span>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <!-- Totals -->
    <div style="background:#0d0b9c;color:#fff;border-radius:10px;padding:20px;margin-bottom:16px">
      <h2 style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.04em;font-weight:600">Payment</h2>
      <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:14px;opacity:.85">
        <span>Storage (first month)</span>
        <span>£<?php echo number_format((float)($totals['storagePrice'] ?? 0), 2); ?></span>
      </div>
      <?php if (!empty($totals['insurancePrice'])): ?>
      <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:14px;opacity:.85">
        <span>Insurance</span>
        <span>£<?php echo number_format((float)$totals['insurancePrice'], 2); ?></span>
      </div>
      <?php endif; ?>
      <?php if (!empty($totals['collectionFee'])): ?>
      <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:14px;opacity:.85">
        <span>Collection fee</span>
        <span>£<?php echo number_format((float)$totals['collectionFee'], 2); ?></span>
      </div>
      <?php endif; ?>
      <?php if (!empty($totals['vatAmount'])): ?>
      <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:12px;opacity:.65">
        <span>incl. VAT</span>
        <span>£<?php echo number_format((float)$totals['vatAmount'], 2); ?></span>
      </div>
      <?php endif; ?>
      <div style="padding:14px 0 0;margin-top:10px;border-top:1px solid rgba(255,255,255,.2);display:flex;justify-content:space-between;font-size:18px;font-weight:700">
        <span>Total paid</span>
        <span>£<?php echo number_format((float)($totals['subtotal'] ?? 0), 2); ?></span>
      </div>
      <?php if (!empty($totals['monthlyPayment'])): ?>
      <div style="padding:6px 0 0;display:flex;justify-content:space-between;font-size:13px;opacity:.75">
        <span>Monthly (from month 2)</span>
        <span>£<?php echo number_format((float)$totals['monthlyPayment'], 2); ?></span>
      </div>
      <?php endif; ?>
    </div>

    <p style="margin:24px 0 0;color:#64748b;font-size:13px;text-align:center">
      Any questions? Just reply to this email.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#64748b">
    <?php echo esc_html(get_bloginfo('name')); ?> · <?php echo esc_html(home_url('/')); ?>
  </div>
</div>
</body>
</html>
        <?php
        return ob_get_clean();
    }
}
