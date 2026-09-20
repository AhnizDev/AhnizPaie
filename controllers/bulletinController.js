import db from '../config/db.js';

// --- FONCTION INTERNE DE CALCUL DE PAIE ---
const calculerPaieEmploye = async (employeeId, periode) => {
    // 1. Données de l'employé
    const empRes = await db.query('SELECT * FROM payroll_employees WHERE id = $1', [employeeId]);
    const employee = empRes.rows[0];
    if (!employee) throw new Error('Employé introuvable');

    // 2. Absences
    const pointageRes = await db.query(
        'SELECT absences FROM payroll_pointages WHERE employee_id = $1 AND periode = $2',
        [employeeId, periode]
    );
    const absences = pointageRes.rows[0] ? pointageRes.rows[0].absences : 0;

    // 3. Montants saisis dans payroll_pointage_details
    const detailsRes = await db.query(
        'SELECT rubrique_id, valeur FROM payroll_pointage_details WHERE employee_id = $1 AND periode = $2',
        [employeeId, periode]
    );
    const pointageMap = {};
    detailsRes.rows.forEach(d => {
        pointageMap[d.rubrique_id] = parseFloat(d.valeur) || 0;
    });

    // 4. Rubriques actives
    const rubriquesRes = await db.query('SELECT * FROM payroll_rubriques ORDER BY code ASC');
    const rubriques = rubriquesRes.rows;

    let salaireBase = parseFloat(employee.salaire_base) || 0;
    let totalGains = salaireBase;
    let totalRetenues = 0;
    let baseCotisable = salaireBase;
    let baseImposable = 0;

    const lignes = [{
        rubrique_id: null,
        code: '0010',
        libelle: 'Salaire de Base',
        base: salaireBase,
        taux: 0,
        montant: salaireBase,
        type: 'gain'
    }];

    // 5. Calcul dynamique
    for (const r of rubriques) {
        let montant = 0;
        let base = baseCotisable;
        const valeurSaisie = pointageMap[r.id] !== undefined ? pointageMap[r.id] : (parseFloat(r.valeur_defaut) || 0);

        if (parseFloat(r.taux_salarie) > 0) {
            montant = (base * parseFloat(r.taux_salarie)) / 100;
        } else {
            montant = valeurSaisie;
            base = valeurSaisie;
        }

        if (montant <= 0) continue;

        const typeLower = (r.type_rubrique || '').toLowerCase();

        if (typeLower === 'gain') {
            totalGains += montant;
            if (r.is_cotisable) baseCotisable += montant;
        } else if (typeLower === 'retenue') {
            totalRetenues += montant;
        }

        lignes.push({
            rubrique_id: r.id,
            code: r.code,
            libelle: r.libelle,
            base: base,
            taux: parseFloat(r.taux_salarie) || 0,
            montant: montant,
            type: typeLower
        });
    }

    baseImposable = baseCotisable - totalRetenues;
    const netAPayer = totalGains - totalRetenues;

    return { employee, periode, salaireBase, baseCotisable, baseImposable, totalGains, totalRetenues, netAPayer, lignes };
};

// --- GET /bulletins (Liste par période) ---
export const getBulletins = async (req, res) => {
    try {
        const periode = req.query.periode || '2026-09';
        const bulletinsRes = await db.query(`
            SELECT b.*, e.matricule, e.nom, e.prenom, e.fonction
            FROM payroll_bulletins b
            JOIN payroll_employees e ON e.id = b.employee_id
            WHERE b.periode = $1
            ORDER BY e.matricule ASC
        `, [periode]);

        res.render('bulletins/index', {
            bulletins: bulletinsRes.rows,
            periode
        });
    } catch (err) {
        console.error('Erreur getBulletins:', err);
        res.status(500).send('Erreur lors de la récupération des bulletins');
    }
};

// --- GET /bulletins/voir/:id (Affichage fiche bulletin) ---
export const getBulletinById = async (req, res) => {
    try {
        const { id } = req.params;

        const bulletinRes = await db.query(`
            SELECT b.*, e.matricule, e.nom, e.prenom, e.fonction, e.date_embauche, e.num_cnas
            FROM payroll_bulletins b
            JOIN payroll_employees e ON e.id = b.employee_id
            WHERE b.id = $1
        `, [id]);

        if (bulletinRes.rows.length === 0) {
            return res.status(404).send('Bulletin introuvable');
        }

        const bulletin = bulletinRes.rows[0];

        const lignesRes = await db.query(`
            SELECT * FROM payroll_bulletin_lignes 
            WHERE bulletin_id = $1 
            ORDER BY code ASC
        `, [id]);

        res.render('bulletins/voir', {
            bulletin,
            lignes: lignesRes.rows
        });
    } catch (err) {
        console.error('Erreur getBulletinById:', err);
        res.status(500).send('Erreur lors du chargement du bulletin');
    }
};

