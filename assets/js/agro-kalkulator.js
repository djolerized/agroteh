(function () {
    const data = window.agroKalkulatorData || {};
    const state = {
        parcels: [],
        activeParcelIndex: 0,
        currency: 'RSD',
        eurRate: data.eurRate || 117,
    };

    // Toast Notification System
    function showToast(message, type = 'info') {
        const existingToast = document.querySelector('.agro-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `agro-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Loading State Management
    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
            const spinner = document.createElement('span');
            spinner.className = 'agro-loading';
            button.insertBefore(spinner, button.firstChild);
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            const spinner = button.querySelector('.agro-loading');
            if (spinner) spinner.remove();
        }
    }

    function createEmptyParcel() {
        return {
            cropId: '',
            tractorId: '',
            fuelId: '',
            fuelPrice: 0,
            fieldAreaHa: 0,
            manualAreaHa: 0,
            areaMode: 'map',
            polygon: [],
            operations: [],
            yieldPerHa: 0,
            pricePerKg: 0,
            result: null,
            // Cadastral data
            cadastralOpstina: '',
            cadastralParcelId: '',
            cadastralParcelNumber: '',
            cadastralPolygon: [],
        };
    }

    const crops = data.crops || [];
    const tractors = data.tractors || [];
    const fuels = (data.fuels || []).filter(f => parseInt(f.active, 10) === 1 || f.active === true);
    const operations = data.operations || [];
    const operationsByGroup = operations.reduce((acc, op) => {
        if (!acc[op.main_group]) {
            acc[op.main_group] = [];
        }
        acc[op.main_group].push(op);
        return acc;
    }, {});

    const els = {
        tabs: document.getElementById('agro-parcel-tabs'),
        crop: document.getElementById('agro-crop'),
        tractor: document.getElementById('agro-tractor'),
        fuel: document.getElementById('agro-fuel'),
        area: document.getElementById('agro-area'),
        areaModeRadios: document.querySelectorAll('input[name="agro-area-mode"]'),
        operationsWrap: document.getElementById('agro-operations'),
        addOperation: document.getElementById('agro-add-operation'),
        saveParcel: document.getElementById('agro-save-parcel'),
        calculate: document.getElementById('agro-calculate'),
        results: document.getElementById('agro-results'),
        reset: document.getElementById('agro-reset'),
        pdf: document.getElementById('agro-generate-pdf'),
        currencyRadios: document.querySelectorAll('input[name="agro-currency"]'),
        // Cadastral elements
        cadastralControls: document.getElementById('agro-cadastral-controls'),
        cadastralOpstina: document.getElementById('agro-katastarska-opstina'),
        cadastralInfo: document.getElementById('agro-cadastral-info'),
        clearCadastral: document.getElementById('agro-clear-cadastral'),
    };

    function formatNumber(value) {
        return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    }

    function formatCurrency(value) {
        let amount = value || 0;
        if (state.currency === 'EUR' && state.eurRate > 0) {
            amount = amount / state.eurRate;
        }
        return `${formatNumber(amount)} ${state.currency}`;
    }

    function formatCurrencyRsd(value) {
        return `${formatNumber(value)} RSD`;
    }

    function renderTabs() {
        if (!els.tabs) return;
        els.tabs.innerHTML = '';
        state.parcels.forEach((parcel, index) => {
            const tab = document.createElement('div');
            tab.className = 'agro-tab' + (index === state.activeParcelIndex ? ' active' : '');
            tab.textContent = `Parcela ${index + 1}`;
            tab.addEventListener('click', () => switchParcel(index));
            els.tabs.appendChild(tab);
        });
        const addTab = document.createElement('div');
        addTab.className = 'agro-tab add-tab';
        addTab.textContent = 'Nova parcela +';
        addTab.addEventListener('click', () => addParcelTab());
        els.tabs.appendChild(addTab);
    }

    function populateSelect(select, list, labelCb) {
        select.innerHTML = '<option value="">-- izaberite --</option>';
        list.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.crop_id || item.tractor_id || item.fuel_id || item.operation_id;
            opt.textContent = labelCb(item);
            select.appendChild(opt);
        });
    }

    function initSelects() {
        populateSelect(els.crop, crops, (c) => c.name);
        populateSelect(els.tractor, tractors, (t) => `${t.name}${t.power_hp_label ? ' (' + t.power_hp_label + ')' : ''}`);
        populateSelect(els.fuel, fuels, (f) => `${f.name} - ${f.price_per_liter} din/l`);
    }

    // Leaflet map
    let map, drawnItems;

    // Cadastral (katastarske) parcels
    let cadastralLayer = null;
    let selectedCadastralParcel = null;
    let cadastralLoadingState = false;
    function initMap() {
        const mapEl = document.getElementById('agro-map');
        map = L.map(mapEl).setView([44.7872, 20.4573], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
            draw: { polygon: true, rectangle: true, circle: false, marker: false, polyline: false }
        });
        map.addControl(drawControl);
        map.on(L.Draw.Event.CREATED, (e) => {
            drawnItems.clearLayers();
            drawnItems.addLayer(e.layer);
            updateArea(e.layer.getLatLngs());
        });
        map.on(L.Draw.Event.EDITED, (e) => {
            const layers = e.layers.getLayers();
            if (layers.length) {
                updateArea(layers[0].getLatLngs());
            }
        });

        map.whenReady(() => {
            map.invalidateSize();
        });

        renderActiveParcelGeometry();
    }

    function getActiveParcel() {
        return state.parcels[state.activeParcelIndex];
    }

    function polygonAreaHa(latlngs) {
        if (!latlngs || !latlngs[0]) {
            return 0;
        }
        const area = L.GeometryUtil.geodesicArea(latlngs[0]);
        return area / 10000;
    }

    function serializePolygon(latlngs) {
        if (!latlngs || !latlngs[0]) return [];
        return latlngs[0].map(point => [point.lat, point.lng]);
    }

    function restorePolygon(coords) {
        if (!coords || !coords.length) return null;
        return L.polygon(coords);
    }

    function getSelectedAreaMode() {
        const checked = document.querySelector('input[name="agro-area-mode"]:checked');
        return checked ? checked.value : 'map';
    }

    function applyAreaModeUI(mode) {
        const mapEl = document.getElementById('agro-map');
        const drawControl = map ? map._controlContainer.querySelector('.leaflet-draw') : null;

        // Hide cadastral controls by default
        if (els.cadastralControls) {
            els.cadastralControls.style.display = 'none';
        }

        if (mode === 'manual') {
            if (els.area) {
                els.area.removeAttribute('readonly');
            }
            if (mapEl) {
                mapEl.style.display = 'none';
            }
            // Clear cadastral layers when switching to manual
            clearCadastralLayer();
        } else if (mode === 'cadastral') {
            if (els.area) {
                els.area.setAttribute('readonly', 'readonly');
            }
            if (mapEl) {
                mapEl.style.display = 'block';
                if (map) {
                    setTimeout(() => map.invalidateSize(), 50);
                }
            }
            // Show cadastral controls
            if (els.cadastralControls) {
                els.cadastralControls.style.display = 'block';
            }
            // Hide draw control in cadastral mode
            if (drawControl) {
                drawControl.style.display = 'none';
            }
            // Clear drawn items
            if (drawnItems) {
                drawnItems.clearLayers();
            }
        } else {
            // Map mode (drawing)
            if (els.area) {
                els.area.setAttribute('readonly', 'readonly');
            }
            if (mapEl) {
                mapEl.style.display = 'block';
                if (map) {
                    setTimeout(() => map.invalidateSize(), 50);
                }
            }
            // Show draw control in map mode
            if (drawControl) {
                drawControl.style.display = 'block';
            }
            // Clear cadastral layers when switching to map mode
            clearCadastralLayer();
        }
    }

    function setAreaDisplayValue(value) {
        if (els.area) {
            els.area.value = value || '';
        }
    }

    function updateArea(latlngs) {
        const ha = polygonAreaHa(latlngs);
        const parcel = getActiveParcel();
        if (!parcel || parcel.areaMode !== 'map') {
            return;
        }
        parcel.fieldAreaHa = parseFloat(ha.toFixed(4));
        parcel.polygon = serializePolygon(latlngs);
        setAreaDisplayValue(parcel.fieldAreaHa);
    }

    function renderActiveParcelGeometry() {
        const parcel = getActiveParcel();
        if (!parcel || !drawnItems) return;
        applyAreaModeUI(parcel.areaMode || 'map');
        drawnItems.clearLayers();

        // Handle cadastral mode
        if (parcel.areaMode === 'cadastral') {
            // Restore cadastral opština selection
            if (els.cadastralOpstina) {
                els.cadastralOpstina.value = parcel.cadastralOpstina || '';
            }
            // If there's a saved cadastral polygon, restore it
            if (parcel.cadastralPolygon && parcel.cadastralPolygon.length) {
                // Load cadastral parcels if opština is selected
                if (parcel.cadastralOpstina) {
                    loadCadastralParcels(parcel.cadastralOpstina, parcel.cadastralParcelId);
                }
            }
            setAreaDisplayValue(parcel.fieldAreaHa || '');
            return;
        }

        if (parcel.polygon && parcel.polygon.length) {
            const shape = restorePolygon(parcel.polygon);
            if (shape) {
                drawnItems.addLayer(shape);
                map.fitBounds(shape.getBounds());
                updateArea(shape.getLatLngs());
                return;
            }
        }
        setAreaDisplayValue(parcel.fieldAreaHa || '');
    }

    // ==========================================
    // CADASTRAL PARCELS FUNCTIONALITY
    // ==========================================

    const cadastralStyles = {
        default: {
            color: '#0066ff',
            weight: 2,
            fillColor: '#0066ff',
            fillOpacity: 0.1,
        },
        hover: {
            color: '#0066ff',
            weight: 3,
            fillColor: '#0066ff',
            fillOpacity: 0.3,
        },
        selected: {
            color: '#ffcc00',
            weight: 3,
            fillColor: '#ffcc00',
            fillOpacity: 0.5,
        },
    };

    function clearCadastralLayer() {
        if (cadastralLayer && map) {
            map.removeLayer(cadastralLayer);
            cadastralLayer = null;
        }
        selectedCadastralParcel = null;
        if (els.clearCadastral) {
            els.clearCadastral.style.display = 'none';
        }
        if (els.cadastralInfo) {
            els.cadastralInfo.innerHTML = '';
        }
    }

    function loadCadastralParcels(opstina, preselectedParcelId = null) {
        if (!opstina || cadastralLoadingState) return;

        cadastralLoadingState = true;
        clearCadastralLayer();

        if (els.cadastralInfo) {
            els.cadastralInfo.innerHTML = '<span class="agro-loading-text">Učitavanje katastarskih parcela...</span>';
        }

        const url = data.restUrl + 'parcele?opstina=' + encodeURIComponent(opstina);

        fetch(url, {
            method: 'GET',
            headers: {
                'X-WP-Nonce': data.restNonce,
            },
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || 'Greška pri učitavanju podataka');
                });
            }
            return response.json();
        })
        .then(geojson => {
            cadastralLoadingState = false;

            if (!geojson || !geojson.features || !geojson.features.length) {
                if (els.cadastralInfo) {
                    els.cadastralInfo.innerHTML = '<span class="agro-cadastral-error">Nema parcela za odabranu opštinu.</span>';
                }
                return;
            }

            // Create GeoJSON layer
            cadastralLayer = L.geoJSON(geojson, {
                style: function(feature) {
                    return cadastralStyles.default;
                },
                onEachFeature: function(feature, layer) {
                    // Add hover effects
                    layer.on('mouseover', function(e) {
                        if (selectedCadastralParcel !== layer) {
                            layer.setStyle(cadastralStyles.hover);
                        }
                    });
                    layer.on('mouseout', function(e) {
                        if (selectedCadastralParcel !== layer) {
                            layer.setStyle(cadastralStyles.default);
                        }
                    });

                    // Add click handler
                    layer.on('click', function(e) {
                        selectCadastralParcel(feature, layer);
                    });

                    // Add tooltip with parcel info
                    const props = feature.properties || {};
                    const tooltipContent = `Parcela: ${props.brparcele || 'N/A'}<br>Površina: ${formatAreaForDisplay(props.povrsina)} ha`;
                    layer.bindTooltip(tooltipContent, {
                        permanent: false,
                        direction: 'top',
                        className: 'agro-cadastral-tooltip',
                    });
                },
            });

            cadastralLayer.addTo(map);

            // Fit map to cadastral layer bounds
            const bounds = cadastralLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
            }

            const featureCount = geojson.features.length;
            if (els.cadastralInfo) {
                els.cadastralInfo.innerHTML = `<span class="agro-cadastral-success">Učitano ${featureCount} parcela. Kliknite na parcelu da je odaberete.</span>`;
            }

            // If there's a preselected parcel, select it
            if (preselectedParcelId) {
                cadastralLayer.eachLayer(function(layer) {
                    const props = layer.feature.properties || {};
                    if (props.brparcele === preselectedParcelId) {
                        selectCadastralParcel(layer.feature, layer, false);
                    }
                });
            }
        })
        .catch(error => {
            cadastralLoadingState = false;
            console.error('Error loading cadastral data:', error);
            if (els.cadastralInfo) {
                els.cadastralInfo.innerHTML = `<span class="agro-cadastral-error">Greška: ${error.message}</span>`;
            }
            showToast('Greška pri učitavanju katastarskih podataka: ' + error.message, 'error');
        });
    }

    function formatAreaForDisplay(areaM2) {
        if (!areaM2) return '0';
        const areaHa = parseFloat(areaM2) / 10000;
        return areaHa.toFixed(4);
    }

    function selectCadastralParcel(feature, layer, showNotification = true) {
        // Reset previous selection
        if (selectedCadastralParcel) {
            selectedCadastralParcel.setStyle(cadastralStyles.default);
        }

        // Set new selection
        selectedCadastralParcel = layer;
        layer.setStyle(cadastralStyles.selected);

        const props = feature.properties || {};
        const areaM2 = parseFloat(props.povrsina) || 0;
        const areaHa = areaM2 / 10000;

        // Update parcel data
        const parcel = getActiveParcel();
        if (parcel) {
            parcel.fieldAreaHa = parseFloat(areaHa.toFixed(4));
            parcel.cadastralParcelId = props.brparcele || '';
            parcel.cadastralParcelNumber = props.brparcele || '';
            parcel.cadastralOpstina = els.cadastralOpstina ? els.cadastralOpstina.value : '';

            // Save the polygon coordinates for later restoration
            if (feature.geometry && feature.geometry.coordinates) {
                parcel.cadastralPolygon = feature.geometry.coordinates;
            }
        }

        // Update area display
        setAreaDisplayValue(areaHa.toFixed(4));

        // Show clear button
        if (els.clearCadastral) {
            els.clearCadastral.style.display = 'inline-block';
        }

        // Update info display
        if (els.cadastralInfo) {
            const opstinaName = props.kat_opst_1 || els.cadastralOpstina?.value || '';
            els.cadastralInfo.innerHTML = `
                <div class="agro-cadastral-selected">
                    <strong>Odabrana parcela:</strong><br>
                    Broj parcele: ${props.brparcele || 'N/A'}<br>
                    Opština: ${opstinaName}<br>
                    Površina: ${areaHa.toFixed(4)} ha (${formatNumber(areaM2)} m²)
                </div>
            `;
        }

        // Fit map to selected parcel
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });

        if (showNotification) {
            showToast(`Odabrana parcela ${props.brparcele || ''} - ${areaHa.toFixed(4)} ha`, 'success');
        }
    }

    function clearCadastralSelection() {
        const parcel = getActiveParcel();

        // Reset visual selection
        if (selectedCadastralParcel) {
            selectedCadastralParcel.setStyle(cadastralStyles.default);
            selectedCadastralParcel = null;
        }

        // Clear parcel cadastral data
        if (parcel) {
            parcel.fieldAreaHa = 0;
            parcel.cadastralParcelId = '';
            parcel.cadastralParcelNumber = '';
            parcel.cadastralPolygon = [];
        }

        // Clear area display
        setAreaDisplayValue('');

        // Hide clear button
        if (els.clearCadastral) {
            els.clearCadastral.style.display = 'none';
        }

        // Update info
        if (els.cadastralInfo && cadastralLayer) {
            const featureCount = cadastralLayer.getLayers().length;
            els.cadastralInfo.innerHTML = `<span class="agro-cadastral-success">Učitano ${featureCount} parcela. Kliknite na parcelu da je odaberete.</span>`;
        }

        // Fit map to all parcels
        if (cadastralLayer) {
            const bounds = cadastralLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
            }
        }

        showToast('Selekcija parcele je obrisana', 'info');
    }

    function initCadastralEvents() {
        // Handle opština selection change
        if (els.cadastralOpstina) {
            els.cadastralOpstina.addEventListener('change', function() {
                const opstina = this.value;
                const parcel = getActiveParcel();

                if (parcel) {
                    parcel.cadastralOpstina = opstina;
                    parcel.cadastralParcelId = '';
                    parcel.cadastralParcelNumber = '';
                    parcel.cadastralPolygon = [];
                    parcel.fieldAreaHa = 0;
                }

                setAreaDisplayValue('');

                if (opstina) {
                    loadCadastralParcels(opstina);
                } else {
                    clearCadastralLayer();
                    if (els.cadastralInfo) {
                        els.cadastralInfo.innerHTML = '';
                    }
                }
            });
        }

        // Handle clear cadastral button
        if (els.clearCadastral) {
            els.clearCadastral.addEventListener('click', function(e) {
                e.preventDefault();
                clearCadastralSelection();
            });
        }
    }

    function ensureOperationRow() {
        if (!els.operationsWrap.querySelector('.agro-operation-row')) {
            addOperationRow();
        }
    }

    function addOperationRow(savedOp = null) {
        const row = document.createElement('div');
        row.className = 'agro-operation-row';
        row.innerHTML = `
            <div class="agro-grid">
                <label>
                    <span>Glavna grupa</span>
                    <select class="op-main"></select>
                </label>
                <label>
                    <span>Operacija</span>
                    <select class="op-select"></select>
                </label>
                <label>
                    <span>Jedinica mere</span>
                    <input type="text" class="op-unit" readonly>
                </label>
                <label>
                    <span>Potrošnja goriva</span>
                    <input type="text" class="op-fuel" readonly>
                </label>
                <label>
                    <span>Cena operacije</span>
                    <input type="text" class="op-price" readonly>
                </label>
            </div>
            <div class="op-extra"></div>
            <div class="row-actions"><a href="#" class="op-remove">Ukloni</a></div>
        `;
        els.operationsWrap.appendChild(row);
        populateMainGroup(row);
        row.querySelector('.op-main').addEventListener('change', () => onMainGroupChange(row));
        row.querySelector('.op-select').addEventListener('change', () => onOperationChange(row));
        row.querySelector('.op-remove').addEventListener('click', (e) => {
            e.preventDefault();
            row.remove();
            ensureOperationRow();
        });
        onMainGroupChange(row);
        if (savedOp) {
            const opDef = operations.find(o => o.operation_id === savedOp.operation_id);
            if (opDef) {
                row.querySelector('.op-main').value = opDef.main_group;
                onMainGroupChange(row);
                row.querySelector('.op-select').value = savedOp.operation_id;
                onOperationChange(row, savedOp);
            }
        }
    }

    function populateMainGroup(row) {
        const select = row.querySelector('.op-main');
        select.innerHTML = '';
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '-- izaberite --';
        select.appendChild(empty);
        Object.keys(operationsByGroup).forEach(group => {
            const opt = document.createElement('option');
            opt.value = group;
            opt.textContent = group;
            select.appendChild(opt);
        });
    }

    function onMainGroupChange(row) {
        const main = row.querySelector('.op-main').value;
        const select = row.querySelector('.op-select');
        select.innerHTML = '<option value="">-- izaberite --</option>';
        (operationsByGroup[main] || []).forEach(op => {
            const opt = document.createElement('option');
            opt.value = op.operation_id;
            opt.textContent = op.name;
            select.appendChild(opt);
        });
        row.querySelector('.op-unit').value = '';
        row.querySelector('.op-fuel').value = '';
        row.querySelector('.op-price').value = '';
        row.querySelector('.op-extra').innerHTML = '';
    }

    function onOperationChange(row, savedOp = null) {
        const opId = row.querySelector('.op-select').value;
        const op = operations.find(o => o.operation_id === opId);
        const unitInput = row.querySelector('.op-unit');
        const fuelInput = row.querySelector('.op-fuel');
        const priceInput = row.querySelector('.op-price');
        const extra = row.querySelector('.op-extra');
        extra.innerHTML = '';
        if (!op) {
            unitInput.value = '';
            fuelInput.value = '';
            priceInput.value = '';
            return;
        }
        unitInput.value = op.unit || '';
        fuelInput.value = `${op.fuel_l_per_unit} l/${op.unit}`;
        priceInput.value = `${op.price_per_unit} din/${op.unit}`;
        const fields = [];
        if (op.unit === 'čas') {
            fields.push({ key: 'hours', label: 'Broj potrošenih časova', type: 'number', step: '0.01', min: '0' });
        }
        if (op.main_group === 'Nega useva' && op.sub_group === 'Prihrana') {
            fields.push({ key: 'utrosena_kolicina_prihrane', label: 'Utrošena količina prihrane (kg/ha)', type: 'number', step: '0.01', min: '0' });
            fields.push({ key: 'cena_prihrane_kg', label: 'Cena prihrane po kg (din/kg)', type: 'number', step: '0.01', min: '0' });
            fields.push({ key: 'naziv_prihrane', label: 'Naziv prihrane', type: 'text' });
        }
        if (op.main_group === 'Nega useva' && op.sub_group === 'Zaštita') {
            fields.push({ key: 'utrosena_kolicina_zastite', label: 'Utrošena količina zaštite (l/ha)', type: 'number', step: '0.01', min: '0' });
            fields.push({ key: 'cena_zastite_litra', label: 'Cena zaštite po litru (din/l)', type: 'number', step: '0.01', min: '0' });
            fields.push({ key: 'naziv_zastite', label: 'Naziv zaštitnog sredstva', type: 'text' });
        }
        if (op.main_group === 'Setva i sadnja') {
            fields.push({ key: 'utrosena_kolicina_semena', label: 'Utrošena količina semena (kg/ha)', type: 'number', step: '0.01', min: '0' });
            fields.push({ key: 'cena_semena_kg', label: 'Cena semena po kg (din/kg)', type: 'number', step: '0.01', min: '0' });
            fields.push({ key: 'naziv_semena', label: 'Naziv semena', type: 'text' });
        }
        if (op.main_group === 'Žetva i berba' && op.sub_group === 'Baliranje') {
            fields.push({ key: 'kolicina_bala', label: 'Količina bala', type: 'number', step: '0.01', min: '0' });
        }
        if (op.main_group === 'Transport') {
            fields.push({ key: 'trailer_capacity_tons', label: 'Nosivost prikolice (t)', type: 'number', step: '0.01', min: '0.01' });
        }
        if (fields.length) {
            const grid = document.createElement('div');
            grid.className = 'agro-grid';
            fields.forEach(f => {
                const label = document.createElement('label');
                label.innerHTML = `<span>${f.label}</span>`;
                const input = document.createElement('input');
                input.type = f.type;
                input.name = f.key;
                if (f.step) input.step = f.step;
                if (f.min) input.min = f.min;
                if (savedOp && typeof savedOp[f.key] !== 'undefined') {
                    input.value = savedOp[f.key];
                }
                label.appendChild(input);
                grid.appendChild(label);
            });
            extra.appendChild(grid);
        }
    }

    function parseNumber(val) {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    }

    function gatherOperationsData() {
        const rows = Array.from(els.operationsWrap.querySelectorAll('.agro-operation-row'));
        const result = [];
        rows.forEach(row => {
            const opId = row.querySelector('.op-select').value;
            const op = operations.find(o => o.operation_id === opId);
            if (!op) return;
            const payload = { operation_id: opId };
            payload.hours = parseNumber(row.querySelector('input[name="hours"]')?.value);
            payload.utrosena_kolicina_prihrane = parseNumber(row.querySelector('input[name="utrosena_kolicina_prihrane"]')?.value);
            payload.cena_prihrane_kg = parseNumber(row.querySelector('input[name="cena_prihrane_kg"]')?.value);
            payload.naziv_prihrane = row.querySelector('input[name="naziv_prihrane"]')?.value || '';
            payload.utrosena_kolicina_zastite = parseNumber(row.querySelector('input[name="utrosena_kolicina_zastite"]')?.value);
            payload.cena_zastite_litra = parseNumber(row.querySelector('input[name="cena_zastite_litra"]')?.value);
            payload.naziv_zastite = row.querySelector('input[name="naziv_zastite"]')?.value || '';
            payload.utrosena_kolicina_semena = parseNumber(row.querySelector('input[name="utrosena_kolicina_semena"]')?.value);
            payload.cena_semena_kg = parseNumber(row.querySelector('input[name="cena_semena_kg"]')?.value);
            payload.naziv_semena = row.querySelector('input[name="naziv_semena"]')?.value || '';
            payload.kolicina_bala = parseNumber(row.querySelector('input[name="kolicina_bala"]')?.value);
            payload.trailer_capacity_tons = parseNumber(row.querySelector('input[name="trailer_capacity_tons"]')?.value);
            result.push(payload);
        });
        return result;
    }

    function syncParcelFromInputs() {
        const parcel = getActiveParcel();
        if (!parcel) return;
        parcel.cropId = els.crop.value;
        parcel.tractorId = els.tractor.value;
        parcel.fuelId = els.fuel.value;
        const selectedFuel = fuels.find(f => f.fuel_id === parcel.fuelId);
        parcel.fuelPrice = selectedFuel ? parseNumber(selectedFuel.price_per_liter) : 0;
        parcel.areaMode = getSelectedAreaMode();
        if (parcel.areaMode === 'manual') {
            parcel.manualAreaHa = parseNumber(els.area.value);
            parcel.fieldAreaHa = parcel.manualAreaHa;
        } else if (parcel.areaMode === 'cadastral') {
            // For cadastral mode, area is already set when parcel is selected
            parcel.cadastralOpstina = els.cadastralOpstina ? els.cadastralOpstina.value : '';
            // fieldAreaHa is already set by selectCadastralParcel
        } else {
            parcel.fieldAreaHa = parseNumber(els.area.value);
        }
        parcel.operations = gatherOperationsData();
        parcel.yieldPerHa = parseNumber(document.getElementById('agro-yield-per-ha').value);
        parcel.pricePerKg = parseNumber(document.getElementById('agro-price-per-kg').value);
    }

    function loadParcelToForm(parcel) {
        if (!parcel) return;
        els.crop.value = parcel.cropId || '';
        els.tractor.value = parcel.tractorId || '';
        els.fuel.value = parcel.fuelId || '';
        const areaMode = parcel.areaMode || 'map';
        const areaValue = areaMode === 'manual' ? parcel.manualAreaHa : parcel.fieldAreaHa;
        els.area.value = areaValue || '';
        applyAreaModeUI(areaMode);
        els.areaModeRadios.forEach(radio => {
            radio.checked = radio.value === areaMode;
        });

        // Handle cadastral mode restoration
        if (areaMode === 'cadastral') {
            if (els.cadastralOpstina) {
                els.cadastralOpstina.value = parcel.cadastralOpstina || '';
            }
            // Load cadastral parcels if opština is selected
            if (parcel.cadastralOpstina) {
                loadCadastralParcels(parcel.cadastralOpstina, parcel.cadastralParcelId);
            }
        }

        const yieldInput = document.getElementById('agro-yield-per-ha');
        const priceInput = document.getElementById('agro-price-per-kg');
        yieldInput.value = parcel.yieldPerHa || '';
        priceInput.value = parcel.pricePerKg || '';
        els.operationsWrap.innerHTML = '';
        if (parcel.operations.length) {
            parcel.operations.forEach(op => addOperationRow(op));
        } else {
            ensureOperationRow();
        }
        renderActiveParcelGeometry();
    }

    function validateActiveParcel() {
        const parcel = getActiveParcel();
        if (!parcel) return false;

        let isValid = true;
        const errors = [];

        if (!parcel.cropId) {
            errors.push('Molimo izaberite kulturu');
            isValid = false;
        }
        if (!parcel.tractorId) {
            errors.push('Molimo izaberite traktor');
            isValid = false;
        }
        if (!parcel.fuelId) {
            errors.push('Molimo izaberite gorivo');
            isValid = false;
        }
        if (parcel.fieldAreaHa <= 0) {
            errors.push('Molimo unesite površinu parcele (ručno ili preko mape)');
            isValid = false;
        }

        if (!isValid) {
            showToast(errors.join('. '), 'error');
        }

        return isValid;
    }

    function calculateParcel(parcel) {
        const ops = parcel.operations || [];
        let totalHa = 0, totalCas = 0, totalPrihrana = 0, totalZastita = 0, totalSemena = 0, totalBaliranje = 0, totalTransport = 0;
        const opDetails = [];
        const totalYieldKg = parcel.fieldAreaHa * parcel.yieldPerHa;
        const totalYieldT = totalYieldKg / 1000;
        ops.forEach(saved => {
            const op = operations.find(o => o.operation_id === saved.operation_id);
            if (!op) return;
            let fuelCost = 0;
            let priceCost = 0;
            let total = 0;
            let trips = 0;
            let trailerCapacity = parseNumber(saved.trailer_capacity_tons);
            let costPerTrip = 0;
            if (op.main_group === 'Transport') {
                if (trailerCapacity > 0 && totalYieldT > 0) {
                    trips = Math.ceil(totalYieldT / trailerCapacity);
                }
                costPerTrip = (op.fuel_l_per_unit * parcel.fuelPrice) + op.price_per_unit;
                fuelCost = trips * op.fuel_l_per_unit * parcel.fuelPrice;
                priceCost = trips * op.price_per_unit;
                total = trips * costPerTrip;
                totalTransport += total;
            } else if (op.unit === 'ha') {
                fuelCost = parcel.fieldAreaHa * op.fuel_l_per_unit * parcel.fuelPrice;
                priceCost = parcel.fieldAreaHa * op.price_per_unit;
                total = fuelCost + priceCost;
                totalHa += total;
            } else if (op.unit === 'čas') {
                fuelCost = saved.hours * op.fuel_l_per_unit * parcel.fuelPrice;
                priceCost = saved.hours * op.price_per_unit;
                total = fuelCost + priceCost;
                totalCas += total;
            } else if (op.main_group === 'Žetva i berba' && op.sub_group === 'Baliranje') {
                fuelCost = 0;
                priceCost = saved.kolicina_bala * op.price_per_unit;
                total = priceCost;
                totalBaliranje += total;
            }
            if (op.main_group === 'Nega useva' && op.sub_group === 'Prihrana') {
                const fert = parcel.fieldAreaHa * saved.utrosena_kolicina_prihrane * saved.cena_prihrane_kg;
                totalPrihrana += fert;
                total += fert;
            }
            if (op.main_group === 'Nega useva' && op.sub_group === 'Zaštita') {
                const protect = parcel.fieldAreaHa * saved.utrosena_kolicina_zastite * saved.cena_zastite_litra;
                totalZastita += protect;
                total += protect;
            }
            if (op.main_group === 'Setva i sadnja') {
                const seeds = parcel.fieldAreaHa * saved.utrosena_kolicina_semena * saved.cena_semena_kg;
                totalSemena += seeds;
                total += seeds;
            }
            opDetails.push({
                name: op.name,
                unit: op.unit,
                fuel_cost: fuelCost,
                price_cost: priceCost,
                total: total,
                is_transport: op.main_group === 'Transport',
                trailer_capacity_tons: trailerCapacity,
                trips: trips,
                cost_per_trip: costPerTrip,
            });
        });
        const totalCost = totalHa + totalCas + totalPrihrana + totalZastita + totalSemena + totalBaliranje + totalTransport;
        const revenue = parcel.fieldAreaHa * parcel.yieldPerHa * parcel.pricePerKg;
        const profit = revenue - totalCost;
        return {
            operations: opDetails,
            total_trosak_ha: totalHa,
            total_trosak_cas: totalCas,
            total_trosak_prihrane: totalPrihrana,
            total_trosak_zastite: totalZastita,
            total_trosak_semena: totalSemena,
            total_trosak_baliranja: totalBaliranje,
            total_trosak_transporta: totalTransport,
            total_cost: totalCost,
            revenue,
            profit,
        };
    }

    function getCropName(id) {
        return (crops.find(c => c.crop_id === id) || {}).name || '';
    }

    function getTractorLabel(id) {
        const tr = tractors.find(t => t.tractor_id === id);
        if (!tr) return '';
        return `${tr.name}${tr.power_hp_label ? ' (' + tr.power_hp_label + ')' : ''}`;
    }

    function getFuelLabel(id) {
        const fuel = fuels.find(f => f.fuel_id === id);
        if (!fuel) return '';
        return `${fuel.name} (${fuel.price_per_liter} din/l)`;
    }

    function getFuelData(id) {
        return fuels.find(f => f.fuel_id === id) || null;
    }

    function renderResults() {
        const validParcels = state.parcels.filter(p => p.result);
        if (!validParcels.length) {
            els.results.innerHTML = '<p>Nema sačuvanih parcela.</p>';
            els.pdf.disabled = true;
            return;
        }
        els.pdf.disabled = false;
        let html = '';
        let totals = { cost: 0, revenue: 0, profit: 0, ha: 0, cas: 0, prihrana: 0, zastita: 0, semena: 0, baliranje: 0, transport: 0 };
        validParcels.forEach((p, idx) => {
            totals.cost += p.result.total_cost;
            totals.revenue += p.result.revenue;
            totals.profit += p.result.profit;
            totals.ha += p.result.total_trosak_ha;
            totals.cas += p.result.total_trosak_cas;
            totals.prihrana += p.result.total_trosak_prihrane;
            totals.zastita += p.result.total_trosak_zastite;
            totals.semena += p.result.total_trosak_semena;
            totals.baliranje += p.result.total_trosak_baliranja;
            totals.transport += p.result.total_trosak_transporta;
            html += `<div class="agro-card">`;
            html += `<h4>Parcela ${idx + 1} – ${getCropName(p.cropId)} (${p.fieldAreaHa} ha)</h4>`;
            html += `<p>Traktor: ${getTractorLabel(p.tractorId)} | Gorivo: ${getFuelLabel(p.fuelId)}</p>`;
            html += `<table class="agro-summary-table"><thead><tr><th>Operacija</th><th>J.m.</th><th>Detalji</th><th>Gorivo</th><th>Cena</th><th>Ukupno</th></tr></thead><tbody>`;
            p.result.operations.forEach(op => {
                const transportDetails = op.is_transport ? [`Nosivost: ${op.trailer_capacity_tons || 0} t`, `Broj tura: ${op.trips || 0}`] : [];
                if (op.is_transport && op.cost_per_trip) {
                    transportDetails.push(`Cena po turi: ${formatCurrency(op.cost_per_trip)}`);
                }
                const detailCell = transportDetails.length ? transportDetails.join('<br>') : '-';
                html += `<tr><td>${op.name}</td><td>${op.unit}</td><td>${detailCell}</td><td>${formatCurrency(op.fuel_cost)}</td><td>${formatCurrency(op.price_cost)}</td><td>${formatCurrency(op.total)}</td></tr>`;
            });
            html += `</tbody></table>`;
            html += `<p>Troškovi ha: ${formatCurrency(p.result.total_trosak_ha)} | Čas: ${formatCurrency(p.result.total_trosak_cas)} | Prihrana: ${formatCurrency(p.result.total_trosak_prihrane)} | Zaštita: ${formatCurrency(p.result.total_trosak_zastite)} | Seme: ${formatCurrency(p.result.total_trosak_semena)} | Baliranje: ${formatCurrency(p.result.total_trosak_baliranja)} | Transport: ${formatCurrency(p.result.total_trosak_transporta)}</p>`;
            html += `<p>Ukupan trošak: <strong>${formatCurrency(p.result.total_cost)}</strong></p>`;
            html += `<p>Prinos: <strong>${formatCurrency(p.result.revenue)}</strong> | Agrotehnička dobit: <strong>${formatCurrency(p.result.profit)}</strong></p>`;
            html += `</div>`;
        });
        html += `<div class="agro-card">`;
        html += `<h4>Zbirno (${validParcels.length} parcela)</h4>`;
        html += `<p>Troškovi ha: ${formatCurrency(totals.ha)} | Čas: ${formatCurrency(totals.cas)} | Prihrana: ${formatCurrency(totals.prihrana)} | Zaštita: ${formatCurrency(totals.zastita)} | Seme: ${formatCurrency(totals.semena)} | Baliranje: ${formatCurrency(totals.baliranje)} | Transport: ${formatCurrency(totals.transport)}</p>`;
        html += `<p>Ukupni troškovi: <strong>${formatCurrency(totals.cost)}</strong></p>`;
        html += `<p>Ukupan prinos: <strong>${formatCurrency(totals.revenue)}</strong> | Ukupna agrotehnička dobit: <strong>${formatCurrency(totals.profit)}</strong></p>`;
        html += `</div>`;
        els.results.innerHTML = html;
        const pdfParcels = validParcels.map(p => {
            const fuel = getFuelData(p.fuelId) || {};
            return {
                crop_name: getCropName(p.cropId),
                area: p.fieldAreaHa,
                tractor_name: getTractorLabel(p.tractorId),
                fuel_name: fuel.name || '',
                fuel_price: fuel.price_per_liter || 0,
                operations: p.result.operations.map(op => ({
                    name: op.name,
                    unit: op.unit,
                    fuel_cost: formatCurrencyRsd(op.fuel_cost),
                    price_cost: formatCurrencyRsd(op.price_cost),
                    total: formatCurrencyRsd(op.total),
                })),
                total_trosak_ha: p.result.total_trosak_ha,
                total_trosak_cas: p.result.total_trosak_cas,
                total_trosak_prihrane: p.result.total_trosak_prihrane,
                total_trosak_zastite: p.result.total_trosak_zastite,
                total_trosak_semena: p.result.total_trosak_semena,
                total_trosak_baliranja: p.result.total_trosak_baliranja,
                total_trosak_transporta: p.result.total_trosak_transporta,
                total_cost: p.result.total_cost,
                revenue: p.result.revenue,
                profit: p.result.profit,
            };
        });
        els.pdf.dataset.payload = JSON.stringify({ parcels: pdfParcels, totals: { total_cost: totals.cost, revenue: totals.revenue, profit: totals.profit, transport: totals.transport } });
    }

    function saveActiveParcel() {
        syncParcelFromInputs();
        if (!validateActiveParcel()) return;

        setButtonLoading(els.saveParcel, true);

        // Simulate async save for better UX
        setTimeout(() => {
            const parcel = getActiveParcel();
            parcel.result = calculateParcel(parcel);
            renderResults();
            setButtonLoading(els.saveParcel, false);
            showToast('Parcela uspešno sačuvana!', 'success');
        }, 200);
    }

    function calculateAllParcels() {
        syncParcelFromInputs();

        setButtonLoading(els.calculate, true);

        // Simulate async calculation for better UX
        setTimeout(() => {
            let hasResult = false;
            state.parcels.forEach(parcel => {
                if (parcel.cropId && parcel.tractorId && parcel.fuelId && parcel.fieldAreaHa > 0) {
                    parcel.result = calculateParcel(parcel);
                    hasResult = true;
                }
            });

            setButtonLoading(els.calculate, false);

            if (!hasResult) {
                showToast('Molimo popunite barem jednu parcelu.', 'warning');
                return;
            }

            renderResults();
            showToast('Kalkulacija uspešno završena!', 'success');
        }, 300);
    }

    function switchParcel(index) {
        syncParcelFromInputs();
        state.activeParcelIndex = index;
        renderTabs();
        loadParcelToForm(getActiveParcel());
    }

    function addParcelTab() {
        syncParcelFromInputs();
        state.parcels.push(createEmptyParcel());
        state.activeParcelIndex = state.parcels.length - 1;
        renderTabs();
        loadParcelToForm(getActiveParcel());
        showToast(`Dodana nova parcela ${state.parcels.length}`, 'success');
    }

    function resetAll() {
        if (state.parcels.some(p => p.result)) {
            if (!confirm('Da li ste sigurni da želite da resetujete sve podatke? Ova akcija ne može biti poništena.')) {
                return;
            }
        }

        state.parcels = [createEmptyParcel()];
        state.activeParcelIndex = 0;
        renderTabs();
        loadParcelToForm(getActiveParcel());
        els.results.innerHTML = '';
        els.pdf.disabled = true;
        showToast('Kalkulacija je resetovana', 'info');
    }

    function sendPdf() {
        const payload = els.pdf.dataset.payload;
        if (!payload) {
            showToast('Nema podataka za PDF izvještaj', 'error');
            return;
        }

        setButtonLoading(els.pdf, true);

        const formData = new FormData();
        formData.append('action', 'agro_generate_pdf');
        formData.append('nonce', data.nonce);
        formData.append('data', payload);

        fetch(data.ajaxUrl, {
            method: 'POST',
            body: formData,
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Greška pri generisanju PDF-a');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'agro-kalkulator.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast('PDF uspešno preuzet!', 'success');
        })
        .catch(error => {
            console.error('PDF generation error:', error);
            showToast('Greška pri generisanju PDF-a. Molimo pokušajte ponovo.', 'error');
        })
        .finally(() => {
            setButtonLoading(els.pdf, false);
        });
    }

    function initEvents() {
        els.addOperation.addEventListener('click', (e) => {
            e.preventDefault();
            addOperationRow();
        });
        els.saveParcel.addEventListener('click', (e) => {
            e.preventDefault();
            saveActiveParcel();
        });
        els.calculate.addEventListener('click', (e) => {
            e.preventDefault();
            calculateAllParcels();
        });
        els.reset.addEventListener('click', (e) => {
            e.preventDefault();
            resetAll();
        });
        els.pdf.addEventListener('click', (e) => {
            e.preventDefault();
            sendPdf();
        });
        els.areaModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const mode = radio.value;
                const parcel = getActiveParcel();
                if (!parcel) return;
                parcel.areaMode = mode;
                applyAreaModeUI(mode);
                if (mode === 'manual') {
                    parcel.manualAreaHa = parseNumber(els.area.value);
                    parcel.fieldAreaHa = parcel.manualAreaHa;
                    // Clear cadastral data when switching to manual
                    parcel.cadastralOpstina = '';
                    parcel.cadastralParcelId = '';
                    parcel.cadastralParcelNumber = '';
                    parcel.cadastralPolygon = [];
                } else if (mode === 'cadastral') {
                    // Clear drawn polygon when switching to cadastral
                    parcel.polygon = [];
                    parcel.fieldAreaHa = 0;
                    setAreaDisplayValue('');
                    if (drawnItems) {
                        drawnItems.clearLayers();
                    }
                    // Restore cadastral opština if previously selected
                    if (els.cadastralOpstina) {
                        els.cadastralOpstina.value = parcel.cadastralOpstina || '';
                        if (parcel.cadastralOpstina) {
                            loadCadastralParcels(parcel.cadastralOpstina, parcel.cadastralParcelId);
                        }
                    }
                } else {
                    // Map mode - clear cadastral data
                    parcel.cadastralOpstina = '';
                    parcel.cadastralParcelId = '';
                    parcel.cadastralParcelNumber = '';
                    parcel.cadastralPolygon = [];
                    parcel.fieldAreaHa = 0;
                    setAreaDisplayValue('');
                    renderActiveParcelGeometry();
                }
            });
        });
        els.area.addEventListener('input', () => {
            const parcel = getActiveParcel();
            if (!parcel || parcel.areaMode !== 'manual') return;
            parcel.manualAreaHa = parseNumber(els.area.value);
            parcel.fieldAreaHa = parcel.manualAreaHa;
        });
        els.currencyRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                state.currency = radio.value;
                renderResults();
            });
        });
        [els.crop, els.tractor, els.fuel, document.getElementById('agro-yield-per-ha'), document.getElementById('agro-price-per-kg')]
            .forEach(input => {
                input.addEventListener('change', () => syncParcelFromInputs());
            });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSelects();
        state.parcels.push(createEmptyParcel());
        renderTabs();
        initMap();
        ensureOperationRow();
        loadParcelToForm(getActiveParcel());
        initEvents();
        initCadastralEvents();
    });
})();
