<?php
// Uninstall — cleanup options and orders. Keeps data by default; uncomment to purge.
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Keep orders and settings by default. If you want to purge on uninstall, uncomment:
// delete_option('smartroom_calc_settings');
// delete_option('smartroom_calc_site_config');
//
// $orders = get_posts([
//     'post_type' => 'sr_order',
//     'numberposts' => -1,
//     'post_status' => 'any',
//     'fields' => 'ids',
// ]);
// foreach ($orders as $id) wp_delete_post($id, true);
