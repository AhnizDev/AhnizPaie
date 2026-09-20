import pool from '../config/db.js';

// Helper pour nettoyer les nombres (ex: "225531,85" -> 225531.85)
const parseNum = (val, defaultVal = 0) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    const cleaned = String(val).replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultVal : parsed;
};

// Helper pour transformer les chaînes vides en null pour PostgreSQL
const parseStr = (val) => {
    if (val === undefined || val === null) return null;
    const trimmed = String(val).trim();
    return trimmed === '' ? null : trimmed;
};

// Liste des salariés
export const getEmployees = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        res.render('employees/index', { employees: result.rows });
    } catch (err) {
        console.error("Erreur lors de la récupération des salariés :", err);
        res.status(500).send("Erreur serveur");
    }
};

// Fiche détaillée d'un salarié (Affichage)
export const getEmployeeDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).send("Salarié non trouvé");
        }

        res.render('employees/show', { employee: result.rows[0] });
    } catch (err) {
        console.error("Erreur lors de l'affichage de la fiche salarié :", err);
        res.status(500).send("Erreur serveur");
    }
};

// Formulaire d'ajout
export const getAddEmployeeForm = async (req, res) => {
    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM payroll_employees');
        const nextId = parseInt(countResult.rows[0].count) + 1;
        const nextMatricule = 'MAT-' + String(nextId).padStart(3, '0');

        res.render('employees/add', { nextMatricule });
    } catch (err) {
        console.error("Erreur lors de la préparation du formulaire :", err);
        res.status(500).send("Erreur serveur");
    }
};

// Création d'un salarié
export const createEmployee = async (req, res) => {
    try {
        const { 
            matricule, num_ss, nom, prenom, emploi, 
            section_atelier, salaire_de_base, horaire_mensuel, 
            date_entree, date_naissance, adresse,
            mode_paiement, compte_bancaire, swift, bank_id
        } = req.body;

        await pool.query(
            `INSERT INTO payroll_employees 
            (matricule, num_ss, nom, prenom, emploi, section_atelier, salaire_de_base, horaire_mensuel, date_entree, date_naissance, adresse, mode_paiement, compte_bancaire, swift, bank_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                parseStr(matricule), 
                parseStr(num_ss), 
                parseStr(nom), 
                parseStr(prenom), 
                parseStr(emploi), 
                parseStr(section_atelier), 
                parseNum(salaire_de_base, 0), 
                parseNum(horaire_mensuel, 173.33), 
                parseStr(date_entree), 
                parseStr(date_naissance), 
                parseStr(adresse),
                parseStr(mode_paiement) || 'Virement',
                parseStr(compte_bancaire),
                parseStr(swift),
                parseStr(bank_id)
            ]
        );

        res.redirect('/employees');
    } catch (err) {
        console.error("Erreur lors de l'enregistrement du salarié :", err);
        res.status(500).send("Erreur serveur lors de l'enregistrement");
    }
};

// Formulaire de modification
export const getEditEmployeeForm = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).send("Salarié non trouvé");
        }

        res.render('employees/edit', { employee: result.rows[0] });
    } catch (err) {
        console.error("Erreur lors de la récupération du salarié pour modification :", err);
        res.status(500).send("Erreur serveur");
    }
};

// Mise à jour d'un salarié
export const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            matricule, num_ss, nom, prenom, emploi, 
            section_atelier, salaire_de_base, horaire_mensuel, 
            date_entree, date_naissance, adresse,
            mode_paiement, compte_bancaire, swift, bank_id
        } = req.body;

        await pool.query(
            `UPDATE payroll_employees SET 
                matricule = $1, 
                num_ss = $2, 
                nom = $3, 
                prenom = $4, 
                emploi = $5, 
                section_atelier = $6, 
                salaire_de_base = $7, 
                horaire_mensuel = $8, 
                date_entree = $9, 
                date_naissance = $10, 
                adresse = $11,
                mode_paiement = $12, 
                compte_bancaire = $13, 
                swift = $14, 
                bank_id = $15
            WHERE id = $16`,
            [
                parseStr(matricule), 
                parseStr(num_ss), 
                parseStr(nom), 
                parseStr(prenom), 
                parseStr(emploi), 
                parseStr(section_atelier), 
                parseNum(salaire_de_base, 0), 
                parseNum(horaire_mensuel, 173.33), 
                parseStr(date_entree), 
                parseStr(date_naissance), 
                parseStr(adresse),
                parseStr(mode_paiement) || 'Virement',
                parseStr(compte_bancaire),
                parseStr(swift),
                parseStr(bank_id),
                id
            ]
        );

        res.redirect('/employees');
    } catch (err) {
        console.error("Erreur lors de la mise à jour du salarié :", err);
        res.status(500).send("Erreur serveur lors de la mise à jour");
    }
};

// Suppression d'un salarié
export const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM payroll_employees WHERE id = $1', [id]);
        res.redirect('/employees');
    } catch (err) {
        console.error("Erreur lors de la suppression du salarié :", err);
        res.status(500).send("Erreur serveur lors de la suppression");
    }
};