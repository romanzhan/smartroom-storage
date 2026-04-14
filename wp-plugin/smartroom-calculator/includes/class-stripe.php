<?php
if (!defined('ABSPATH')) exit;

/**
 * Stripe Checkout integration using direct API calls (no SDK required).
 */
class SmartRoom_Calc_Stripe {
    const API_BASE = 'https://api.stripe.com/v1';

    public static function init() {
        // no-op, stateless helper class
    }

    /**
     * Create a Stripe Checkout Session for a one-time payment.
     *
     * @param array $order_data Order data (items, totals, customer, etc)
     * @param int   $order_id   WP post ID of the sr_order
     * @return array|WP_Error [checkout_url, session_id]
     */
    public static function create_checkout_session($order_data, $order_id) {
        $sk = SmartRoom_Calc_Settings::stripe_sk();
        if (!$sk) {
            return new WP_Error('stripe_not_configured', 'Stripe secret key is not set');
        }

        $currency = strtolower(SmartRoom_Calc_Settings::get('currency', 'gbp'));
        $totals   = $order_data['totals'] ?? [];
        $customer = $order_data['customer'] ?? [];

        // Amount to charge (first payment = subtotal)
        $amount_pence = (int) round(((float)($totals['subtotal'] ?? 0)) * 100);
        if ($amount_pence < 50) {
            return new WP_Error('amount_too_low', 'Order total must be at least £0.50');
        }

        $settings = SmartRoom_Calc_Settings::all();
        $success_base = !empty($settings['success_url'])
            ? $settings['success_url']
            : SmartRoom_Calc_Standalone_Page::get_url('success');
        $success_url = $success_base
            . (strpos($success_base, '?') === false ? '?' : '&')
            . 'session_id={CHECKOUT_SESSION_ID}';
        $cancel_url = !empty($settings['cancel_url'])
            ? $settings['cancel_url']
            : SmartRoom_Calc_Standalone_Page::get_url('cancel');

        // Line items breakdown
        $line_items = [];

        if (!empty($totals['storagePrice']) && (float)$totals['storagePrice'] > 0) {
            $line_items[] = [
                'name' => 'Storage (first month)',
                'amount' => (int) round((float)$totals['storagePrice'] * 100),
            ];
        }
        if (!empty($totals['insurancePrice']) && (float)$totals['insurancePrice'] > 0) {
            $line_items[] = [
                'name' => 'Insurance (first month)',
                'amount' => (int) round((float)$totals['insurancePrice'] * 100),
            ];
        }
        if (!empty($totals['collectionFee']) && (float)$totals['collectionFee'] > 0) {
            $line_items[] = [
                'name' => 'Collection fee',
                'amount' => (int) round((float)$totals['collectionFee'] * 100),
            ];
        }

        // If breakdown is empty or doesn't add up, fall back to single line item
        $line_items_sum = array_sum(array_column($line_items, 'amount'));
        if ($line_items_sum !== $amount_pence || empty($line_items)) {
            $line_items = [[
                'name'   => 'SmartRoom Storage Booking',
                'amount' => $amount_pence,
            ]];
        }

        // Build Stripe form-encoded payload
        $payload = [
            'mode' => 'payment',
            'success_url' => $success_url,
            'cancel_url'  => $cancel_url,
            'client_reference_id' => (string) $order_id,
            'metadata[order_id]'  => (string) $order_id,
        ];

        if (!empty($customer['email']) && is_email($customer['email'])) {
            $payload['customer_email'] = $customer['email'];
        }

        foreach ($line_items as $i => $item) {
            $payload["line_items[$i][quantity]"] = 1;
            $payload["line_items[$i][price_data][currency]"] = $currency;
            $payload["line_items[$i][price_data][unit_amount]"] = $item['amount'];
            $payload["line_items[$i][price_data][product_data][name]"] = $item['name'];
        }

        $response = self::api_request('POST', '/checkout/sessions', $payload, $sk);
        if (is_wp_error($response)) {
            return $response;
        }

        if (empty($response['url']) || empty($response['id'])) {
            return new WP_Error('stripe_bad_response', 'Invalid Stripe response', $response);
        }

        return [
            'checkout_url' => $response['url'],
            'session_id'   => $response['id'],
        ];
    }

    /**
     * Verify a Stripe webhook signature.
     *
     * @param string $payload Raw request body
     * @param string $sig     Stripe-Signature header
     * @param string $secret  Webhook signing secret (whsec_...)
     * @return bool
     */
    public static function verify_webhook($payload, $sig, $secret) {
        if (!$sig || !$secret) return false;

        $parts = [];
        foreach (explode(',', $sig) as $kv) {
            $pair = explode('=', $kv, 2);
            if (count($pair) === 2) {
                $parts[$pair[0]] = $pair[1];
            }
        }
        if (empty($parts['t']) || empty($parts['v1'])) return false;

        $signed = $parts['t'] . '.' . $payload;
        $expected = hash_hmac('sha256', $signed, $secret);

        if (!hash_equals($expected, $parts['v1'])) return false;

        // Prevent replay (5 minutes)
        if (abs(time() - (int) $parts['t']) > 300) return false;

        return true;
    }

    private static function api_request($method, $path, $data, $sk) {
        $url = self::API_BASE . $path;
        $args = [
            'method'  => $method,
            'headers' => [
                'Authorization' => 'Bearer ' . $sk,
                'Content-Type'  => 'application/x-www-form-urlencoded',
            ],
            'timeout' => 30,
            'body'    => http_build_query($data, '', '&'),
        ];

        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) return $response;

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 200 && $code < 300) {
            return $body;
        }

        $msg = $body['error']['message'] ?? 'Stripe API error';
        return new WP_Error('stripe_api_error', $msg, ['status' => $code, 'body' => $body]);
    }
}
