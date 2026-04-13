<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Email {
    public static function init() {
        // no-op
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
        ob_start();
        ?>
<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05)}
  .header{background:#0d0b9c;color:#fff;padding:24px;text-align:center}
  .header h1{margin:0;font-size:22px}
  .content{padding:24px}
  .content h2{font-size:16px;margin:20px 0 10px;color:#0d0b9c}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:8px 0;border-bottom:1px solid #e2e8f0}
  th{color:#64748b;font-weight:500;width:50%}
  .total{background:#f8fafc;padding:16px;border-radius:8px;margin-top:16px}
  .total .big{font-size:20px;font-weight:700;color:#0d0b9c}
  .footer{background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#64748b}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>SmartRoom Booking Confirmation</h1>
    <p style="margin:8px 0 0;font-size:14px;opacity:.9">Order #<?php echo esc_html($order_id); ?></p>
  </div>
  <div class="content">
    <p>Hi <?php echo esc_html($customer['name'] ?? ''); ?>,</p>
    <p>Thank you for booking with SmartRoom! Your payment has been received and your storage booking is confirmed.</p>

    <h2>Booking details</h2>
    <table>
      <?php if (!empty($data['bookingDetails'])): foreach ($data['bookingDetails'] as $row): ?>
        <tr><th><?php echo esc_html($row['label'] ?? ''); ?></th><td><?php echo esc_html($row['value'] ?? ''); ?></td></tr>
      <?php endforeach; endif; ?>
    </table>

    <h2>Contact</h2>
    <table>
      <tr><th>Name</th><td><?php echo esc_html($customer['name'] ?? ''); ?></td></tr>
      <tr><th>Email</th><td><?php echo esc_html($customer['email'] ?? ''); ?></td></tr>
      <tr><th>Phone</th><td><?php echo esc_html($customer['phone'] ?? ''); ?></td></tr>
    </table>

    <h2>Payment breakdown</h2>
    <table>
      <tr><th>Storage (first month)</th><td>£<?php echo number_format((float)($totals['storagePrice'] ?? 0), 2); ?></td></tr>
      <tr><th>Insurance</th><td>£<?php echo number_format((float)($totals['insurancePrice'] ?? 0), 2); ?></td></tr>
      <tr><th>Collection fee</th><td>£<?php echo number_format((float)($totals['collectionFee'] ?? 0), 2); ?></td></tr>
      <?php if (!empty($totals['vatAmount'])): ?>
        <tr><th>incl. VAT</th><td>£<?php echo number_format((float)$totals['vatAmount'], 2); ?></td></tr>
      <?php endif; ?>
    </table>

    <div class="total">
      <table>
        <tr><th style="color:#1e293b;font-weight:600">Total paid</th><td class="big">£<?php echo number_format((float)($totals['subtotal'] ?? 0), 2); ?></td></tr>
        <tr><th>Monthly (starting next month)</th><td>£<?php echo number_format((float)($totals['monthlyPayment'] ?? 0), 2); ?></td></tr>
      </table>
    </div>

    <p style="margin-top:20px;color:#64748b;font-size:13px">If you have any questions about your booking, please reply to this email.</p>
  </div>
  <div class="footer">
    <?php echo esc_html(get_bloginfo('name')); ?> · <?php echo esc_html(home_url('/')); ?>
  </div>
</div>
</body>
</html>
        <?php
        return ob_get_clean();
    }
}
