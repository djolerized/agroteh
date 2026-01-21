<?php
/**
 * Plugin Name: Agro Kalkulator
 * Description: Agroekonomski kalkulator sa mapom, više koraka i PDF izveštajem.
 * Version: 1.0.0
 * Author: ChatGPT
 */

if (!defined('ABSPATH')) {
    exit;
}

class AgroKalkulator
{
    const VERSION = '1.0.0';
    const NONCE_ACTION = 'agro_kalkulator_nonce';

    public function __construct()
    {
        add_action('init', [$this, 'register_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
        add_action('admin_menu', [$this, 'register_admin_menu']);
        add_action('admin_post_agro_save_fuel', [$this, 'handle_save_fuel']);
        add_action('admin_post_agro_delete_fuel', [$this, 'handle_delete_fuel']);
        add_action('admin_post_agro_save_tractor', [$this, 'handle_save_tractor']);
        add_action('admin_post_agro_delete_tractor', [$this, 'handle_delete_tractor']);
        add_action('admin_post_agro_save_operation', [$this, 'handle_save_operation']);
        add_action('admin_post_agro_delete_operation', [$this, 'handle_delete_operation']);
        add_action('admin_post_agro_save_crop', [$this, 'handle_save_crop']);
        add_action('admin_post_agro_delete_crop', [$this, 'handle_delete_crop']);
        add_action('admin_post_agro_import_data', [$this, 'handle_import_data']);
        add_action('admin_post_agro_save_settings', [$this, 'handle_save_settings']);
        add_action('wp_ajax_agro_generate_pdf', [$this, 'handle_generate_pdf']);
        add_action('wp_ajax_nopriv_agro_generate_pdf', [$this, 'handle_generate_pdf']);
        register_activation_hook(__FILE__, [$this, 'activate']);
    }

    public function activate()
    {
        $this->maybe_seed_option('agro_fuels', $this->default_fuels());
        $this->maybe_seed_option('agro_tractors', $this->default_tractors());
        $this->maybe_seed_option('agro_operations', $this->default_operations());
        $this->maybe_seed_option('agro_crops', $this->default_crops());
        $this->maybe_seed_option('agro_eur_rate', 117);
    }

    private function maybe_seed_option($key, $value)
    {
        if (get_option($key) === false) {
            update_option($key, $value);
        }
    }

    private function default_fuels()
    {
        return [
            'euro_dizel' => [
                'fuel_id' => 'euro_dizel',
                'name' => 'Euro Dizel',
                'unit' => 'litar',
                'price_per_liter' => 204,
                'active' => 1,
            ],
            'bmb_100' => [
                'fuel_id' => 'bmb_100',
                'name' => 'Bezolovni benzin 100 oktana',
                'unit' => 'litar',
                'price_per_liter' => 210,
                'active' => 1,
            ],
        ];
    }

    private function default_tractors()
    {
        return [
            'traktor_33' => [
                'tractor_id' => 'traktor_33',
                'name' => 'Traktor do 33kW',
                'power_kw_from' => 0,
                'power_kw_to' => 33,
                'power_hp_label' => '45 KS',
                'unit' => 'čas',
                'fuel_l_per_unit' => 4,
                'price_per_unit' => 1770,
            ],
            'traktor_60' => [
                'tractor_id' => 'traktor_60',
                'name' => 'Traktor 33-60kW',
                'power_kw_from' => 33,
                'power_kw_to' => 60,
                'power_hp_label' => '80 KS',
                'unit' => 'čas',
                'fuel_l_per_unit' => 5.5,
                'price_per_unit' => 2200,
            ],
        ];
    }

    private function default_operations()
    {
        return [
            'oranje_25' => [
                'operation_id' => 'oranje_25',
                'main_group' => 'Osnovna obrada',
                'sub_group' => null,
                'name' => 'Oranje do 25 cm',
                'unit' => 'ha',
                'fuel_l_per_unit' => 24,
                'price_per_unit' => 7000,
            ],
            'tanjiranje' => [
                'operation_id' => 'tanjiranje',
                'main_group' => 'Osnovna obrada',
                'sub_group' => null,
                'name' => 'Tanjiranje',
                'unit' => 'ha',
                'fuel_l_per_unit' => 15,
                'price_per_unit' => 5000,
            ],
            'setva_zitarica' => [
                'operation_id' => 'setva_zitarica',
                'main_group' => 'Setva i sadnja',
                'sub_group' => null,
                'name' => 'Setva žitarica',
                'unit' => 'ha',
                'fuel_l_per_unit' => 12,
                'price_per_unit' => 4500,
            ],
            'prihrana_npk' => [
                'operation_id' => 'prihrana_npk',
                'main_group' => 'Nega useva',
                'sub_group' => 'Prihrana',
                'name' => 'Prihrana NPK',
                'unit' => 'ha',
                'fuel_l_per_unit' => 6,
                'price_per_unit' => 2000,
            ],
            'zastita_fungicid' => [
                'operation_id' => 'zastita_fungicid',
                'main_group' => 'Nega useva',
                'sub_group' => 'Zaštita',
                'name' => 'Zaštita fungicidom',
                'unit' => 'ha',
                'fuel_l_per_unit' => 5,
                'price_per_unit' => 2500,
            ],
            'zetva_zetvacom' => [
                'operation_id' => 'zetva_zetvacom',
                'main_group' => 'Žetva i berba',
                'sub_group' => null,
                'name' => 'Žetva kombajnom',
                'unit' => 'ha',
                'fuel_l_per_unit' => 18,
                'price_per_unit' => 9000,
            ],
            'baliranje' => [
                'operation_id' => 'baliranje',
                'main_group' => 'Žetva i berba',
                'sub_group' => 'Baliranje',
                'name' => 'Baliranje',
                'unit' => 'bala',
                'fuel_l_per_unit' => 0,
                'price_per_unit' => 120,
            ],
            'traktor_rad' => [
                'operation_id' => 'traktor_rad',
                'main_group' => 'Dodatni rad',
                'sub_group' => null,
                'name' => 'Rad traktora na čas',
                'unit' => 'čas',
                'fuel_l_per_unit' => 5,
                'price_per_unit' => 2000,
            ],
        ];
    }

    private function default_crops()
    {
        return [
            'kukuruz' => [
                'crop_id' => 'kukuruz',
                'name' => 'Kukuruz',
            ],
            'psenica' => [
                'crop_id' => 'psenica',
                'name' => 'Pšenica',
            ],
            'suncokret' => [
                'crop_id' => 'suncokret',
                'name' => 'Suncokret',
            ],
        ];
    }

    public function register_shortcode()
    {
        add_shortcode('agro_kalkulator', [$this, 'render_shortcode']);
    }

    public function register_assets()
    {
        $plugin_url = plugin_dir_url(__FILE__);
        wp_register_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], '1.9.4');
        wp_register_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], '1.9.4', true);
        wp_register_style('leaflet-draw', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css', [], '1.0.4');
        wp_register_script('leaflet-draw', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js', ['leaflet'], '1.0.4', true);
        wp_register_style('agro-kalkulator', $plugin_url . 'assets/css/agro-kalkulator.css', [], self::VERSION);
        wp_register_script('agro-kalkulator', $plugin_url . 'assets/js/agro-kalkulator.js', ['leaflet', 'leaflet-draw'], self::VERSION, true);

        $fuels = get_option('agro_fuels', []);
        $tractors = get_option('agro_tractors', []);
        $operations = get_option('agro_operations', []);
        $crops = get_option('agro_crops', []);
        $eur_rate = get_option('agro_eur_rate', 117);

        wp_localize_script('agro-kalkulator', 'agroKalkulatorData', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce(self::NONCE_ACTION),
            'fuels' => array_values($fuels),
            'tractors' => array_values($tractors),
            'operations' => array_values($operations),
            'crops' => array_values($crops),
            'eurRate' => (float)$eur_rate,
        ]);
    }

    public function render_shortcode()
    {
        wp_enqueue_style('leaflet');
        wp_enqueue_style('leaflet-draw');
        wp_enqueue_style('agro-kalkulator');
        wp_enqueue_script('leaflet');
        wp_enqueue_script('leaflet-draw');
        wp_enqueue_script('agro-kalkulator');

        ob_start();
        ?>
        <div class="agro-wrapper">
            <h2>Agro kalkulator</h2>
            <div class="agro-tabs" id="agro-parcel-tabs"></div>
            <div class="agro-step" data-step="1">
                <div class="agro-card">
                    <h3>Korak 1: Osnovni podaci</h3>
                    <div class="agro-grid">
                        <label>
                            <span>Kultura</span>
                            <select id="agro-crop"></select>
                        </label>
                        <label>
                            <span>Traktor</span>
                            <select id="agro-tractor"></select>
                        </label>
                        <label>
                            <span>Gorivo</span>
                            <select id="agro-fuel"></select>
                        </label>
                        <label>
                            <span>Način unosa površine</span>
                            <div class="agro-radio-group">
                                <label><input type="radio" name="agro-area-mode" value="map" checked> Iscrtaj parcelu na mapi</label>
                                <label><input type="radio" name="agro-area-mode" value="manual"> Ručni unos površine</label>
                            </div>
                        </label>
                        <label>
                            <span>Površina parcele (ha)</span>
                            <input type="number" id="agro-area" step="0.0001" min="0" readonly>
                        </label>
                    </div>
                    <div id="agro-map" class="agro-map"></div>
                </div>
            </div>

            <div class="agro-step" data-step="2">
                <div class="agro-card">
                    <h3>Korak 2: Operacije</h3>
                    <div id="agro-operations"></div>
                    <button class="button" id="agro-add-operation">Dodaj operaciju</button>
                </div>
            </div>

            <div class="agro-step" data-step="3">
                <div class="agro-card">
                    <h3>Korak 3: Prinos i cena</h3>
                    <div class="agro-grid">
                        <label>
                            <span>Prinos po hektaru (kg/ha)</span>
                            <input type="number" id="agro-yield-per-ha" step="0.01" min="0">
                        </label>
                        <label>
                            <span>Cena po kilogramu (din/kg)</span>
                            <input type="number" id="agro-price-per-kg" step="0.01" min="0">
                        </label>
                    </div>
                    <div class="agro-actions">
                        <button class="button button-primary" id="agro-save-parcel">Sačuvaj parcelu</button>
                    </div>
                </div>
            </div>

            <div class="agro-step" data-step="4">
                <div class="agro-card">
                    <h3>Korak 4: Rezultati</h3>
                    <div class="agro-currency-toggle">
                        <strong>Valuta:</strong>
                        <label><input type="radio" name="agro-currency" value="RSD" checked> RSD</label>
                        <label><input type="radio" name="agro-currency" value="EUR"> EUR</label>
                    </div>
                    <div id="agro-results"></div>
                    <div class="agro-actions">
                        <button class="button" id="agro-calculate">Izračunaj</button>
                        <button class="button" id="agro-reset">Resetuj kalkulaciju</button>
                        <button class="button button-primary" id="agro-generate-pdf" disabled>PDF izveštaj</button>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function register_admin_menu()
    {
        add_menu_page('Agro kalkulator', 'Agro kalkulator', 'manage_options', 'agro-kalkulator', [$this, 'render_fuel_page'], 'dashicons-admin-site', 65);
        add_submenu_page('agro-kalkulator', 'Goriva', 'Goriva', 'manage_options', 'agro-kalkulator', [$this, 'render_fuel_page']);
        add_submenu_page('agro-kalkulator', 'Traktori', 'Traktori', 'manage_options', 'agro-tractors', [$this, 'render_tractor_page']);
        add_submenu_page('agro-kalkulator', 'Operacije', 'Operacije', 'manage_options', 'agro-operations', [$this, 'render_operation_page']);
        add_submenu_page('agro-kalkulator', 'Kulture', 'Kulture', 'manage_options', 'agro-crops', [$this, 'render_crop_page']);
        add_submenu_page('agro-kalkulator', 'Uvoz podataka', 'Uvoz podataka', 'manage_options', 'agro-import', [$this, 'render_import_page']);
        add_submenu_page('agro-kalkulator', 'Opšta podešavanja', 'Opšta podešavanja', 'manage_options', 'agro-settings', [$this, 'render_settings_page']);
    }

    private function admin_table_header(array $headers)
    {
        echo '<tr>';
        foreach ($headers as $header) {
            echo '<th>' . esc_html($header) . '</th>';
        }
        echo '</tr>';
    }

    public function render_fuel_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $fuels = get_option('agro_fuels', []);
        $edit_id = isset($_GET['edit']) ? sanitize_text_field(wp_unslash($_GET['edit'])) : '';
        $editing = $edit_id && isset($fuels[$edit_id]) ? $fuels[$edit_id] : null;
        ?>
        <div class="wrap">
            <h1>Goriva</h1>
            <table class="widefat">
                <thead>
                <?php $this->admin_table_header(['Naziv', 'Cena po litru', 'Jedinica', 'Aktivan', 'Akcije']); ?>
                </thead>
                <tbody>
                <?php foreach ($fuels as $fuel) : ?>
                    <tr>
                        <td><?php echo esc_html($fuel['name']); ?></td>
                        <td><?php echo esc_html($fuel['price_per_liter']); ?></td>
                        <td><?php echo esc_html($fuel['unit']); ?></td>
                        <td><?php echo !empty($fuel['active']) ? 'Da' : 'Ne'; ?></td>
                        <td>
                            <a href="<?php echo esc_url(add_query_arg(['edit' => $fuel['fuel_id']])); ?>">Izmeni</a> |
                            <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=agro_delete_fuel&fuel_id=' . $fuel['fuel_id']), self::NONCE_ACTION)); ?>">Obriši</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2><?php echo $editing ? 'Izmena goriva' : 'Dodaj gorivo'; ?></h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <input type="hidden" name="action" value="agro_save_fuel">
                <input type="hidden" name="fuel_id" value="<?php echo esc_attr($editing['fuel_id'] ?? ''); ?>">
                <table class="form-table">
                    <tr>
                        <th scope="row">Naziv</th>
                        <td><input name="name" type="text" value="<?php echo esc_attr($editing['name'] ?? ''); ?>" required></td>
                    </tr>
                    <tr>
                        <th scope="row">Cena po litru</th>
                        <td><input name="price_per_liter" type="number" step="0.01" value="<?php echo esc_attr($editing['price_per_liter'] ?? ''); ?>" required></td>
                    </tr>
                    <tr>
                        <th scope="row">Jedinica</th>
                        <td><input name="unit" type="text" value="<?php echo esc_attr($editing['unit'] ?? 'litar'); ?>" required></td>
                    </tr>
                    <tr>
                        <th scope="row">Aktivan</th>
                        <td><input name="active" type="checkbox" value="1" <?php checked($editing['active'] ?? 1, 1); ?>></td>
                    </tr>
                </table>
                <?php submit_button($editing ? 'Sačuvaj izmene' : 'Dodaj gorivo'); ?>
            </form>
        </div>
        <?php
    }

    public function render_tractor_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $tractors = get_option('agro_tractors', []);
        $edit_id = isset($_GET['edit']) ? sanitize_text_field(wp_unslash($_GET['edit'])) : '';
        $editing = $edit_id && isset($tractors[$edit_id]) ? $tractors[$edit_id] : null;
        ?>
        <div class="wrap">
            <h1>Traktori</h1>
            <table class="widefat">
                <thead>
                <?php $this->admin_table_header(['Naziv', 'Snaga (kW od/do)', 'KS', 'Potrošnja (l/čas)', 'Cena (din/čas)', 'Akcije']); ?>
                </thead>
                <tbody>
                <?php foreach ($tractors as $tractor) : ?>
                    <tr>
                        <td><?php echo esc_html($tractor['name']); ?></td>
                        <td><?php echo esc_html($tractor['power_kw_from'] . ' - ' . $tractor['power_kw_to']); ?></td>
                        <td><?php echo esc_html($tractor['power_hp_label']); ?></td>
                        <td><?php echo esc_html($tractor['fuel_l_per_unit']); ?></td>
                        <td><?php echo esc_html($tractor['price_per_unit']); ?></td>
                        <td>
                            <a href="<?php echo esc_url(add_query_arg(['edit' => $tractor['tractor_id']])); ?>">Izmeni</a> |
                            <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=agro_delete_tractor&tractor_id=' . $tractor['tractor_id']), self::NONCE_ACTION)); ?>">Obriši</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2><?php echo $editing ? 'Izmena traktora' : 'Dodaj traktor'; ?></h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <input type="hidden" name="action" value="agro_save_tractor">
                <input type="hidden" name="tractor_id" value="<?php echo esc_attr($editing['tractor_id'] ?? ''); ?>">
                <table class="form-table">
                    <tr><th scope="row">Naziv</th><td><input name="name" type="text" value="<?php echo esc_attr($editing['name'] ?? ''); ?>" required></td></tr>
                    <tr><th scope="row">Snaga od (kW)</th><td><input name="power_kw_from" type="number" step="0.01" value="<?php echo esc_attr($editing['power_kw_from'] ?? ''); ?>"></td></tr>
                    <tr><th scope="row">Snaga do (kW)</th><td><input name="power_kw_to" type="number" step="0.01" value="<?php echo esc_attr($editing['power_kw_to'] ?? ''); ?>"></td></tr>
                    <tr><th scope="row">KS oznaka</th><td><input name="power_hp_label" type="text" value="<?php echo esc_attr($editing['power_hp_label'] ?? ''); ?>"></td></tr>
                    <tr><th scope="row">Jedinica</th><td><input name="unit" type="text" value="<?php echo esc_attr($editing['unit'] ?? 'čas'); ?>" required></td></tr>
                    <tr><th scope="row">Potrošnja goriva (l/čas)</th><td><input name="fuel_l_per_unit" type="number" step="0.01" value="<?php echo esc_attr($editing['fuel_l_per_unit'] ?? ''); ?>" required></td></tr>
                    <tr><th scope="row">Cena (din/čas)</th><td><input name="price_per_unit" type="number" step="0.01" value="<?php echo esc_attr($editing['price_per_unit'] ?? ''); ?>" required></td></tr>
                </table>
                <?php submit_button($editing ? 'Sačuvaj izmene' : 'Dodaj traktor'); ?>
            </form>
        </div>
        <?php
    }

    public function render_operation_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $operations = get_option('agro_operations', []);
        $edit_id = isset($_GET['edit']) ? sanitize_text_field(wp_unslash($_GET['edit'])) : '';
        $editing = $edit_id && isset($operations[$edit_id]) ? $operations[$edit_id] : null;
        ?>
        <div class="wrap">
            <h1>Operacije</h1>
            <table class="widefat">
                <thead>
                <?php $this->admin_table_header(['Naziv', 'Glavna grupa', 'Podgrupa', 'J.m.', 'Potrošnja (l/j.m.)', 'Cena (din/j.m.)', 'Akcije']); ?>
                </thead>
                <tbody>
                <?php foreach ($operations as $operation) : ?>
                    <tr>
                        <td><?php echo esc_html($operation['name']); ?></td>
                        <td><?php echo esc_html($operation['main_group']); ?></td>
                        <td><?php echo esc_html($operation['sub_group']); ?></td>
                        <td><?php echo esc_html($operation['unit']); ?></td>
                        <td><?php echo esc_html($operation['fuel_l_per_unit']); ?></td>
                        <td><?php echo esc_html($operation['price_per_unit']); ?></td>
                        <td>
                            <a href="<?php echo esc_url(add_query_arg(['edit' => $operation['operation_id']])); ?>">Izmeni</a> |
                            <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=agro_delete_operation&operation_id=' . $operation['operation_id']), self::NONCE_ACTION)); ?>">Obriši</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2><?php echo $editing ? 'Izmena operacije' : 'Dodaj operaciju'; ?></h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <input type="hidden" name="action" value="agro_save_operation">
                <input type="hidden" name="operation_id" value="<?php echo esc_attr($editing['operation_id'] ?? ''); ?>">
                <table class="form-table">
                    <tr><th scope="row">Naziv</th><td><input name="name" type="text" value="<?php echo esc_attr($editing['name'] ?? ''); ?>" required></td></tr>
                    <tr><th scope="row">Glavna grupa</th><td><input name="main_group" type="text" value="<?php echo esc_attr($editing['main_group'] ?? ''); ?>" required></td></tr>
                    <tr><th scope="row">Podgrupa</th><td><input name="sub_group" type="text" value="<?php echo esc_attr($editing['sub_group'] ?? ''); ?>"></td></tr>
                    <tr><th scope="row">Jedinica</th><td><input name="unit" type="text" value="<?php echo esc_attr($editing['unit'] ?? 'ha'); ?>" required></td></tr>
                    <tr><th scope="row">Potrošnja goriva (l/j.m.)</th><td><input name="fuel_l_per_unit" type="number" step="0.01" value="<?php echo esc_attr($editing['fuel_l_per_unit'] ?? ''); ?>" required></td></tr>
                    <tr><th scope="row">Cena (din/j.m.)</th><td><input name="price_per_unit" type="number" step="0.01" value="<?php echo esc_attr($editing['price_per_unit'] ?? ''); ?>" required></td></tr>
                </table>
                <?php submit_button($editing ? 'Sačuvaj izmene' : 'Dodaj operaciju'); ?>
            </form>
        </div>
        <?php
    }

    public function render_crop_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $crops = get_option('agro_crops', []);
        $edit_id = isset($_GET['edit']) ? sanitize_text_field(wp_unslash($_GET['edit'])) : '';
        $editing = $edit_id && isset($crops[$edit_id]) ? $crops[$edit_id] : null;
        ?>
        <div class="wrap">
            <h1>Kulture</h1>
            <table class="widefat">
                <thead>
                <?php $this->admin_table_header(['Naziv', 'Akcije']); ?>
                </thead>
                <tbody>
                <?php foreach ($crops as $crop) : ?>
                    <tr>
                        <td><?php echo esc_html($crop['name']); ?></td>
                        <td>
                            <a href="<?php echo esc_url(add_query_arg(['edit' => $crop['crop_id']])); ?>">Izmeni</a> |
                            <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=agro_delete_crop&crop_id=' . $crop['crop_id']), self::NONCE_ACTION)); ?>">Obriši</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2><?php echo $editing ? 'Izmena kulture' : 'Dodaj kulturu'; ?></h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <input type="hidden" name="action" value="agro_save_crop">
                <input type="hidden" name="crop_id" value="<?php echo esc_attr($editing['crop_id'] ?? ''); ?>">
                <table class="form-table">
                    <tr><th scope="row">Naziv</th><td><input name="name" type="text" value="<?php echo esc_attr($editing['name'] ?? ''); ?>" required></td></tr>
                </table>
                <?php submit_button($editing ? 'Sačuvaj izmene' : 'Dodaj kulturu'); ?>
            </form>
        </div>
        <?php
    }

    public function render_import_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $imported = isset($_GET['imported']) ? sanitize_text_field(wp_unslash($_GET['imported'])) : '';
        $fuels_count = isset($_GET['fuels']) ? intval($_GET['fuels']) : 0;
        $tractors_count = isset($_GET['tractors']) ? intval($_GET['tractors']) : 0;
        $operations_count = isset($_GET['operations']) ? intval($_GET['operations']) : 0;
        ?>
        <div class="wrap">
            <h1>Uvoz podataka</h1>
            <?php if ($imported) : ?>
                <div class="notice notice-success"><p>Uvezeno <?php echo esc_html($fuels_count); ?> goriva, <?php echo esc_html($tractors_count); ?> traktora, <?php echo esc_html($operations_count); ?> operacija.</p></div>
            <?php endif; ?>

            <div class="notice notice-info">
                <h3>Format CSV fajlova</h3>
                <p><strong>Važne napomene:</strong></p>
                <ul style="list-style: disc; margin-left: 20px;">
                    <li>CSV fajlovi mogu koristiti zarez (,) ili tačku-zarez (;) kao separator</li>
                    <li>Imena kolona nisu osetljiva na velika/mala slova (može biti "ID", "id", ili "Id")</li>
                    <li>Podržan je UTF-8 encoding sa ili bez BOM karaktera</li>
                    <li>Decimalni brojevi mogu koristiti zarez ili tačku (npr. "12,5" ili "12.5")</li>
                    <li><strong>Napomena:</strong> Uvoz podataka će spojiti nove stavke sa postojećim (neće obrisati postojeće podatke)</li>
                </ul>

                <h4>CSV goriva - obavezne kolone:</h4>
                <code>energent_id, naziv, jedinica, cena_din_po_l, aktivan</code>
                <p><em>Primer: euro_dizel,Euro Dizel,litar,204,1</em></p>

                <h4>CSV traktori - obavezne kolone:</h4>
                <code>id, naziv, snaga_kw_od, snaga_kw_do, snaga_ks_tekst, jm, potrosnja_l_po_jm, cena_din_po_jm</code>
                <p><em>Primer: traktor_33,Traktor do 33kW,0,33,45 KS,čas,4,1770</em></p>

                <h4>CSV operacije - obavezne kolone:</h4>
                <code>id, naziv, glavna_grupa, potgrupa, jm, potrosnja_l_po_jm, cena_din_po_jm</code>
                <p><em>Primer: oranje,Oranje do 25cm,Osnovna obrada,,ha,24,7000</em></p>
            </div>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data">
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <input type="hidden" name="action" value="agro_import_data">
                <table class="form-table">
                    <tr>
                        <th scope="row">CSV goriva</th>
                        <td><input type="file" name="fuels_csv" accept=".csv"></td>
                    </tr>
                    <tr>
                        <th scope="row">CSV traktori</th>
                        <td><input type="file" name="tractors_csv" accept=".csv"></td>
                    </tr>
                    <tr>
                        <th scope="row">CSV operacije</th>
                        <td><input type="file" name="operations_csv" accept=".csv"></td>
                    </tr>
                </table>
                <?php submit_button('Uvezi podatke'); ?>
            </form>
        </div>
        <?php
    }

    public function render_settings_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $eur_rate = get_option('agro_eur_rate', 117);
        $updated = isset($_GET['updated']) ? sanitize_text_field(wp_unslash($_GET['updated'])) : '';
        ?>
        <div class="wrap">
            <h1>Opšta podešavanja</h1>
            <?php if ($updated) : ?>
                <div class="notice notice-success"><p>Podešavanja su sačuvana.</p></div>
            <?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field(self::NONCE_ACTION); ?>
                <input type="hidden" name="action" value="agro_save_settings">
                <table class="form-table">
                    <tr>
                        <th scope="row">Kurs za 1 EUR (u dinarima)</th>
                        <td>
                            <input name="agro_eur_rate" type="number" step="0.01" min="0" value="<?php echo esc_attr($eur_rate); ?>" required>
                            <p class="description">Vrednost mora biti veća od nule.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Sačuvaj podešavanja'); ?>
            </form>
        </div>
        <?php
    }

    private function sanitize_boolean_checkbox($value)
    {
        return $value ? 1 : 0;
    }

    private function parse_csv_rows($file)
    {
        $rows = [];
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return $rows;
        }
        $handle = fopen($file['tmp_name'], 'r');
        if (!$handle) {
            return $rows;
        }
        $first_line = fgets($handle);
        if ($first_line === false) {
            fclose($handle);
            return $rows;
        }
        // Remove UTF-8 BOM if present
        $first_line = $this->remove_utf8_bom($first_line);

        $delimiter = substr_count($first_line, ';') > substr_count($first_line, ',') ? ';' : ',';
        $headers = array_map('trim', str_getcsv($first_line, $delimiter));
        // Normalize headers to lowercase for case-insensitive matching
        $headers = array_map('strtolower', $headers);

        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            if (!array_filter($data, 'strlen')) {
                continue;
            }
            $row = [];
            foreach ($headers as $index => $column) {
                $row[$column] = isset($data[$index]) ? trim($data[$index]) : '';
            }
            $rows[] = $row;
        }
        fclose($handle);
        return $rows;
    }

    private function remove_utf8_bom($text)
    {
        $bom = pack('H*','EFBBBF');
        return preg_replace("/^$bom/", '', $text);
    }

    private function parse_float_value($value)
    {
        return floatval(str_replace(',', '.', $value));
    }

    private function handle_option_save($option, $id_key, $data)
    {
        update_option($option, $data);
        wp_safe_redirect(add_query_arg(['updated' => 'true'], wp_get_referer()));
        exit;
    }

    public function handle_save_settings()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $eur_rate = isset($_POST['agro_eur_rate']) ? floatval($_POST['agro_eur_rate']) : 0;
        if ($eur_rate <= 0) {
            $eur_rate = 117;
        }
        update_option('agro_eur_rate', $eur_rate);
        wp_safe_redirect(add_query_arg(['updated' => 'true'], admin_url('admin.php?page=agro-settings')));
        exit;
    }

    public function handle_save_fuel()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $fuels = get_option('agro_fuels', []);
        $fuel_id = sanitize_key($_POST['fuel_id'] ?? '');
        $name = sanitize_text_field($_POST['name'] ?? '');
        $price = isset($_POST['price_per_liter']) ? floatval($_POST['price_per_liter']) : 0;
        $unit = sanitize_text_field($_POST['unit'] ?? 'litar');
        $active = $this->sanitize_boolean_checkbox($_POST['active'] ?? 0);
        if (!$fuel_id) {
            $fuel_id = sanitize_title($name);
        }
        $fuels[$fuel_id] = [
            'fuel_id' => $fuel_id,
            'name' => $name,
            'unit' => $unit,
            'price_per_liter' => $price,
            'active' => $active,
        ];
        $this->handle_option_save('agro_fuels', 'fuel_id', $fuels);
    }

    public function handle_delete_fuel()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $fuels = get_option('agro_fuels', []);
        $fuel_id = sanitize_key($_GET['fuel_id'] ?? '');
        if ($fuel_id && isset($fuels[$fuel_id])) {
            unset($fuels[$fuel_id]);
            update_option('agro_fuels', $fuels);
        }
        wp_safe_redirect(remove_query_arg(['edit', 'fuel_id']));
        exit;
    }

    public function handle_save_tractor()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $tractors = get_option('agro_tractors', []);
        $tractor_id = sanitize_key($_POST['tractor_id'] ?? '');
        $name = sanitize_text_field($_POST['name'] ?? '');
        if (!$tractor_id) {
            $tractor_id = sanitize_title($name);
        }
        $tractors[$tractor_id] = [
            'tractor_id' => $tractor_id,
            'name' => $name,
            'power_kw_from' => isset($_POST['power_kw_from']) ? floatval($_POST['power_kw_from']) : null,
            'power_kw_to' => isset($_POST['power_kw_to']) ? floatval($_POST['power_kw_to']) : null,
            'power_hp_label' => sanitize_text_field($_POST['power_hp_label'] ?? ''),
            'unit' => sanitize_text_field($_POST['unit'] ?? 'čas'),
            'fuel_l_per_unit' => isset($_POST['fuel_l_per_unit']) ? floatval($_POST['fuel_l_per_unit']) : 0,
            'price_per_unit' => isset($_POST['price_per_unit']) ? floatval($_POST['price_per_unit']) : 0,
        ];
        $this->handle_option_save('agro_tractors', 'tractor_id', $tractors);
    }

    public function handle_delete_tractor()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $tractors = get_option('agro_tractors', []);
        $tractor_id = sanitize_key($_GET['tractor_id'] ?? '');
        if ($tractor_id && isset($tractors[$tractor_id])) {
            unset($tractors[$tractor_id]);
            update_option('agro_tractors', $tractors);
        }
        wp_safe_redirect(remove_query_arg(['edit', 'tractor_id']));
        exit;
    }

    public function handle_save_operation()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $operations = get_option('agro_operations', []);
        $operation_id = sanitize_key($_POST['operation_id'] ?? '');
        $name = sanitize_text_field($_POST['name'] ?? '');
        if (!$operation_id) {
            $operation_id = sanitize_title($name);
        }
        $operations[$operation_id] = [
            'operation_id' => $operation_id,
            'name' => $name,
            'main_group' => sanitize_text_field($_POST['main_group'] ?? ''),
            'sub_group' => sanitize_text_field($_POST['sub_group'] ?? ''),
            'unit' => sanitize_text_field($_POST['unit'] ?? 'ha'),
            'fuel_l_per_unit' => isset($_POST['fuel_l_per_unit']) ? floatval($_POST['fuel_l_per_unit']) : 0,
            'price_per_unit' => isset($_POST['price_per_unit']) ? floatval($_POST['price_per_unit']) : 0,
        ];
        $this->handle_option_save('agro_operations', 'operation_id', $operations);
    }

    public function handle_delete_operation()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $operations = get_option('agro_operations', []);
        $operation_id = sanitize_key($_GET['operation_id'] ?? '');
        if ($operation_id && isset($operations[$operation_id])) {
            unset($operations[$operation_id]);
            update_option('agro_operations', $operations);
        }
        wp_safe_redirect(remove_query_arg(['edit', 'operation_id']));
        exit;
    }

    public function handle_save_crop()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $crops = get_option('agro_crops', []);
        $crop_id = sanitize_key($_POST['crop_id'] ?? '');
        $name = sanitize_text_field($_POST['name'] ?? '');
        if (!$crop_id) {
            $crop_id = sanitize_title($name);
        }
        $crops[$crop_id] = [
            'crop_id' => $crop_id,
            'name' => $name,
        ];
        $this->handle_option_save('agro_crops', 'crop_id', $crops);
    }

    public function handle_import_data()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);

        $import_counts = [
            'fuels' => 0,
            'tractors' => 0,
            'operations' => 0,
        ];

        if (!empty($_FILES['fuels_csv']['tmp_name'])) {
            $import_counts['fuels'] = $this->import_fuels_from_csv($_FILES['fuels_csv']);
        }
        if (!empty($_FILES['tractors_csv']['tmp_name'])) {
            $import_counts['tractors'] = $this->import_tractors_from_csv($_FILES['tractors_csv']);
        }
        if (!empty($_FILES['operations_csv']['tmp_name'])) {
            $import_counts['operations'] = $this->import_operations_from_csv($_FILES['operations_csv']);
        }

        $redirect = add_query_arg([
            'imported' => 'true',
            'fuels' => $import_counts['fuels'],
            'tractors' => $import_counts['tractors'],
            'operations' => $import_counts['operations'],
        ], admin_url('admin.php?page=agro-import'));
        wp_safe_redirect($redirect);
        exit;
    }

    private function import_fuels_from_csv($file)
    {
        $rows = $this->parse_csv_rows($file);
        $fuels = get_option('agro_fuels', []);
        $imported = 0;

        foreach ($rows as $row) {
            $fuel_id = sanitize_key($row['energent_id'] ?? '');
            if (!$fuel_id) {
                continue;
            }
            $fuels[$fuel_id] = [
                'fuel_id' => $fuel_id,
                'name' => sanitize_text_field($row['naziv'] ?? ''),
                'unit' => sanitize_text_field($row['jedinica'] ?? ''),
                'price_per_liter' => isset($row['cena_din_po_l']) ? $this->parse_float_value($row['cena_din_po_l']) : 0,
                'active' => isset($row['aktivan']) ? (int)$row['aktivan'] : 0,
            ];
            $imported++;
        }

        if ($imported > 0) {
            update_option('agro_fuels', $fuels);
        }
        return $imported;
    }

    private function import_tractors_from_csv($file)
    {
        $rows = $this->parse_csv_rows($file);
        $tractors = get_option('agro_tractors', []);
        $imported = 0;

        foreach ($rows as $row) {
            $tractor_id = sanitize_key($row['id'] ?? '');
            if (!$tractor_id) {
                continue;
            }
            $tractors[$tractor_id] = [
                'tractor_id' => $tractor_id,
                'name' => sanitize_text_field($row['naziv'] ?? ''),
                'power_kw_from' => isset($row['snaga_kw_od']) && $row['snaga_kw_od'] !== '' ? $this->parse_float_value($row['snaga_kw_od']) : null,
                'power_kw_to' => isset($row['snaga_kw_do']) && $row['snaga_kw_do'] !== '' ? $this->parse_float_value($row['snaga_kw_do']) : null,
                'power_hp_label' => sanitize_text_field($row['snaga_ks_tekst'] ?? ''),
                'unit' => sanitize_text_field($row['jm'] ?? ''),
                'fuel_l_per_unit' => isset($row['potrosnja_l_po_jm']) ? $this->parse_float_value($row['potrosnja_l_po_jm']) : 0,
                'price_per_unit' => isset($row['cena_din_po_jm']) ? $this->parse_float_value($row['cena_din_po_jm']) : 0,
            ];
            $imported++;
        }

        if ($imported > 0) {
            update_option('agro_tractors', $tractors);
        }
        return $imported;
    }

    private function import_operations_from_csv($file)
    {
        $rows = $this->parse_csv_rows($file);
        $operations = get_option('agro_operations', []);
        $imported = 0;

        foreach ($rows as $row) {
            $operation_id = sanitize_key($row['id'] ?? '');
            if (!$operation_id) {
                continue;
            }
            $operations[$operation_id] = [
                'operation_id' => $operation_id,
                'main_group' => sanitize_text_field($row['glavna_grupa'] ?? ''),
                'sub_group' => sanitize_text_field($row['potgrupa'] ?? ''),
                'name' => sanitize_text_field($row['naziv'] ?? ''),
                'unit' => sanitize_text_field($row['jm'] ?? ''),
                'fuel_l_per_unit' => isset($row['potrosnja_l_po_jm']) ? $this->parse_float_value($row['potrosnja_l_po_jm']) : 0,
                'price_per_unit' => isset($row['cena_din_po_jm']) ? $this->parse_float_value($row['cena_din_po_jm']) : 0,
            ];
            $imported++;
        }

        if ($imported > 0) {
            update_option('agro_operations', $operations);
        }
        return $imported;
    }

    public function handle_delete_crop()
    {
        $this->require_capability();
        check_admin_referer(self::NONCE_ACTION);
        $crops = get_option('agro_crops', []);
        $crop_id = sanitize_key($_GET['crop_id'] ?? '');
        if ($crop_id && isset($crops[$crop_id])) {
            unset($crops[$crop_id]);
            update_option('agro_crops', $crops);
        }
        wp_safe_redirect(remove_query_arg(['edit', 'crop_id']));
        exit;
    }

    private function require_capability()
    {
        if (!current_user_can('manage_options')) {
            wp_die(__('Nemate dozvolu.', 'agro-kalkulator'));
        }
    }

    private function format_money($amount)
    {
        return number_format((float)$amount, 2, ',', '.');
    }

    public function handle_generate_pdf()
    {
        check_ajax_referer(self::NONCE_ACTION, 'nonce');
        $payload = isset($_POST['data']) ? wp_unslash($_POST['data']) : '';
        $data = json_decode($payload, true);
        if (!class_exists('FPDF')) {
            require_once __DIR__ . '/includes/fpdf.php';
        }
        if (!$data) {
            wp_send_json_error('Invalid data payload');
        }
        if (!class_exists('FPDF')) {
            wp_send_json_error('FPDF not found');
        }
        $pdf = new FPDF();
        $pdf->SetTitle('Agro kalkulator');
        $parcels = $data['parcels'] ?? [];
        foreach ($parcels as $index => $parcel) {
            $pdf->AddPage();
            $title = sprintf('Parcela %d – %s, %s ha', $index + 1, $parcel['crop_name'], $parcel['area']);
            $pdf->SetFont('Arial', 'B', 14);
            $pdf->Cell(0, 10, $title, 0, 1);
            $pdf->SetFont('Arial', '', 11);
            $pdf->Cell(0, 8, 'Traktor: ' . $parcel['tractor_name'], 0, 1);
            $pdf->Cell(0, 8, 'Gorivo: ' . $parcel['fuel_name'] . ' (' . $parcel['fuel_price'] . ' din/l)', 0, 1);
            $pdf->Ln(3);
            $pdf->SetFont('Arial', 'B', 11);
            $pdf->Cell(60, 8, 'Operacija', 1);
            $pdf->Cell(25, 8, 'J.m.', 1);
            $pdf->Cell(35, 8, 'Gorivo', 1);
            $pdf->Cell(35, 8, 'Cena', 1);
            $pdf->Cell(35, 8, 'Ukupno', 1, 1);
            $pdf->SetFont('Arial', '', 10);
            foreach ($parcel['operations'] as $operation) {
                $pdf->Cell(60, 8, $operation['name'], 1);
                $pdf->Cell(25, 8, $operation['unit'], 1);
                $pdf->Cell(35, 8, $operation['fuel_cost'], 1);
                $pdf->Cell(35, 8, $operation['price_cost'], 1);
                $pdf->Cell(35, 8, $operation['total'], 1, 1);
            }
            $pdf->Ln(3);
            $pdf->Cell(0, 8, 'Troškovi po kategorijama:', 0, 1);
            $pdf->Cell(0, 8, 'Ha: ' . $this->format_money($parcel['total_trosak_ha']) . ' | Čas: ' . $this->format_money($parcel['total_trosak_cas']), 0, 1);
            $pdf->Cell(0, 8, 'Prihrana: ' . $this->format_money($parcel['total_trosak_prihrane']) . ' | Zaštita: ' . $this->format_money($parcel['total_trosak_zastite']), 0, 1);
            $pdf->Cell(0, 8, 'Seme: ' . $this->format_money($parcel['total_trosak_semena']) . ' | Baliranje: ' . $this->format_money($parcel['total_trosak_baliranja']), 0, 1);
            $pdf->Cell(0, 8, 'Ukupan trošak: ' . $this->format_money($parcel['total_cost']), 0, 1);
            $pdf->Cell(0, 8, 'Prinos: ' . $this->format_money($parcel['revenue']), 0, 1);
            $pdf->Cell(0, 8, 'Agrotehnička dobit: ' . $this->format_money($parcel['profit']), 0, 1);
        }
        $pdf->AddPage();
        $pdf->SetFont('Arial', 'B', 14);
        $pdf->Cell(0, 10, 'Zbirni rezultati', 0, 1);
        $pdf->SetFont('Arial', '', 12);
        $pdf->Cell(0, 8, 'Broj parcela: ' . count($parcels), 0, 1);
        $pdf->Cell(0, 8, 'Ukupni troškovi: ' . $this->format_money($data['totals']['total_cost']), 0, 1);
        $pdf->Cell(0, 8, 'Ukupan prinos: ' . $this->format_money($data['totals']['revenue']), 0, 1);
        $pdf->Cell(0, 8, 'Ukupna agrotehnička dobit: ' . $this->format_money($data['totals']['profit']), 0, 1);
        $output = $pdf->Output('S');

        while (ob_get_level()) {
            ob_end_clean();
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="agro-kalkulator.pdf"');
        header('Content-Length: ' . strlen($output));
        echo $output;
        exit;
    }
}

new AgroKalkulator();
