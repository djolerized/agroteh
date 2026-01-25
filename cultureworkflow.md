SPECIFIKACIJA - FAZA 2: Kulture i Agrotehničke Operacije

================================================================================
CILJ FAZE
================================================================================
Omogućiti korisnicima da:
1. Dodaju kulture (useve) na svoje parcele
2. Vide preporučeni workflow za svaku kulturu (priprema, setva, zaštita, žetva)
3. Unose agrotehničke operacije sa tačnim datumom izvršenja
4. Prate istoriju svih operacija na parceli
5. Dobiju pregled šta je urađeno i šta predstoji za svaku parcelu/kulturu

================================================================================
1. BAZA PODATAKA - Nove Tabele
================================================================================

--------------------------------------------------------------------------------
1.1 Tabela: wp_agro_parcel_crops (kulture na parcelama)
--------------------------------------------------------------------------------

CREATE TABLE {$wpdb->prefix}agro_parcel_crops (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parcel_id BIGINT UNSIGNED NOT NULL,
    crop_type VARCHAR(100) NOT NULL,
    season VARCHAR(20) NOT NULL,
    planting_date DATE NULL,
    expected_harvest_date DATE NULL,
    actual_harvest_date DATE NULL,
    status ENUM('active', 'harvested', 'archived') DEFAULT 'active',
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parcel_id (parcel_id),
    INDEX idx_status (status),
    FOREIGN KEY (parcel_id) REFERENCES {$wpdb->prefix}agro_parcels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

POLJA:
- parcel_id - na kojoj parceli je usev
- crop_type - tip useva (psenica, kukuruz, suncokret, itd.)
- season - sezona (npr. "2025/2026")
- planting_date - datum setve
- expected_harvest_date - planirani datum žetve
- actual_harvest_date - stvarni datum žetve (popunjava se kasnije)
- status - active (u toku), harvested (požnjeveno), archived (arhivirano)
- notes - dodatne beleške

--------------------------------------------------------------------------------
1.2 Tabela: wp_agro_operations (agrotehničke operacije)
--------------------------------------------------------------------------------

CREATE TABLE {$wpdb->prefix}agro_operations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parcel_crop_id BIGINT UNSIGNED NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    date_performed DATE NOT NULL,
    status ENUM('planned', 'completed', 'cancelled') DEFAULT 'planned',
    cost DECIMAL(10,2) NULL,
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parcel_crop_id (parcel_crop_id),
    INDEX idx_date_performed (date_performed),
    INDEX idx_status (status),
    FOREIGN KEY (parcel_crop_id) REFERENCES {$wpdb->prefix}agro_parcel_crops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

POLJA:
- parcel_crop_id - za koju kulturu/parcelu je operacija
- operation_type - tip (tillage, planting, fertilizing, herbicide, harvest, itd.)
- operation_name - naziv operacije (npr. "Osnovna obrada", "Setva ozime pšenice")
- date_performed - datum kada je operacija izvršena
- status - planned (planirana), completed (završena), cancelled (otkazana)
- cost - troškovi operacije (opciono)
- notes - beleške

--------------------------------------------------------------------------------
1.3 Tabela: wp_agro_crop_templates (šabloni/workflow-i za kulture)
--------------------------------------------------------------------------------

CREATE TABLE {$wpdb->prefix}agro_crop_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    crop_type VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    workflow_json TEXT NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    is_custom BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_crop_type (crop_type),
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_crop_user (crop_type, user_id),
    FOREIGN KEY (user_id) REFERENCES {$wpdb->prefix}users(ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

POLJA:
- crop_type - jedinstveni identifikator (npr. "wheat", "corn", "sunflower")
- display_name - prikazano ime na srpskom (npr. "Ozima pšenica")
- workflow_json - JSON sa preporučenim operacijama i vremenskim okvirima
- user_id - NULL za globalne (default) template-e, ID korisnika za custom template-e
- is_custom - TRUE ako je custom template korisnika, FALSE za globalne
- UNIQUE KEY (crop_type, user_id) - omogućava isti crop_type za različite korisnike

PRIMER workflow_json strukture:
{
  "operations": [
    {
      "type": "tillage",
      "name": "Osnovna obrada",
      "typical_month": 9,
      "duration_days": 7,
      "order": 1
    },
    {
      "type": "planting",
      "name": "Setva",
      "typical_month": 10,
      "duration_days": 14,
      "order": 2
    },
    {
      "type": "fertilizing",
      "name": "Prihrana u prolazu",
      "typical_month": 3,
      "duration_days": 7,
      "order": 3
    },
    {
      "type": "herbicide",
      "name": "Zaštita od korova",
      "typical_month": 4,
      "duration_days": 3,
      "order": 4
    },
    {
      "type": "harvest",
      "name": "Žetva",
      "typical_month": 6,
      "duration_days": 10,
      "order": 5
    }
  ]
}

================================================================================
2. INICIJALNI PODACI - Seed Templates
================================================================================

Tokom plugin activation-a, popuni tabelu crop_templates sa osnovnim kulturama.
OVO SU GLOBALNI TEMPLATE-I (user_id = NULL, is_custom = 0):

INSERT INTO {$wpdb->prefix}agro_crop_templates (crop_type, display_name, workflow_json, user_id, is_custom) VALUES

('wheat', 'Ozima pšenica', '{
  "operations": [
    {"type": "tillage", "name": "Osnovna obrada", "typical_month": 9, "duration_days": 7, "order": 1},
    {"type": "planting", "name": "Setva", "typical_month": 10, "duration_days": 14, "order": 2},
    {"type": "fertilizing", "name": "Prihrana", "typical_month": 3, "duration_days": 7, "order": 3},
    {"type": "herbicide", "name": "Zaštita", "typical_month": 4, "duration_days": 5, "order": 4},
    {"type": "harvest", "name": "Žetva", "typical_month": 6, "duration_days": 10, "order": 5}
  ]
}', NULL, 0),

('corn', 'Kukuruz', '{
  "operations": [
    {"type": "tillage", "name": "Osnovna obrada", "typical_month": 3, "duration_days": 7, "order": 1},
    {"type": "planting", "name": "Setva", "typical_month": 4, "duration_days": 10, "order": 2},
    {"type": "fertilizing", "name": "Prihrana", "typical_month": 5, "duration_days": 5, "order": 3},
    {"type": "herbicide", "name": "Zaštita", "typical_month": 5, "duration_days": 3, "order": 4},
    {"type": "harvest", "name": "Žetva", "typical_month": 9, "duration_days": 14, "order": 5}
  ]
}', NULL, 0),

('sunflower', 'Suncokret', '{
  "operations": [
    {"type": "tillage", "name": "Osnovna obrada", "typical_month": 3, "duration_days": 7, "order": 1},
    {"type": "planting", "name": "Setva", "typical_month": 4, "duration_days": 10, "order": 2},
    {"type": "herbicide", "name": "Zaštita", "typical_month": 5, "duration_days": 3, "order": 3},
    {"type": "harvest", "name": "Žetva", "typical_month": 9, "duration_days": 10, "order": 4}
  ]
}', NULL, 0),

('sugar_beet', 'Šećerna repa', '{
  "operations": [
    {"type": "tillage", "name": "Osnovna obrada", "typical_month": 10, "duration_days": 7, "order": 1},
    {"type": "planting", "name": "Setva", "typical_month": 3, "duration_days": 10, "order": 2},
    {"type": "fertilizing", "name": "Prihrana", "typical_month": 5, "duration_days": 5, "order": 3},
    {"type": "herbicide", "name": "Zaštita", "typical_month": 4, "duration_days": 5, "order": 4},
    {"type": "harvest", "name": "Vađenje", "typical_month": 10, "duration_days": 14, "order": 5}
  ]
}', NULL, 0),

('soybean', 'Soja', '{
  "operations": [
    {"type": "tillage", "name": "Osnovna obrada", "typical_month": 3, "duration_days": 7, "order": 1},
    {"type": "planting", "name": "Setva", "typical_month": 4, "duration_days": 10, "order": 2},
    {"type": "herbicide", "name": "Zaštita", "typical_month": 5, "duration_days": 3, "order": 3},
    {"type": "harvest", "name": "Žetva", "typical_month": 9, "duration_days": 10, "order": 4}
  ]
}', NULL, 0);

================================================================================
3. BACKEND - PHP API Endpoints
================================================================================

--------------------------------------------------------------------------------
3.1 Lista dostupnih kultura (templates)
--------------------------------------------------------------------------------
Endpoint: GET /wp-json/agro/v1/crops/templates
Query params (opciono): ?include_custom=true

Response (sa include_custom=true):
[
  {
    "id": 1,
    "crop_type": "wheat",
    "display_name": "Ozima pšenica",
    "workflow": { ... },
    "is_custom": false,
    "is_global": true
  },
  {
    "id": 8,
    "crop_type": "wheat_custom",
    "display_name": "Moja Pšenica NS-40S",
    "workflow": { ... },
    "is_custom": true,
    "is_global": false
  },
  {
    "id": 2,
    "crop_type": "corn",
    "display_name": "Kukuruz",
    "workflow": { ... },
    "is_custom": false,
    "is_global": true
  }
]

NAPOMENA: 
- Globalni template-i (user_id = NULL) su dostupni svima
- Custom template-i (user_id = current_user) samo za vlasnika
- Response vraća i globalne i custom template-e trenutnog korisnika

--------------------------------------------------------------------------------
3.1.1 Kreiranje custom workflow template-a
--------------------------------------------------------------------------------
Endpoint: POST /wp-json/agro/v1/crops/templates
Body:
{
  "crop_type": "wheat_custom_1",
  "display_name": "Moja Specijalna Pšenica",
  "workflow": {
    "operations": [
      {
        "type": "tillage",
        "name": "Duboka oranja",
        "typical_month": 8,
        "duration_days": 10,
        "order": 1
      },
      {
        "type": "planting",
        "name": "Setva sa đubrenjem",
        "typical_month": 10,
        "duration_days": 7,
        "order": 2
      }
    ]
  }
}

Response:
{
  "id": 15,
  "crop_type": "wheat_custom_1",
  "display_name": "Moja Specijalna Pšenica",
  "is_custom": true,
  "user_id": 5
}

VALIDACIJA:
- crop_type mora biti jedinstven za kombinaciju (crop_type, user_id)
- workflow mora imati bar 1 operaciju
- operations moraju imati type, name, typical_month, order

--------------------------------------------------------------------------------
3.1.2 Ažuriranje custom template-a
--------------------------------------------------------------------------------
Endpoint: PUT /wp-json/agro/v1/crops/templates/{id}
Body:
{
  "display_name": "Ažurirano Ime",
  "workflow": { ... }
}

SECURITY:
- Korisnik može editovati samo svoje custom template-e
- Globalni template-i ne mogu biti editovani preko API-ja

--------------------------------------------------------------------------------
3.1.3 Brisanje custom template-a
--------------------------------------------------------------------------------
Endpoint: DELETE /wp-json/agro/v1/crops/templates/{id}

SECURITY:
- Korisnik može obrisati samo svoje custom template-e
- Ne može obrisati globalne template-e

--------------------------------------------------------------------------------
3.1.4 Kopiranje postojećeg template-a
--------------------------------------------------------------------------------
Endpoint: POST /wp-json/agro/v1/crops/templates/{id}/clone
Body:
{
  "new_display_name": "Moja Kopija Pšenice"
}

Response:
{
  "id": 16,
  "crop_type": "wheat_clone_1",
  "display_name": "Moja Kopija Pšenice",
  "is_custom": true,
  "workflow": { ... } // kopirano iz originalnog
}

Korisnost: Korisnik može kopirati globalni ili svoj template i modifikovati ga

--------------------------------------------------------------------------------
3.2 Dodaj kulturu na parcelu
--------------------------------------------------------------------------------
Endpoint: POST /wp-json/agro/v1/crops
Body:
{
  "parcel_id": 5,
  "crop_type": "wheat",
  "season": "2025/2026",
  "planting_date": "2025-10-15",
  "expected_harvest_date": "2026-06-20",
  "notes": "Sorta NS 40S"
}

Response:
{
  "id": 12,
  "parcel_id": 5,
  "crop_type": "wheat",
  "season": "2025/2026",
  "status": "active"
}

--------------------------------------------------------------------------------
3.3 Lista kultura za korisnika (sve parcele)
--------------------------------------------------------------------------------
Endpoint: GET /wp-json/agro/v1/crops
Response:
[
  {
    "id": 12,
    "parcel_id": 5,
    "parcel_name": "Parcela Kod Kuće",
    "crop_type": "wheat",
    "crop_display_name": "Ozima pšenica",
    "season": "2025/2026",
    "planting_date": "2025-10-15",
    "status": "active"
  }
]

--------------------------------------------------------------------------------
3.4 Lista kultura za određenu parcelu
--------------------------------------------------------------------------------
Endpoint: GET /wp-json/agro/v1/parcels/{parcel_id}/crops
Response: (isti format kao 3.3)

--------------------------------------------------------------------------------
3.5 Ažuriraj kulturu (npr. promeni datum žetve)
--------------------------------------------------------------------------------
Endpoint: PUT /wp-json/agro/v1/crops/{id}
Body:
{
  "actual_harvest_date": "2026-06-25",
  "status": "harvested"
}

--------------------------------------------------------------------------------
3.6 Obriši kulturu
--------------------------------------------------------------------------------
Endpoint: DELETE /wp-json/agro/v1/crops/{id}
(Automatski briše sve povezane operacije zbog CASCADE)

--------------------------------------------------------------------------------
3.7 Dodaj operaciju
--------------------------------------------------------------------------------
Endpoint: POST /wp-json/agro/v1/operations
Body:
{
  "parcel_crop_id": 12,
  "operation_type": "planting",
  "operation_name": "Setva ozime pšenice",
  "date_performed": "2025-10-15",
  "status": "completed",
  "cost": 15000,
  "notes": "Setva obavljena u optimalnim uslovima"
}

Response:
{
  "id": 45,
  "parcel_crop_id": 12,
  "operation_type": "planting",
  "operation_name": "Setva ozime pšenice",
  "date_performed": "2025-10-15",
  "status": "completed"
}

--------------------------------------------------------------------------------
3.8 Lista operacija za kulturu
--------------------------------------------------------------------------------
Endpoint: GET /wp-json/agro/v1/crops/{crop_id}/operations
Response:
[
  {
    "id": 45,
    "operation_type": "planting",
    "operation_name": "Setva ozime pšenice",
    "date_performed": "2025-10-15",
    "status": "completed",
    "cost": 15000
  },
  {
    "id": 46,
    "operation_type": "herbicide",
    "operation_name": "Zaštita od korova",
    "date_performed": "2026-04-10",
    "status": "planned",
    "cost": null
  }
]

--------------------------------------------------------------------------------
3.9 Ažuriraj operaciju
--------------------------------------------------------------------------------
Endpoint: PUT /wp-json/agro/v1/operations/{id}
Body:
{
  "status": "completed",
  "date_performed": "2026-04-12",
  "cost": 8500
}

--------------------------------------------------------------------------------
3.10 Obriši operaciju
--------------------------------------------------------------------------------
Endpoint: DELETE /wp-json/agro/v1/operations/{id}

SECURITY (svi endpoints):
- Provera da je korisnik logovan
- Provera da korisnik poseduje parcelu (ownership check)

================================================================================
4. FRONTEND - UI Komponente
================================================================================

--------------------------------------------------------------------------------
4.1 Proširenje "Moje Parcele" sekcije
--------------------------------------------------------------------------------

Dodaj prikaz kultura za svaku parcelu:

┌─────────────────────────────────────────────────────────┐
│ MOJE PARCELE                                        [+] │
├─────────────────────────────────────────────────────────┤
│ Parcela Kod Kuće (2.5 ha)                    [✎][🗑]    │
│   └─ Ozima pšenica (2025/2026) - Aktivna      [👁][+]  │
│                                                          │
│ Livada Stara (1.8 ha)                         [✎][🗑]    │
│   └─ Kukuruz (2025) - Aktivna                 [👁][+]  │
│                                                          │
│ Njiva Južna (4.2 ha)                          [✎][🗑]    │
│   (Nema aktivnih kultura)                     [+ Dodaj] │
└─────────────────────────────────────────────────────────┘

[👁] = Prikaži operacije
[+] = Dodaj operaciju
[+ Dodaj] = Dodaj kulturu

--------------------------------------------------------------------------------
4.2 Modal/Page: Dodavanje kulture na parcelu
--------------------------------------------------------------------------------

┌─────────────────────────────────────────────────────────┐
│ DODAJ KULTURU NA PARCELU: Parcela Kod Kuće             │
├─────────────────────────────────────────────────────────┤
│ Kultura:                                                │
│ [Dropdown: Ozima pšenica ▼]                             │
│                                                          │
│ Sezona:                                                 │
│ [_______] (npr. 2025/2026)                              │
│                                                          │
│ Datum setve:                                            │
│ [_______] (date picker)                                 │
│                                                          │
│ Očekivani datum žetve:                                  │
│ [_______] (date picker)                                 │
│                                                          │
│ Beleške:                                                │
│ [_________________________________]                      │
│                                                          │
│ [Otkaži]              [Sačuvaj i Generiši Operacije]   │
└─────────────────────────────────────────────────────────┘

Kada korisnik klikne "Sačuvaj i Generiši Operacije":
1. Sačuva kulturu u bazu
2. Automatski kreira planirane operacije na osnovu workflow template-a
3. Prikaže ih u timeline-u

--------------------------------------------------------------------------------
4.4 UI: Kreiranje/Editovanje Custom Workflow Template-a
--------------------------------------------------------------------------------

NOVA SEKCIJA U ADMIN PANELU: "Moji Workflow-i" (pored "Moje Parcele")

┌─────────────────────────────────────────────────────────┐
│ MOJI WORKFLOW-I                                     [+] │
├─────────────────────────────────────────────────────────┤
│ 📋 GLOBALNI TEMPLATE-I (dostupno svima)                │
│   • Ozima pšenica (5 operacija)            [Kopiraj]   │
│   • Kukuruz (5 operacija)                  [Kopiraj]   │
│   • Suncokret (4 operacije)                [Kopiraj]   │
│   • Šećerna repa (5 operacija)             [Kopiraj]   │
│   • Soja (4 operacije)                     [Kopiraj]   │
│                                                          │
│ ✏️ MOJI CUSTOM TEMPLATE-I                               │
│   • Moja Pšenica NS-40S (6 operacija)      [✎][🗑]     │
│   • Kukuruz Hibrid (5 operacija)           [✎][🗑]     │
└─────────────────────────────────────────────────────────┘

Dugme [+] → Otvara Workflow Editor za kreiranje novog
[Kopiraj] → Kopira globalni template kao custom
[✎] → Otvara Workflow Editor za editovanje
[🗑] → Briše custom template (sa potvrdom)

--------------------------------------------------------------------------------
4.4.1 Modal: Workflow Editor
--------------------------------------------------------------------------------

┌─────────────────────────────────────────────────────────┐
│ KREIRAJ WORKFLOW ZA KULTURU                             │
├─────────────────────────────────────────────────────────┤
│ Naziv kulture:                                          │
│ [_______________________________________]               │
│                                                          │
│ OPERACIJE:                              [+ Dodaj]       │
│                                                          │
│ ┌───────────────────────────────────────────┐           │
│ │ 1. ⋮ Osnovna obrada              [✎][🗑] │           │
│ │    Tip: Obrada zemljišta                  │           │
│ │    Mesec: Septembar                       │           │
│ │    Trajanje: 7 dana                       │           │
│ └───────────────────────────────────────────┘           │
│                                                          │
│ ┌───────────────────────────────────────────┐           │
│ │ 2. ⋮ Setva                       [✎][🗑] │           │
│ │    Tip: Setva                             │           │
│ │    Mesec: Oktobar                         │           │
│ │    Trajanje: 14 dana                      │           │
│ └───────────────────────────────────────────┘           │
│                                                          │
│ ┌───────────────────────────────────────────┐           │
│ │ 3. ⋮ Prihrana                    [✎][🗑] │           │
│ │    Tip: Đubrenje                          │           │
│ │    Mesec: Mart                            │           │
│ │    Trajanje: 5 dana                       │           │
│ └───────────────────────────────────────────┘           │
│                                                          │
│ [Otkaži]                    [Sačuvaj Template]         │
└─────────────────────────────────────────────────────────┘

FUNKCIONALNOST:
- ⋮ = Drag handle za reorder (drag & drop)
- [✎] = Edituj operaciju (otvara mini-modal)
- [🗑] = Obriši operaciju
- [+ Dodaj] = Dodaj novu operaciju

--------------------------------------------------------------------------------
4.4.2 Mini-Modal: Dodaj/Edituj Operaciju u Workflow-u
--------------------------------------------------------------------------------

┌─────────────────────────────────────────────────────────┐
│ OPERACIJA                                               │
├─────────────────────────────────────────────────────────┤
│ Naziv operacije:                                        │
│ [_______________________________________]               │
│                                                          │
│ Tip operacije:                                          │
│ [Dropdown: Obrada zemljišta ▼]                          │
│   Options:                                              │
│   - Obrada zemljišta (tillage)                          │
│   - Setva (planting)                                    │
│   - Đubrenje (fertilizing)                              │
│   - Zaštita herbicidima (herbicide)                     │
│   - Zaštita fungicidima (fungicide)                     │
│   - Zaštita insekticidima (insecticide)                 │
│   - Žetva (harvest)                                     │
│   - Ostalo (other)                                      │
│                                                          │
│ Tipični mesec izvršenja:                                │
│ [Dropdown: Septembar ▼]                                 │
│                                                          │
│ Trajanje (dana):                                        │
│ [____] dana                                             │
│                                                          │
│ [Otkaži]                            [Sačuvaj]          │
└─────────────────────────────────────────────────────────┘

--------------------------------------------------------------------------------
4.4.3 Integracija u "Dodaj Kulturu"
--------------------------------------------------------------------------------

IZMENA U MODALU IZ SEKCIJE 4.2:

┌─────────────────────────────────────────────────────────┐
│ DODAJ KULTURU NA PARCELU: Parcela Kod Kuće             │
├─────────────────────────────────────────────────────────┤
│ Kultura:                                                │
│ [Dropdown sa grupisanim opcijama:]                      │
│                                                          │
│   📋 Globalni template-i                                │
│      • Ozima pšenica                                    │
│      • Kukuruz                                          │
│      • Suncokret                                        │
│                                                          │
│   ✏️ Moji template-i                                    │
│      • Moja Pšenica NS-40S                              │
│      • Kukuruz Hibrid                                   │
│                                                          │
│   [+ Kreiraj novi workflow]                             │
│                                                          │
│ Sezona:                                                 │
│ [_______] (npr. 2025/2026)                              │
│                                                          │
│ ... (ostalo isto)                                       │
└─────────────────────────────────────────────────────────┘

--------------------------------------------------------------------------------
4.5 Prikaz operacija za kulturu (Timeline/Calendar view)
--------------------------------------------------------------------------------

┌─────────────────────────────────────────────────────────┐
│ OPERACIJE: Ozima pšenica (Parcela Kod Kuće)        [+] │
├─────────────────────────────────────────────────────────┤
│ ✓ Sep 2025 - Osnovna obrada (Završeno)            [✎]  │
│   Datum: 15.09.2025                                     │
│   Troškovi: 12,000 RSD                                  │
│                                                          │
│ ✓ Okt 2025 - Setva (Završeno)                     [✎]  │
│   Datum: 10.10.2025                                     │
│   Troškovi: 15,000 RSD                                  │
│                                                          │
│ ⏱ Mar 2026 - Prihrana (Planirano)                  [✎]  │
│   Planirano: ~15.03.2026                                │
│   [Označi kao Završeno]                                 │
│                                                          │
│ ⏱ Apr 2026 - Zaštita (Planirano)                   [✎]  │
│   Planirano: ~10.04.2026                                │
│                                                          │
│ ⏱ Jun 2026 - Žetva (Planirano)                     [✎]  │
│   Planirano: ~20.06.2026                                │
└─────────────────────────────────────────────────────────┘

Dugme [+] - Dodaj dodatnu operaciju (van workflow-a)

--------------------------------------------------------------------------------
4.6 Modal: Dodavanje/Editovanje operacije
--------------------------------------------------------------------------------

┌─────────────────────────────────────────────────────────┐
│ DODAJ OPERACIJU                                         │
├─────────────────────────────────────────────────────────┤
│ Naziv operacije:                                        │
│ [_______________________________________]               │
│                                                          │
│ Tip operacije:                                          │
│ [Dropdown: Setva ▼]                                     │
│                                                          │
│ Datum izvršenja:                                        │
│ [_______] (date picker)                                 │
│                                                          │
│ Status:                                                 │
│ ○ Planirano  ● Završeno  ○ Otkazano                    │
│                                                          │
│ Troškovi (opciono):                                     │
│ [_______] RSD                                           │
│                                                          │
│ Beleške:                                                │
│ [_________________________________]                      │
│                                                          │
│ [Otkaži]                            [Sačuvaj]          │
└─────────────────────────────────────────────────────────┘

================================================================================
5. JAVASCRIPT - Frontend Logika
================================================================================

--------------------------------------------------------------------------------
5.1 Učitavanje kultura za parcelu
--------------------------------------------------------------------------------
function loadCropsForParcel(parcelId) {
  fetch(`/wp-json/agro/v1/parcels/${parcelId}/crops`)
    .then(response => response.json())
    .then(crops => renderCropsList(crops));
}

--------------------------------------------------------------------------------
5.2 Dodavanje kulture
--------------------------------------------------------------------------------
function addCrop() {
  const data = {
    parcel_id: currentParcelId,
    crop_type: document.getElementById('crop-type').value,
    season: document.getElementById('season').value,
    planting_date: document.getElementById('planting-date').value,
    expected_harvest_date: document.getElementById('harvest-date').value,
    notes: document.getElementById('notes').value
  };
  
  fetch('/wp-json/agro/v1/crops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(crop => {
    // Auto-generiši operacije na osnovu template-a
    generateOperationsFromTemplate(crop.id, data.crop_type);
  });
}

--------------------------------------------------------------------------------
5.3 Auto-generisanje operacija iz template-a
--------------------------------------------------------------------------------
function generateOperationsFromTemplate(cropId, cropType) {
  // Učitaj template
  fetch(`/wp-json/agro/v1/crops/templates`)
    .then(response => response.json())
    .then(templates => {
      const template = templates.find(t => t.crop_type === cropType);
      const workflow = JSON.parse(template.workflow_json);
      
      // Kreiraj operacije
      workflow.operations.forEach(op => {
        const data = {
          parcel_crop_id: cropId,
          operation_type: op.type,
          operation_name: op.name,
          date_performed: calculateDate(op.typical_month), // Izračunaj datum
          status: 'planned'
        };
        
        fetch('/wp-json/agro/v1/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      });
    });
}

--------------------------------------------------------------------------------
5.4 Prikaz timeline-a operacija
--------------------------------------------------------------------------------
function renderOperationsTimeline(cropId) {
  fetch(`/wp-json/agro/v1/crops/${cropId}/operations`)
    .then(response => response.json())
    .then(operations => {
      // Sortiranje po datumu
      operations.sort((a, b) => new Date(a.date_performed) - new Date(b.date_performed));
      
      // Render timeline sa ikonama (✓ za completed, ⏱ za planned)
      const html = operations.map(op => `
        <div class="operation-item ${op.status}">
          <span class="icon">${op.status === 'completed' ? '✓' : '⏱'}</span>
          <span class="date">${formatDate(op.date_performed)}</span>
          <span class="name">${op.operation_name}</span>
          <button onclick="editOperation(${op.id})">✎</button>
        </div>
      `).join('');
      
      document.getElementById('timeline').innerHTML = html;
    });
}

--------------------------------------------------------------------------------
5.5 Označavanje operacije kao završene
--------------------------------------------------------------------------------
function markOperationCompleted(operationId) {
  const today = new Date().toISOString().split('T')[0];
  
  fetch(`/wp-json/agro/v1/operations/${operationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'completed',
      date_performed: today
    })
  })
  .then(() => location.reload());
}

--------------------------------------------------------------------------------
5.6 CRUD za Custom Workflow Template-e
--------------------------------------------------------------------------------

// Učitaj sve template-e (globalne + custom trenutnog korisnika)
function loadAllTemplates() {
  fetch('/wp-json/agro/v1/crops/templates?include_custom=true')
    .then(response => response.json())
    .then(templates => {
      const global = templates.filter(t => !t.is_custom);
      const custom = templates.filter(t => t.is_custom);
      
      renderTemplatesList(global, custom);
    });
}

// Kreiranje novog custom template-a
function createCustomTemplate() {
  const operations = [];
  
  // Prikupi sve operacije iz editora
  document.querySelectorAll('.workflow-operation').forEach((opEl, index) => {
    operations.push({
      type: opEl.dataset.type,
      name: opEl.querySelector('.op-name').value,
      typical_month: parseInt(opEl.querySelector('.op-month').value),
      duration_days: parseInt(opEl.querySelector('.op-duration').value),
      order: index + 1
    });
  });
  
  const data = {
    crop_type: generateUniqueCropType(), // npr. "custom_wheat_1234"
    display_name: document.getElementById('template-name').value,
    workflow: {
      operations: operations
    }
  };
  
  fetch('/wp-json/agro/v1/crops/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(template => {
    alert('Workflow sačuvan!');
    location.reload();
  });
}

// Editovanje postojećeg custom template-a
function updateCustomTemplate(templateId) {
  const operations = collectOperationsFromEditor(); // isto kao gore
  
  const data = {
    display_name: document.getElementById('template-name').value,
    workflow: {
      operations: operations
    }
  };
  
  fetch(`/wp-json/agro/v1/crops/templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(() => {
    alert('Workflow ažuriran!');
    location.reload();
  });
}

// Brisanje custom template-a
function deleteCustomTemplate(templateId) {
  if (!confirm('Da li ste sigurni da želite da obrišete ovaj workflow?')) {
    return;
  }
  
  fetch(`/wp-json/agro/v1/crops/templates/${templateId}`, {
    method: 'DELETE'
  })
  .then(() => {
    alert('Workflow obrisan!');
    location.reload();
  });
}

// Kopiranje template-a (globalnog ili custom)
function cloneTemplate(templateId) {
  const newName = prompt('Unesite naziv za kopiju:');
  if (!newName) return;
  
  fetch(`/wp-json/agro/v1/crops/templates/${templateId}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_display_name: newName
    })
  })
  .then(response => response.json())
  .then(newTemplate => {
    alert('Template kopiran! Možete ga sada editovati.');
    openWorkflowEditor(newTemplate.id);
  });
}

--------------------------------------------------------------------------------
5.7 Workflow Editor - Drag & Drop za Reorder
--------------------------------------------------------------------------------

// Omogući drag & drop za promenu redosleda operacija
function initializeDragAndDrop() {
  const container = document.getElementById('operations-list');
  
  // Koristi SortableJS ili HTML5 Drag & Drop API
  new Sortable(container, {
    animation: 150,
    handle: '.drag-handle', // ⋮ ikonica
    onEnd: function(evt) {
      // Ažuriraj 'order' vrednost za sve operacije
      updateOperationOrder();
    }
  });
}

function updateOperationOrder() {
  document.querySelectorAll('.workflow-operation').forEach((opEl, index) => {
    opEl.dataset.order = index + 1;
  });
}

// Dodavanje nove operacije u editor
function addOperationToWorkflow() {
  const operationHtml = `
    <div class="workflow-operation" data-order="${getNextOrder()}">
      <span class="drag-handle">⋮</span>
      <input type="text" class="op-name" placeholder="Naziv operacije">
      <select class="op-type">
        <option value="tillage">Obrada zemljišta</option>
        <option value="planting">Setva</option>
        <option value="fertilizing">Đubrenje</option>
        <option value="herbicide">Zaštita herbicidima</option>
        <option value="harvest">Žetva</option>
      </select>
      <select class="op-month">
        <option value="1">Januar</option>
        <option value="2">Februar</option>
        ...
        <option value="12">Decembar</option>
      </select>
      <input type="number" class="op-duration" placeholder="Trajanje (dana)">
      <button onclick="removeOperation(this)">🗑</button>
    </div>
  `;
  
  document.getElementById('operations-list').insertAdjacentHTML('beforeend', operationHtml);
  initializeDragAndDrop(); // Re-initialize
}

function removeOperation(button) {
  button.closest('.workflow-operation').remove();
  updateOperationOrder();
}

function getNextOrder() {
  return document.querySelectorAll('.workflow-operation').length + 1;
}

--------------------------------------------------------------------------------
5.8 Generisanje Unique Crop Type za Custom Template
--------------------------------------------------------------------------------

function generateUniqueCropType() {
  // Generiši jedinstveni crop_type za custom template
  // Format: custom_<base>_<timestamp>
  const baseName = document.getElementById('template-name').value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 20);
  
  const timestamp = Date.now();
  return `custom_${baseName}_${timestamp}`;
}

================================================================================
6. UX FLOW - Korisničko iskustvo
================================================================================

--------------------------------------------------------------------------------
Scenario 1: Korisnik dodaje pšenicu sa globalnim template-om
--------------------------------------------------------------------------------

1. User otvara "Moje Parcele"
2. Vidi svoju parcelu "Njiva Kod Puta (3.2 ha)"
3. Klikne [+ Dodaj kulturu]
4. Bira "Ozima pšenica" iz dropdown-a (globalni template)
5. Unosi sezonu "2025/2026"
6. Unosi datum setve: 15.10.2025
7. Klikne "Sačuvaj i Generiši Operacije"
8. Sistem automatski kreira 5 planiranih operacija:
   - Osnovna obrada (~Sep 2025) - Planirano
   - Setva (15.10.2025) - Završeno
   - Prihrana (~Mar 2026) - Planirano
   - Zaštita (~Apr 2026) - Planirano
   - Žetva (~Jun 2026) - Planirano
9. User vidi timeline sa svim operacijama
10. Kada izvrši operaciju, klikne "Označi kao Završeno"
11. Unese stvarni datum i troškove

--------------------------------------------------------------------------------
Scenario 2: Korisnik kreira custom workflow
--------------------------------------------------------------------------------

1. User otvara "Moji Workflow-i"
2. Vidi listu globalnih template-a
3. Klikne [Kopiraj] na "Ozima pšenica"
4. Unosi novi naziv: "Moja Pšenica NS-40S"
5. Otvara se Workflow Editor sa kopiranim operacijama
6. User dodaje dodatnu operaciju: "Folijarna prihrana" (Maj)
7. Drag & drop-uje je između "Prihrana" i "Zaštita"
8. Menja trajanje "Osnovna obrada" sa 7 na 10 dana
9. Klikne "Sačuvaj Template"
10. Sada može da koristi ovaj custom template za svoje parcele
11. Idi na "Moje Parcele" → [+ Dodaj kulturu]
12. U dropdown-u vidi sekciju "Moji template-i"
13. Bira "Moja Pšenica NS-40S"
14. Unosi ostale podatke i generiše operacije (sada 6 umesto 5)

--------------------------------------------------------------------------------
Scenario 3: Korisnik kreira potpuno novi workflow
--------------------------------------------------------------------------------

1. User otvara "Moji Workflow-i"
2. Klikne [+ Kreiraj novi]
3. Unosi naziv: "Moj Hibridni Kukuruz"
4. Klikne [+ Dodaj operaciju]
5. Dodaje prvu operaciju:
   - Naziv: "Duboka oranja"
   - Tip: Obrada zemljišta
   - Mesec: Mart
   - Trajanje: 5 dana
6. Dodaje drugu operaciju:
   - Naziv: "Setva sa startnim đubrivom"
   - Tip: Setva
   - Mesec: April
   - Trajanje: 7 dana
7. Nastavlja sa ostalim operacijama
8. Klikne "Sačuvaj Template"
9. Sada može da koristi ovaj workflow za svoje parcele kukuruza

================================================================================
7. BUSINESS LOGIKA
================================================================================

--------------------------------------------------------------------------------
7.1 Kalkulacija tipičnih datuma operacija
--------------------------------------------------------------------------------
Ako korisnik unese datum setve (npr. 15.10.2025):
- Osnovna obrada = datum_setve - 30 dana = ~15.09.2025
- Prihrana = datum_setve + 150 dana (5 meseci) = ~15.03.2026
- Zaštita = datum_setve + 180 dana = ~15.04.2026
- Žetva = datum_setve + 240 dana (8 meseci) = ~15.06.2026

(Ovo se može prilagoditi na osnovu workflow template-a)

--------------------------------------------------------------------------------
7.2 Validacije
--------------------------------------------------------------------------------
- Ne dozvoli dodavanje dve aktivne kulture iste sezone na istu parcelu
- Datum žetve mora biti posle datuma setve
- Operacije moraju biti u logičkom redosledu (setva pre žetve)

DODATNE VALIDACIJE ZA CUSTOM WORKFLOW-E:
- crop_type mora biti jedinstven za kombinaciju (crop_type, user_id)
- display_name ne sme biti prazan
- workflow mora imati bar 1 operaciju
- Svaka operacija mora imati: type, name, typical_month (1-12), duration_days (>0), order
- order vrednosti moraju biti uzastopne (1, 2, 3, ...)
- Ne može se obrisati custom template ako se koristi u nekim aktivnim kulturama
- Korisnik može editovati/brisati samo svoje custom template-e

================================================================================
8. DELIVERABLES
================================================================================

1. 3 nove tabele u bazi (parcels_crops, operations, crop_templates)
2. Seed data za 5 osnovnih kultura (globalni template-i)
3. PHP REST API endpoints:
   - 10 osnovnih endpoints (kulture i operacije)
   - 4 dodatna endpoints za custom workflow template-e (CRUD + clone)
4. JavaScript logika:
   - CRUD operacije za kulture i operacije
   - CRUD operacije za custom workflow template-e
   - Drag & Drop za reorder operacija u workflow editoru
   - Auto-generisanje operacija iz template-a
5. UI komponente:
   - Lista kultura po parcelama
   - Modal za dodavanje kulture
   - Timeline prikaz operacija
   - Modal za dodavanje/editovanje operacije
   - **NOVO: "Moji Workflow-i" sekcija**
   - **NOVO: Workflow Editor sa drag & drop**
   - **NOVO: Mini-modal za operacije u editoru**
6. CSS stilovi:
   - Timeline prikaz
   - Drag & drop interfejs
   - Grupisani dropdown (globalni vs custom template-i)
7. Auto-generisanje operacija iz template-a
8. **NOVO: Funkcionalnost kloniranja template-a**
9. **NOVO: SortableJS ili sličan za drag & drop** (ili custom implementacija)

================================================================================
9. TESTIRANJE
================================================================================

Test cases:

OSNOVNE FUNKCIONALNOSTI:
1. Dodaj pšenicu na parcelu → proveri da se kreiraju operacije
2. Označi operaciju kao završenu → proveri status update
3. Obriši kulturu → proveri da se brišu i operacije (CASCADE)
4. Pokušaj dodati 2 kulture iste sezone na istu parcelu → očekuj validaciju
5. Dodaj custom operaciju van template-a → proveri da radi

CUSTOM WORKFLOW TEMPLATE-I:
6. Kreiraj novi custom workflow → proveri da se sačuva u bazi
7. Edituj custom workflow (dodaj/ukloni operaciju) → proveri izmene
8. Obriši custom workflow → proveri da nestane iz liste
9. Kopiraj globalni template → proveri da se kreira custom kopija
10. Pokušaj editovati globalni template → očekuj grešku (security)
11. Drag & drop operacije u editoru → proveri da se redosled menja
12. Kreiraj kulturu sa custom template-om → proveri da generiše operacije
13. Obriši custom template koji se koristi → očekuj upozorenje ili sprečavanje
14. Dva korisnika kreiraju template sa istim crop_type → proveri da oba rade (različiti user_id)
15. User pokušaj da obriše tuđi custom template → očekuj security grešku

================================================================================
NAPOMENE ZA CLAUDE CODE
================================================================================

- Koristi dbDelta() za kreiranje tabela (WordPress best practice)
- JSON encode/decode za workflow_json polja
- Date validation sa PHP DateTime klasa
- WordPress nonces za sve AJAX zahteve
- Proper error handling i user feedback
- Timeline UI može biti jednostavna lista, ne mora fancy vizuelizacija
- Omogući export operacija u CSV (bonus)

DODATNE NAPOMENE ZA CUSTOM WORKFLOW:
- Za drag & drop može se koristiti SortableJS library ili HTML5 Drag & Drop API
- Alternative SortableJS: https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js
- crop_type za custom template-e treba biti jedinstven - generiši sa timestamp-om
- Grupisani dropdown (optgroup) za globalnu vs custom template-e u HTML
- Implementiraj check da li se custom template koristi pre brisanja
- Workflow Editor može biti modal ili full page - po želji
- Razmisli o konfirmaciji pre brisanja operacije u editoru
- UNIQUE constraint (crop_type, user_id) omogućava istim crop_type za različite user-e

================================================================================
KRAJ SPECIFIKACIJE - FAZA 2 (SA CUSTOM WORKFLOW FUNKCIONALNOSTIMA)
================================================================================