// --- POST /bulletins/generate (Génération / Calcul individuel) ---
export const genererBulletin = async (req, res) => {
    const client = await db.getClient();
    try {
        const { employee_id, periode } = req.body;

        const calcul = await calculerPaieEmploye(employee_id, periode);

        await client.query('BEGIN');

        // Enregistrement entête
        const bulletinRes = await client.query(`
            INSERT INTO payroll_bulletins 
                (employee_id, periode, salaire_base, base_cotisable, total_gains, total_retenues, net_a_payer)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (employee_id, periode) 
            DO UPDATE SET 
                salaire_base = EXCLUDED.salaire_base,
                base_cotisable = EXCLUDED.base_cotisable,
                total_gains = EXCLUDED.total_gains,
                total_retenues = EXCLUDED.total_retenues,
                net_a_payer = EXCLUDED.net_a_payer
            RETURNING id
        `, [
            employee_id,
            periode,
            calcul.salaireBase,
            calcul.baseCotisable,
            calcul.totalGains,
            calcul.totalRetenues,
            calcul.netAPayer
        ]);

        const bulletinId = bulletinRes.rows[0].id;

        // Purge et réinsertion des lignes
        await client.query('DELETE FROM payroll_bulletin_lignes WHERE bulletin_id = $1', [bulletinId]);

        for (const ligne of calcul.lignes) {
            await client.query(`
                INSERT INTO payroll_bulletin_lignes 
                    (bulletin_id, rubrique_id, code, libelle, base, taux, montant, type_rubrique)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                bulletinId,
                ligne.rubrique_id,
                ligne.code,
                ligne.libelle,
                ligne.base,
                ligne.taux,
                ligne.montant,
                ligne.type
            ]);
        }

        await client.query('COMMIT');
        res.redirect(`/bulletins/voir/${bulletinId}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur génération bulletin:', err);
        res.status(500).send('Erreur serveur lors du calcul de la paie');
    } finally {
        client.release();
    }
};

// --- POST /bulletins/generate-all (Génération / Calcul global) ---
export const genererTousBulletins = async (req, res) => {
    const client = await db.getClient();
    try {
        const { periode } = req.body;

        const empRes = await client.query('SELECT id FROM payroll_employees');
        const employees = empRes.rows;

        await client.query('BEGIN');

        for (const emp of employees) {
            const calcul = await calculerPaieEmploye(emp.id, periode);

            const bulletinRes = await client.query(`
                INSERT INTO payroll_bulletins 
                    (employee_id, periode, salaire_base, base_cotisable, total_gains, total_retenues, net_a_payer)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (employee_id, periode) 
                DO UPDATE SET 
                    salaire_base = EXCLUDED.salaire_base,
                    base_cotisable = EXCLUDED.base_cotisable,
                    total_gains = EXCLUDED.total_gains,
                    total_retenues = EXCLUDED.total_retenues,
                    net_a_payer = EXCLUDED.net_a_payer
                RETURNING id
            `, [
                emp.id,
                periode,
                calcul.salaireBase,
                calcul.baseCotisable,
                calcul.totalGains,
                calcul.totalRetenues,
                calcul.netAPayer
            ]);

            const bulletinId = bulletinRes.rows[0].id;

            await client.query('DELETE FROM payroll_bulletin_lignes WHERE bulletin_id = $1', [bulletinId]);

            for (const ligne of calcul.lignes) {
                await client.query(`
                    INSERT INTO payroll_bulletin_lignes 
                        (bulletin_id, rubrique_id, code, libelle, base, taux, montant, type_rubrique)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    bulletinId,
                    ligne.rubrique_id,
                    ligne.code,
                    ligne.libelle,
                    ligne.base,
                    ligne.taux,
                    ligne.montant,
                    ligne.type
                ]);
            }
        }

        await client.query('COMMIT');
        res.redirect(`/bulletins?periode=${periode}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur genererTousBulletins:', err);
        res.status(500).send('Erreur serveur lors du calcul global de la paie');
    } finally {
        client.release();
    }
};