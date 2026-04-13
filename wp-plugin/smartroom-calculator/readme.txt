=== SmartRoom Storage Calculator ===
Contributors: smartroom
Tags: calculator, storage, stripe, booking
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Multi-step storage calculator with Stripe Checkout integration.

== Description ==

SmartRoom Storage Calculator provides a full booking flow for storage services:

* Multi-step calculator (boxes / furniture)
* Google Maps address autocomplete
* Time-based collection fee calculation
* Stripe Checkout integration (test & live modes)
* Automated email notifications to customer and admin
* Order management in WP Admin
* Standalone page at /smartroom-calculator/ (no theme chrome)
* Shortcode [smartroom_calculator] for embedding

== Installation ==

1. Upload the plugin ZIP via Plugins → Add New → Upload Plugin
2. Activate the plugin
3. Go to SmartRoom → Stripe and Email to configure Stripe keys
4. Add webhook URL to Stripe Dashboard (shown on settings page)
5. Visit /smartroom-calculator/ to see the calculator

== Stripe Setup ==

1. Get test keys from https://dashboard.stripe.com/test/apikeys
2. Paste pk_test_... and sk_test_... into plugin settings
3. In Stripe Dashboard → Developers → Webhooks, click "Add endpoint"
4. Endpoint URL: https://yoursite.com/wp-json/smartroom/v1/webhook
5. Events to listen: checkout.session.completed, checkout.session.expired, payment_intent.payment_failed
6. Copy the signing secret (whsec_...) and paste into plugin settings

== Usage ==

**Standalone page:** visit yoursite.com/smartroom-calculator/
**Shortcode:** place `[smartroom_calculator]` on any page
**Admin menu:** SmartRoom → Orders / Settings / Calculator config

== Changelog ==

= 1.0.0 =
* Initial release
