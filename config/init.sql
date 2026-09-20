-- Table des employés
CREATE TABLE IF NOT EXISTS payroll_employees (
    id SERIAL PRIMARY KEY,
    matricule VARCHAR(20) UNIQUE NOT NULL,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50) NOT NULL,
    adresse TEXT,
    emploi VARCHAR(100),
    num_ss VARCHAR(30),
    date_entree DATE,
    section_atelier VARCHAR(20),
    horaire_mensuel NUMERIC(6,2) DEFAULT 173.33,
    salaire_de_base NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table du catalogue des rubriques
CREATE TABLE IF NOT EXISTS payroll_rubriques (
    id SERIAL PRIMARY KEY,
    code INT UNIQUE NOT NULL,
    libelle VARCHAR(100) NOT NULL,
    type_rubrique VARCHAR(20) CHECK (type_rubrique IN ('gain', 'retenue', 'patronale', 'totaux')),
    taux_salarie NUMERIC(5,3) DEFAULT 0.000,
    taux_patronal NUMERIC(5,3) DEFAULT 0.000
);

-- Table des bulletins de paie
CREATE TABLE IF NOT EXISTS payroll_bulletins (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES payroll_employees(id) ON DELETE CASCADE,
    periode_debut DATE NOT NULL,
    periode_fin DATE NOT NULL,
    date_paiement DATE NOT NULL,
    mode_paiement VARCHAR(30) DEFAULT 'Virement',
    salaire_poste NUMERIC(12,2) NOT NULL,
    salaire_imposable NUMERIC(12,2) NOT NULL,
    salaire_net_apres_impot NUMERIC(12,2) NOT NULL,
    net_a_payer NUMERIC(12,2) NOT NULL,
    cumul_brut NUMERIC(12,2) DEFAULT 0.00,
    cumul_imposable NUMERIC(12,2) DEFAULT 0.00,
    cumul_net NUMERIC(12,2) DEFAULT 0.00,
    cumul_cnas NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lignes détaillées du bulletin
CREATE TABLE IF NOT EXISTS payroll_bulletin_details (
    id SERIAL PRIMARY KEY,
    bulletin_id INT REFERENCES payroll_bulletins(id) ON DELETE CASCADE,
    rubrique_code INT REFERENCES payroll_rubriques(code),
    base_nombre NUMERIC(12,2),
    taux_employeur NUMERIC(5,3),
    charge_employeur NUMERIC(12,2),
    taux_salarie NUMERIC(5,3),
    retenue_salarie NUMERIC(12,2),
    gain NUMERIC(12,2)
);

-- Injection des rubriques standards (d'après votre modèle)
INSERT INTO payroll_rubriques (code, libelle, type_rubrique, taux_salarie, taux_patronal)
VALUES 
    (1600, 'SALAIRE DE BASE', 'gain', 0.000, 0.000),
    (1800, 'SALAIRE DE POSTE', 'totaux', 0.000, 0.000),
    (3000, 'COTISATION SECURITE SOCIALE', 'retenue', 9.000, 0.000),
    (3100, 'COTISATION SOCIALE PATRONALE', 'patronale', 0.000, 25.500),
    (3110, 'Fond de Logements', 'patronale', 0.000, 0.500),
    (3310, 'PRIME DE PANIER', 'gain', 0.000, 0.000),
    (3340, 'PRIME DE VOITURE', 'gain', 0.000, 0.000),
    (4000, 'SALAIRE IMPOSABLE', 'totaux', 0.000, 0.000),
    (5000, 'I.R.G.', 'retenue', 0.000, 0.000),
    (6000, 'SALAIRE APRES IMPOT', 'totaux', 0.000, 0.000)
ON CONFLICT (code) DO NOTHING;