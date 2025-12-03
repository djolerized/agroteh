(function () {
    const data = window.agroKalkulatorData || {};
    const state = {
        step: 1,
        fieldAreaHa: 0,
        selectedFuel: null,
        selectedCrop: null,
        selectedTractor: null,
        fuelPrice: 0,
        operations: [],
        parcels: [],
    };

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
        steps: document.querySelectorAll('.agro-step'),
        crop: document.getElementById('agro-crop'),
        tractor: document.getElementById('agro-tractor'),
        fuel: document.getElementById('agro-fuel'),
        area: document.getElementById('agro-area'),
        operationsWrap: document.getElementById('agro-operations'),
        addOperation: document.getElementById('agro-add-operation'),
        addParcel: document.getElementById('agro-add-parcel'),
        results: document.getElementById('agro-results'),
        reset: document.getElementById('agro-reset'),
        pdf: document.getElementById('agro-generate-pdf'),
    };

    function formatCurrency(value) {
        return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    }

    function switchStep(step) {
        state.step = step;
        els.steps.forEach(s => {
            s.style.display = parseInt(s.dataset.step, 10) === step ? 'block' : 'none';
        });
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
    }

    function polygonAreaHa(latlngs) {
        if (!latlngs || !latlngs[0]) {
            return 0;
        }
        const area = L.GeometryUtil.geodesicArea(latlngs[0]);
        return area / 10000;
    }

    function updateArea(latlngs) {
        const ha = polygonAreaHa(latlngs);
        state.fieldAreaHa = parseFloat(ha.toFixed(4));
        els.area.value = state.fieldAreaHa;
    }

    function ensureOperationRow() {
        if (!els.operationsWrap.querySelector('.agro-operation-row')) {
            addOperationRow();
        }
    }

    function addOperationRow() {
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

    function onOperationChange(row) {
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
                label.appendChild(input);
                grid.appendChild(label);
            });
            extra.appendChild(grid);
        }
    }

    function validateStep1() {
        const crop = els.crop.value;
        const tractor = els.tractor.value;
        const fuelId = els.fuel.value;
        if (!crop || !tractor || !fuelId || state.fieldAreaHa <= 0) {
            alert('Molimo popunite kulturu, traktor, gorivo i nacrtajte parcelu.');
            return false;
        }
        state.selectedCrop = crops.find(c => c.crop_id === crop);
        state.selectedTractor = tractors.find(t => t.tractor_id === tractor);
        state.selectedFuel = fuels.find(f => f.fuel_id === fuelId);
        state.fuelPrice = state.selectedFuel ? parseFloat(state.selectedFuel.price_per_liter) : 0;
        return true;
    }

    function parseNumber(val) {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    }

    function gatherOperations() {
        const rows = Array.from(els.operationsWrap.querySelectorAll('.agro-operation-row'));
        const result = [];
        rows.forEach(row => {
            const opId = row.querySelector('.op-select').value;
            const op = operations.find(o => o.operation_id === opId);
            if (!op) return;
            const payload = { ...op };
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

    function calculateParcel(yieldPerHa, pricePerKg) {
        const ops = gatherOperations();
        let totalHa = 0, totalCas = 0, totalPrihrana = 0, totalZastita = 0, totalSemena = 0, totalBaliranje = 0;
        const opDetails = [];
        ops.forEach(op => {
            let fuelCost = 0;
            let priceCost = 0;
            let total = 0;
            if (op.unit === 'ha') {
                fuelCost = state.fieldAreaHa * op.fuel_l_per_unit * state.fuelPrice;
                priceCost = state.fieldAreaHa * op.price_per_unit;
                total = fuelCost + priceCost;
                totalHa += total;
            } else if (op.unit === 'čas') {
                fuelCost = op.hours * op.fuel_l_per_unit * state.fuelPrice;
                priceCost = op.hours * op.price_per_unit;
                total = fuelCost + priceCost;
                totalCas += total;
            } else if (op.main_group === 'Žetva i berba' && op.sub_group === 'Baliranje') {
                fuelCost = 0;
                priceCost = op.kolicina_bala * op.price_per_unit;
                total = priceCost;
                totalBaliranje += total;
            }
            if (op.main_group === 'Nega useva' && op.sub_group === 'Prihrana') {
                const fert = state.fieldAreaHa * op.utrosena_kolicina_prihrane * op.cena_prihrane_kg;
                totalPrihrana += fert;
                total += fert;
            }
            if (op.main_group === 'Nega useva' && op.sub_group === 'Zaštita') {
                const protect = state.fieldAreaHa * op.utrosena_kolicina_zastite * op.cena_zastite_litra;
                totalZastita += protect;
                total += protect;
            }
            if (op.main_group === 'Setva i sadnja') {
                const seeds = state.fieldAreaHa * op.utrosena_kolicina_semena * op.cena_semena_kg;
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
        const revenue = state.fieldAreaHa * yieldPerHa * pricePerKg;
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

    function renderResults() {
        if (!state.parcels.length) {
            els.results.innerHTML = '<p>Nema sačuvanih parcela.</p>';
            els.pdf.disabled = true;
            return;
        }
        els.pdf.disabled = false;
        let html = '';
        let totals = { cost: 0, revenue: 0, profit: 0, ha: 0, cas: 0, prihrana: 0, zastita: 0, semena: 0, baliranje: 0 };
        state.parcels.forEach((p, idx) => {
            totals.cost += p.total_cost;
            totals.revenue += p.revenue;
            totals.profit += p.profit;
            totals.ha += p.total_trosak_ha;
            totals.cas += p.total_trosak_cas;
            totals.prihrana += p.total_trosak_prihrane;
            totals.zastita += p.total_trosak_zastite;
            totals.semena += p.total_trosak_semena;
            totals.baliranje += p.total_trosak_baliranja;
            html += `<div class="agro-card">`;
            html += `<h4>Parcela ${idx + 1} – ${p.crop_name} (${p.area} ha)</h4>`;
            html += `<p>Traktor: ${p.tractor_name}${p.tractor_hp ? ' (' + p.tractor_hp + ')' : ''} | Gorivo: ${p.fuel_name} (${p.fuel_price} din/l)</p>`;
            html += `<table class="agro-summary-table"><thead><tr><th>Operacija</th><th>J.m.</th><th>Gorivo</th><th>Cena</th><th>Ukupno</th></tr></thead><tbody>`;
            p.operations.forEach(op => {
                html += `<tr><td>${op.name}</td><td>${op.unit}</td><td>${op.fuel_cost}</td><td>${op.price_cost}</td><td>${op.total}</td></tr>`;
            });
            html += `</tbody></table>`;
            html += `<p>Troškovi ha: ${formatCurrency(p.total_trosak_ha)} | Čas: ${formatCurrency(p.total_trosak_cas)} | Prihrana: ${formatCurrency(p.total_trosak_prihrane)} | Zaštita: ${formatCurrency(p.total_trosak_zastite)} | Seme: ${formatCurrency(p.total_trosak_semena)} | Baliranje: ${formatCurrency(p.total_trosak_baliranja)}</p>`;
            html += `<p>Ukupan trošak: <strong>${formatCurrency(p.total_cost)}</strong></p>`;
            html += `<p>Prinos: <strong>${formatCurrency(p.revenue)}</strong> | Agrotehnička dobit: <strong>${formatCurrency(p.profit)}</strong></p>`;
            html += `</div>`;
        });
        html += `<div class="agro-card">`;
        html += `<h4>Zbirno (${state.parcels.length} parcela)</h4>`;
        html += `<p>Troškovi ha: ${formatCurrency(totals.ha)} | Čas: ${formatCurrency(totals.cas)} | Prihrana: ${formatCurrency(totals.prihrana)} | Zaštita: ${formatCurrency(totals.zastita)} | Seme: ${formatCurrency(totals.semena)} | Baliranje: ${formatCurrency(totals.baliranje)}</p>`;
        html += `<p>Ukupni troškovi: <strong>${formatCurrency(totals.cost)}</strong></p>`;
        html += `<p>Ukupan prinos: <strong>${formatCurrency(totals.revenue)}</strong> | Ukupna agrotehnička dobit: <strong>${formatCurrency(totals.profit)}</strong></p>`;
        html += `</div>`;
        els.results.innerHTML = html;
        els.pdf.dataset.payload = JSON.stringify({ parcels: state.parcels, totals: { total_cost: totals.cost, revenue: totals.revenue, profit: totals.profit } });
    }

    function resetForm() {
        state.fieldAreaHa = 0;
        state.operations = [];
        els.area.value = '';
        els.crop.value = '';
        els.tractor.value = '';
        els.fuel.value = '';
        els.operationsWrap.innerHTML = '';
        ensureOperationRow();
        if (drawnItems) {
            drawnItems.clearLayers();
        }
        document.getElementById('agro-yield-per-ha').value = '';
        document.getElementById('agro-price-per-kg').value = '';
    }

    function addParcel() {
        if (!validateStep1()) return;
        const yieldPerHa = parseNumber(document.getElementById('agro-yield-per-ha').value);
        const pricePerKg = parseNumber(document.getElementById('agro-price-per-kg').value);
        const result = calculateParcel(yieldPerHa, pricePerKg);
        const parcel = {
            crop_name: state.selectedCrop.name,
            tractor_name: state.selectedTractor.name,
            tractor_hp: state.selectedTractor.power_hp_label,
            fuel_name: state.selectedFuel.name,
            fuel_price: state.fuelPrice,
            area: state.fieldAreaHa,
            operations: result.operations,
            total_trosak_ha: result.total_trosak_ha,
            total_trosak_cas: result.total_trosak_cas,
            total_trosak_prihrane: result.total_trosak_prihrane,
            total_trosak_zastite: result.total_trosak_zastite,
            total_trosak_semena: result.total_trosak_semena,
            total_trosak_baliranja: result.total_trosak_baliranja,
            total_cost: result.total_cost,
            revenue: result.revenue,
            profit: result.profit,
        };
        state.parcels.push(parcel);
        renderResults();
        switchStep(4);
        resetForm();
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
        document.getElementById('agro-step1-next').addEventListener('click', () => {
            if (validateStep1()) {
                switchStep(2);
            }
        });
        document.getElementById('agro-step2-prev').addEventListener('click', () => switchStep(1));
        document.getElementById('agro-step2-next').addEventListener('click', () => switchStep(3));
        document.getElementById('agro-step3-prev').addEventListener('click', () => switchStep(2));
        els.addOperation.addEventListener('click', (e) => {
            e.preventDefault();
            addOperationRow();
        });
        els.addParcel.addEventListener('click', (e) => {
            e.preventDefault();
            addParcel();
        });
        els.reset.addEventListener('click', (e) => {
            e.preventDefault();
            state.parcels = [];
            els.results.innerHTML = '';
            resetForm();
            switchStep(1);
            els.pdf.disabled = true;
        });
        els.pdf.addEventListener('click', (e) => {
            e.preventDefault();
            sendPdf();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSelects();
        initMap();
        ensureOperationRow();
        initEvents();
    });
})();
