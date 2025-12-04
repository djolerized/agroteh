(function () {
    const data = window.agroKalkulatorData || {};
    const state = {
        parcels: [],
        activeParcelIndex: 0,
    };

    function createEmptyParcel() {
        return {
            cropId: '',
            tractorId: '',
            fuelId: '',
            fuelPrice: 0,
            fieldAreaHa: 0,
            polygon: [],
            operations: [],
            yieldPerHa: 0,
            pricePerKg: 0,
            result: null,
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
        operationsWrap: document.getElementById('agro-operations'),
        addOperation: document.getElementById('agro-add-operation'),
        saveParcel: document.getElementById('agro-save-parcel'),
        calculate: document.getElementById('agro-calculate'),
        results: document.getElementById('agro-results'),
        reset: document.getElementById('agro-reset'),
        pdf: document.getElementById('agro-generate-pdf'),
    };

    function formatCurrency(value) {
        return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
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

    function updateArea(latlngs) {
        const ha = polygonAreaHa(latlngs);
        const parcel = getActiveParcel();
        parcel.fieldAreaHa = parseFloat(ha.toFixed(4));
        parcel.polygon = serializePolygon(latlngs);
        els.area.value = parcel.fieldAreaHa;
    }

    function renderActiveParcelGeometry() {
        const parcel = getActiveParcel();
        if (!parcel || !drawnItems) return;
        drawnItems.clearLayers();
        if (parcel.polygon && parcel.polygon.length) {
            const shape = restorePolygon(parcel.polygon);
            if (shape) {
                drawnItems.addLayer(shape);
                map.fitBounds(shape.getBounds());
                updateArea(shape.getLatLngs());
                return;
            }
        }
        els.area.value = parcel.fieldAreaHa || '';
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
                    <span>Dodatni podaci</span>
                    <div class="op-summary">-</div>
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
        row.querySelector('.op-summary').textContent = '-';
        row.querySelector('.op-extra').innerHTML = '';
    }

    function onOperationChange(row, savedOp = null) {
        const opId = row.querySelector('.op-select').value;
        const op = operations.find(o => o.operation_id === opId);
        const summary = row.querySelector('.op-summary');
        const extra = row.querySelector('.op-extra');
        extra.innerHTML = '';
        if (!op) {
            summary.textContent = '-';
            return;
        }
        summary.textContent = `J.m.: ${op.unit}, Potrošnja: ${op.fuel_l_per_unit} l/${op.unit}, Cena: ${op.price_per_unit} din/${op.unit}`;
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
        parcel.fieldAreaHa = parseNumber(els.area.value);
        parcel.operations = gatherOperationsData();
        parcel.yieldPerHa = parseNumber(document.getElementById('agro-yield-per-ha').value);
        parcel.pricePerKg = parseNumber(document.getElementById('agro-price-per-kg').value);
    }

    function loadParcelToForm(parcel) {
        if (!parcel) return;
        els.crop.value = parcel.cropId || '';
        els.tractor.value = parcel.tractorId || '';
        els.fuel.value = parcel.fuelId || '';
        els.area.value = parcel.fieldAreaHa || '';
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
        if (!parcel.cropId || !parcel.tractorId || !parcel.fuelId || parcel.fieldAreaHa <= 0) {
            alert('Molimo popunite kulturu, traktor, gorivo i nacrtajte parcelu.');
            return false;
        }
        return true;
    }

    function calculateParcel(parcel) {
        const ops = parcel.operations || [];
        let totalHa = 0, totalCas = 0, totalPrihrana = 0, totalZastita = 0, totalSemena = 0, totalBaliranje = 0;
        const opDetails = [];
        ops.forEach(saved => {
            const op = operations.find(o => o.operation_id === saved.operation_id);
            if (!op) return;
            let fuelCost = 0;
            let priceCost = 0;
            let total = 0;
            if (op.unit === 'ha') {
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
                fuel_cost: formatCurrency(fuelCost),
                price_cost: formatCurrency(priceCost),
                total: formatCurrency(total),
            });
        });
        const totalCost = totalHa + totalCas + totalPrihrana + totalZastita + totalSemena + totalBaliranje;
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
        let totals = { cost: 0, revenue: 0, profit: 0, ha: 0, cas: 0, prihrana: 0, zastita: 0, semena: 0, baliranje: 0 };
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
            html += `<div class="agro-card">`;
            html += `<h4>Parcela ${idx + 1} – ${getCropName(p.cropId)} (${p.fieldAreaHa} ha)</h4>`;
            html += `<p>Traktor: ${getTractorLabel(p.tractorId)} | Gorivo: ${getFuelLabel(p.fuelId)}</p>`;
            html += `<table class="agro-summary-table"><thead><tr><th>Operacija</th><th>J.m.</th><th>Gorivo</th><th>Cena</th><th>Ukupno</th></tr></thead><tbody>`;
            p.result.operations.forEach(op => {
                html += `<tr><td>${op.name}</td><td>${op.unit}</td><td>${op.fuel_cost}</td><td>${op.price_cost}</td><td>${op.total}</td></tr>`;
            });
            html += `</tbody></table>`;
            html += `<p>Troškovi ha: ${formatCurrency(p.result.total_trosak_ha)} | Čas: ${formatCurrency(p.result.total_trosak_cas)} | Prihrana: ${formatCurrency(p.result.total_trosak_prihrane)} | Zaštita: ${formatCurrency(p.result.total_trosak_zastite)} | Seme: ${formatCurrency(p.result.total_trosak_semena)} | Baliranje: ${formatCurrency(p.result.total_trosak_baliranja)}</p>`;
            html += `<p>Ukupan trošak: <strong>${formatCurrency(p.result.total_cost)}</strong></p>`;
            html += `<p>Prinos: <strong>${formatCurrency(p.result.revenue)}</strong> | Agrotehnička dobit: <strong>${formatCurrency(p.result.profit)}</strong></p>`;
            html += `</div>`;
        });
        html += `<div class="agro-card">`;
        html += `<h4>Zbirno (${validParcels.length} parcela)</h4>`;
        html += `<p>Troškovi ha: ${formatCurrency(totals.ha)} | Čas: ${formatCurrency(totals.cas)} | Prihrana: ${formatCurrency(totals.prihrana)} | Zaštita: ${formatCurrency(totals.zastita)} | Seme: ${formatCurrency(totals.semena)} | Baliranje: ${formatCurrency(totals.baliranje)}</p>`;
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
                operations: p.result.operations,
                total_trosak_ha: p.result.total_trosak_ha,
                total_trosak_cas: p.result.total_trosak_cas,
                total_trosak_prihrane: p.result.total_trosak_prihrane,
                total_trosak_zastite: p.result.total_trosak_zastite,
                total_trosak_semena: p.result.total_trosak_semena,
                total_trosak_baliranja: p.result.total_trosak_baliranja,
                total_cost: p.result.total_cost,
                revenue: p.result.revenue,
                profit: p.result.profit,
            };
        });
        els.pdf.dataset.payload = JSON.stringify({ parcels: pdfParcels, totals: { total_cost: totals.cost, revenue: totals.revenue, profit: totals.profit } });
    }

    function saveActiveParcel() {
        syncParcelFromInputs();
        if (!validateActiveParcel()) return;
        const parcel = getActiveParcel();
        parcel.result = calculateParcel(parcel);
        renderResults();
    }

    function calculateAllParcels() {
        syncParcelFromInputs();
        let hasResult = false;
        state.parcels.forEach(parcel => {
            if (parcel.cropId && parcel.tractorId && parcel.fuelId && parcel.fieldAreaHa > 0) {
                parcel.result = calculateParcel(parcel);
                hasResult = true;
            }
        });
        if (!hasResult) {
            alert('Molimo popunite barem jednu parcelu.');
            return;
        }
        renderResults();
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
    }

    function resetAll() {
        state.parcels = [createEmptyParcel()];
        state.activeParcelIndex = 0;
        renderTabs();
        loadParcelToForm(getActiveParcel());
        els.results.innerHTML = '';
        els.pdf.disabled = true;
    }

    function sendPdf() {
        const payload = els.pdf.dataset.payload;
        if (!payload) return;
        const formData = new FormData();
        formData.append('action', 'agro_generate_pdf');
        formData.append('nonce', data.nonce);
        formData.append('data', payload);
        fetch(data.ajaxUrl, {
            method: 'POST',
            body: formData,
        }).then(response => response.blob()).then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'agro-kalkulator.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
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
    });
})();
