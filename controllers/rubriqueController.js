import { pool } from '../app.js';

export const getRubriques = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payroll_rubriques ORDER BY code ASC');
        res.render('rubriques/index', { 
            rubriques: result.rows,
            user: req.session.user 
        });
    } catch (err) {
        console.error('Erreur getRubriques:', err);
        res.status(500).send('Erreur lors du chargement des rubriques');
    }
};

export const getAddRubrique = (req, res) => {
    res.render('rubriques/add', { user: req.session.user });
};

export const postAddRubrique = async (req, res) => {
    const { code, libelle, type_rubrique, taux_salarie, taux_patronal } = req.body;
    try {
        await pool.query(
            `INSERT INTO payroll_rubriques (code, libelle, type_rubrique, taux_salarie, taux_patronal)
             VALUES ($1, $2, $3, $4, $5)`,
            [code, libelle, type_rubrique, taux_salarie || 0, taux_patronal || 0]
        );
        res.redirect('/rubriques');
    } catch (err) {
        console.error('Erreur postAddRubrique:', err);
        res.status(500).send("Erreur lors de l'ajout de la rubrique");
    }
};

export const getEditRubrique = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM payroll_rubriques WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.redirect('/rubriques');
        res.render('rubriques/edit', { 
            rubrique: result.rows[0],
            user: req.session.user 
        });
    } catch (err) {
        console.error('Erreur getEditRubrique:', err);
        res.status(500).send('Erreur serveur');
    }
};

export const postEditRubrique = async (req, res) => {
    const { id } = req.params;
    const { code, libelle, type_rubrique, taux_salarie, taux_patronal } = req.body;
    try {
        await pool.query(
            `UPDATE payroll_rubriques 
             SET code = $1, libelle = $2, type_rubrique = $3, taux_salarie = $4, taux_patronal = $5
             WHERE id = $6`,
            [code, libelle, type_rubrique, taux_salarie || 0, taux_patronal || 0, id]
        );
        res.redirect('/rubriques');
    } catch (err) {
        console.error('Erreur postEditRubrique:', err);
        res.status(500).send('Erreur lors de la modification');
    }
};

export const deleteRubrique = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM payroll_rubriques WHERE id = $1', [id]);
        res.redirect('/rubriques');
    } catch (err) {
        console.error('Erreur deleteRubrique:', err);
        res.status(500).send('Erreur lors de la suppression');
    }
};