<?php
if (!defined('ABSPATH')) exit;

class SmartRoom_Calc_Rest_Api {
    const NS = 'smartroom/v1';

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        register_rest_route(self::NS, '/checkout', [
            'methods'  => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'checkout'],
            'permission_callback' => '__return_true', // public — customers create orders
        ]);

        register_rest_route(self::NS, '/webhook', [
            'methods'  => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'webhook'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NS, '/config', [
            'methods'  => WP_REST_Server::READABLE,
            'callback' => [__CLASS__, 'get_config'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NS, '/inventory', [
            'methods'  => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'save_inventory'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function save_inventory(WP_REST_Request $req) {
        $data = $req->get_json_params();
        if (!is_array($data)) {
            return new WP_REST_Response(['message' => 'Invalid payload'], 400);
        }

        $session_id = isset($data['session_id']) ? sanitize_text_field($data['session_id']) : '';
        if (!$session_id) {
            return new WP_REST_Response(['message' => 'session_id required'], 400);
        }

        $order_id = SmartRoom_Calc_Orders::find_by_session($session_id);
        if (!$order_id) {
            return new WP_REST_Response(['message' => 'Order not found'], 404);
        }

        $items = isset($data['items']) && is_array($data['items']) ? $data['items'] : [];
        $notes = isset($data['notes']) ? sanitize_textarea_field($data['notes']) : '';

        $clean = [
            'items' => array_map(function ($it) {
                return [
                    'label' => sanitize_text_field($it['label'] ?? ''),
                    'qty'   => max(0, (int) ($it['qty'] ?? 0)),
                ];
            }, $items),
            'notes' => $notes,
        ];

        SmartRoom_Calc_Orders::save_inventory($order_id, $clean);
        SmartRoom_Calc_Email::send_inventory_submitted($order_id, $clean);

        return new WP_REST_Response(['ok' => true], 200);
    }

    public static function checkout(WP_REST_Request $req) {
        $data = $req->get_json_params();
        if (!is_array($data)) {
            return new WP_REST_Response(['message' => 'Invalid payload'], 400);
        }

        $customer = $data['customer'] ?? [];
        if (empty($customer['email']) || !is_email($customer['email'])) {
            return new WP_REST_Response(['message' => 'Valid email is required'], 400);
        }
        if (empty($customer['name'])) {
            return new WP_REST_Response(['message' => 'Name is required'], 400);
        }

        $totals = $data['totals'] ?? [];
        if (empty($totals['subtotal']) || (float)$totals['subtotal'] <= 0) {
            return new WP_REST_Response(['message' => 'Order total is missing'], 400);
        }

        // Create pending order
        $order_id = SmartRoom_Calc_Orders::create($data, $totals, $customer);
        if (!$order_id) {
            return new WP_REST_Response(['message' => 'Could not create order'], 500);
        }

        // Create Stripe Checkout Session
        $session = SmartRoom_Calc_Stripe::create_checkout_session($data, $order_id);
        if (is_wp_error($session)) {
            SmartRoom_Calc_Orders::mark_failed($order_id);
            return new WP_REST_Response([
                'message' => $session->get_error_message(),
            ], 500);
        }

        SmartRoom_Calc_Orders::set_stripe_session($order_id, $session['session_id']);

        return new WP_REST_Response([
            'checkout_url' => $session['checkout_url'],
            'order_id'     => $order_id,
        ], 200);
    }

    public static function webhook(WP_REST_Request $req) {
        $payload = $req->get_body();
        $sig = $req->get_header('stripe_signature') ?: $req->get_header('Stripe-Signature');
        $secret = SmartRoom_Calc_Settings::stripe_webhook_secret();

        if ($secret) {
            $ok = SmartRoom_Calc_Stripe::verify_webhook($payload, $sig, $secret);
            if (!$ok) {
                return new WP_REST_Response(['message' => 'Invalid signature'], 400);
            }
        }

        $event = json_decode($payload, true);
        if (!is_array($event) || empty($event['type'])) {
            return new WP_REST_Response(['message' => 'Invalid event'], 400);
        }

        $type = $event['type'];
        $obj = $event['data']['object'] ?? [];

        if ($type === 'checkout.session.completed') {
            $session_id = $obj['id'] ?? '';
            $payment_intent = $obj['payment_intent'] ?? '';
            $order_id = SmartRoom_Calc_Orders::find_by_session($session_id);

            if ($order_id) {
                SmartRoom_Calc_Orders::mark_paid_and_notify($order_id, $payment_intent);
            }
        } elseif ($type === 'checkout.session.expired' || $type === 'payment_intent.payment_failed') {
            $session_id = $obj['id'] ?? '';
            $order_id = SmartRoom_Calc_Orders::find_by_session($session_id);
            if ($order_id) {
                SmartRoom_Calc_Orders::mark_failed($order_id);
            }
        }

        return new WP_REST_Response(['received' => true], 200);
    }

    public static function get_config() {
        $config = SmartRoom_Calc_Settings::get_site_config();
        return new WP_REST_Response($config ?: new stdClass(), 200);
    }
}
