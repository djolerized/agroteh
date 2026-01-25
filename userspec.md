SPECIFIKACIJA - FAZA 1: Korisnički Nalozi i Parcele

================================================================================
CILJ FAZE
================================================================================
Omogućiti korisnicima da:
1. Registruju/loguju se kroz WordPress
2. Čuvaju svoje parcele (naslov, geometrija, površina)
3. Vide listu svojih parcela
4. Brišu/edituju parcele
5. Pri kreiranju nove kalkulacije mogu da izaberu postojeću parcelu

================================================================================
1. BAZA PODATAKA
================================================================================

Kreiraj novu tabelu kroz plugin activation hook:

CREATE TABLE {$wpdb->prefix}agro_parcels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    geojson TEXT NOT NULL,
    area_ha DECIMAL(10,4) NOT NULL,
    cadastral_id VARCHAR(100) NULL,
    cadastral_municipality VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES {$wpdb->prefix}users(ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

NAPOMENA: 
- geojson - cela GeoJSON geometrija parcele
- area_ha - površina u hektarima
- cadastral_id - ako je parcela iz katastra, čuvamo ID
- cadastral_municipality - ime opštine ako je iz katastra

================================================================================
2. WORDPRESS USER SISTEM
================================================================================

Koristimo postojeći WordPress sistem:
- Login/Register: standardne WordPress stranice
- User ID: get_current_user_id()
- Provera da li je user logovan: is_user_logged_in()

Dodaj u plugin:
- Redirect na login page ako user nije logovan (za funkcionalnost parcela)
- User capability checks: current_user_can('read')

================================================================================
3. BACKEND - PHP API Endpoints
================================================================================

Dodaj WordPress REST API endpoints:

--------------------------------------------------------------------------------
3.1 Lista parcela trenutnog korisnika
--------------------------------------------------------------------------------
Endpoint: GET /wp-json/agro/v1/parcels
Response:
[
  {
    "id": 1,
    "name": "Parcela Kod Kuće",
    "area_ha": 2.5,
    "cadastral_id": "74514600064000",
    "created_at": "2025-01-20 10:30:00"
  }
]

--------------------------------------------------------------------------------
3.2 Detalji pojedinačne parcele
--------------------------------------------------------------------------------
Endpoint: GET /wp-json/agro/v1/parcels/{id}
Response:
{
  "id": 1,
  "name": "Parcela Kod Kuće",
  "geojson": { ... },
  "area_ha": 2.5,
  "cadastral_id": "74514600064000",
  "cadastral_municipality": "Lapovo"
}

--------------------------------------------------------------------------------
3.3 Kreiranje nove parcele
--------------------------------------------------------------------------------
Endpoint: POST /wp-json/agro/v1/parcels
Body:
{
  "name": "Nova Parcela",
  "geojson": { "type": "Polygon", "coordinates": [...] },
  "area_ha": 3.2,
  "cadastral_id": "...",
  "cadastral_municipality": "Lapovo"
}

--------------------------------------------------------------------------------
3.4 Brisanje parcele
--------------------------------------------------------------------------------
Endpoint: DELETE /wp-json/agro/v1/parcels/{id}
Validation: Proveri da je user_id == current_user_id

--------------------------------------------------------------------------------
3.5 Ažuriranje parcele
--------------------------------------------------------------------------------
Endpoint: PUT /wp-json/agro/v1/parcels/{id}

SECURITY:
- Svi endpoints zahtevaju is_user_logged_in()
- Provera ownership-a: parcel.user_id == get_current_user_id()

================================================================================
4. FRONTEND - UI Komponente
================================================================================

--------------------------------------------------------------------------------
4.1 Nova sekcija u pluginu: "Moje Parcele"
--------------------------------------------------------------------------------

Lokacija: Admin panel ili frontend page template

Prikaz:
┌─────────────────────────────────────┐
│ MOJE PARCELE                    [+] │
├─────────────────────────────────────┤
│ ☐ Parcela Kod Kuće (2.5 ha)   [✎][🗑] │
│ ☐ Livada Stara (1.8 ha)        [✎][🗑] │
│ ☐ Njiva Južna (4.2 ha)         [✎][🗑] │
└─────────────────────────────────────┘

Funkcionalnost:
- Lista svih parcela korisnika
- Dugme [+] za dodavanje nove
- Checkbox za odabir parcele (za korišćenje u kalkulaciji)
- [✎] Edit - otvara modal sa mapom
- [🗑] Delete - potvrda i brisanje

--------------------------------------------------------------------------------
4.2 Modal/Page za dodavanje parcele
--------------------------------------------------------------------------------

Sadržaj:
┌─────────────────────────────────────┐
│ DODAJ PARCELU                       │
├─────────────────────────────────────┤
│ Naziv: [_______________________]    │
│                                     │
│ Izaberi način:                      │
│ ○ Crtaj na mapi                     │
│ ○ Odaberi katastarsku parcelu       │
│                                     │
│ [Leaflet Mapa...]                   │
│                                     │
│ Površina: 2.5 ha (auto-izračunato) │
│                                     │
│ [Otkaži]              [Sačuvaj]    │
└─────────────────────────────────────┘

Integracija sa mapom:
- Koristi postojeći Leaflet kod
- Omogući crtanje ili odabir iz katastra
- Auto-kalkulacija površine
- Čuvanje GeoJSON geometrije

--------------------------------------------------------------------------------
4.3 Integracija u postojeću kalkulaciju
--------------------------------------------------------------------------------

U postojećem workflow-u za kalkulaciju:

Dodaj opciju pre/umesto crtanja:
┌─────────────────────────────────────┐
│ PARCELA                             │
├─────────────────────────────────────┤
│ ○ Koristi sačuvanu parcelu          │
│   [Dropdown: Odaberi...]            │
│                                     │
│ ○ Crtaj novu parcelu                │
│   [Mapa...]                         │
│                                     │
│ ○ Unesi površinu ručno              │
│   [___] ha                          │
└─────────────────────────────────────┘

Kada korisnik odabere sačuvanu parcelu:
- Učitaj geometriju na mapu
- Auto-popuni površinu
- Nastavi sa kalkulacijom

================================================================================
5. JAVASCRIPT - Frontend Logika
================================================================================

--------------------------------------------------------------------------------
5.1 Lista parcela
--------------------------------------------------------------------------------
// Učitaj parcele
fetch('/wp-json/agro/v1/parcels')
  .then(response => response.json())
  .then(parcels => renderParcelList(parcels));

// Obriši parcelu
function deleteParcel(id) {
  if (confirm('Da li ste sigurni?')) {
    fetch(`/wp-json/agro/v1/parcels/${id}`, { method: 'DELETE' })
      .then(() => location.reload());
  }
}

--------------------------------------------------------------------------------
5.2 Čuvanje nove parcele
--------------------------------------------------------------------------------
function saveParcel() {
  const data = {
    name: document.getElementById('parcel-name').value,
    geojson: drawnLayer.toGeoJSON(),
    area_ha: calculateArea(drawnLayer),
    cadastral_id: selectedCadastralId || null,
    cadastral_municipality: selectedMunicipality || null
  };
  
  fetch('/wp-json/agro/v1/parcels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(() => alert('Parcela sačuvana!'))
  .then(() => location.reload());
}

--------------------------------------------------------------------------------
5.3 Učitavanje sačuvane parcele u kalkulaciju
--------------------------------------------------------------------------------
function loadSavedParcel(parcelId) {
  fetch(`/wp-json/agro/v1/parcels/${parcelId}`)
    .then(response => response.json())
    .then(parcel => {
      // Prikaži na mapi
      const layer = L.geoJSON(parcel.geojson).addTo(map);
      map.fitBounds(layer.getBounds());
      
      // Popuni površinu
      document.getElementById('area-input').value = parcel.area_ha;
    });
}

================================================================================
6. UX FLOW - Korisničko iskustvo
================================================================================

Scenario 1: Prvi put korisnik
1. User se registruje/loguje
2. Kreira prvu parcelu (crta ili iz katastra)
3. Daje joj naziv "Moja Parcela"
4. Sačuva
5. Koristi je u kalkulaciji

Scenario 2: Postojeći korisnik
1. User otvara plugin
2. Vidi listu svojih parcela (3 komada)
3. Klika "Nova kalkulacija"
4. Bira "Parcela Kod Kuće" iz dropdown-a
5. Površina se auto-popuni
6. Nastavlja sa kalkulacijom

================================================================================
7. SIGURNOST & VALIDACIJA
================================================================================

Backend validacije:
- User mora biti logovan
- User može videti/editovati samo svoje parcele
- GeoJSON mora biti validan format
- Površina mora biti > 0
- Naziv ne sme biti prazan

Frontend validacije:
- Disable "Sačuvaj" dok nema geometrije
- Provera da je naziv unet
- Potvrda pre brisanja

================================================================================
8. DATABASE MIGRATION
================================================================================

Plugin activation hook:

register_activation_hook(__FILE__, 'agro_create_tables');

function agro_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE {$wpdb->prefix}agro_parcels (
        -- SQL iz sekcije 1
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

================================================================================
9. DELIVERABLES - Šta očekujem
================================================================================

Nakon implementacije:
1. Nova tabela u bazi
2. PHP fajl sa REST API endpoints
3. JavaScript fajl sa AJAX pozivima
4. HTML template za "Moje Parcele" stranicu
5. Integracija sa postojećom kalkulacijom
6. CSS stilovi

================================================================================
10. TESTIRANJE
================================================================================

Test cases:
1. Registruj novog usera → kreiraj parcelu → vidi u listi
2. Obriši parcelu → proveri da je nestala
3. Koristi sačuvanu parcelu u kalkulaciji → proveri da površina radi
4. Pokušaj da pristupiš tuđoj parceli direktno (security test)

================================================================================
NAPOMENE ZA CLAUDE CODE
================================================================================

- Koristi postojeću Leaflet mapu - ne pravi novu instancu
- WordPress nonces za AJAX security
- wp_enqueue_script/style za dodavanje JS/CSS
- Sanitize input sa sanitize_text_field(), wp_kses_post()
- Prepare SQL sa $wpdb->prepare()
- Dodaj error handling i user feedback (success/error poruke)

================================================================================
KRAJ SPECIFIKACIJE
================================================================================
