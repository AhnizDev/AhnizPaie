import express from 'express';
import { pool } from '../app.js';

const router = express.Router();

/**
 * GET /bulletins / GET /bulletins/index
 * Liste des bulletins de paie
 */
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payroll_employees ORDER BY nom ASC');
        
        res.render('payroll/index', {
            title: 'Gestion des Bulletins',
            employees: result.rows,
            totalBrut: '0,00',
            totalNet: '0,00'
        });
    } catch (err) {
        console.error('Erreur SQL Bulletins :', err);
        res.status(500).send('Erreur lors du chargement des bulletins.');
    }
});

/**
 * GET /bulletins/:id
 * Consultation / Impression d'un bulletin individuel
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).send('Employé non trouvé.');
        }

        res.render('payroll/bulletin', {
            title: 'Bulletin de Paie',
            employee: result.rows[0]
        });
    } catch (err) {
        console.error('Erreur SQL Bulletin individuel :', err);
        res.status(500).send('Erreur serveur.');
    }
});

export default router;