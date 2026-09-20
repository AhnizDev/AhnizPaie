import { pool } from '../app.js';
import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
import { COMPANY_CONFIG } from '../config/company.js';

const MOIS_NOMS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function parsePeriodeToDate(periodeStr) {
    if (!periodeStr) return new Date();
    const parts = periodeStr.trim().split(' ');
    if (parts.length < 2) return new Date();
    const moisIndex = MOIS_NOMS.indexOf(parts[0]);
    const annee = parseInt(parts[1], 10);
    if (moisIndex === -1 || isNaN(annee)) return new Date();
    return new Date(annee, moisIndex, 1);
}

function formatDateToPeriode(date) {
    return `${MOIS_NOMS[date.getMonth()]} ${date.getFullYear()}`;
}

function calculerIRG(imposable) {
    if (imposable <= 30000) return 0;
    let irgBrut = 0;
    if (imposable > 30000 && imposable <= 38000) {
        irgBrut = (imposable - 30000) * 0.23;
    } else if (imposable > 38000 && imposable <= 120000) {
        irgBrut = 1840 + (imposable - 38000) * 0.27;
    } else if (imposable > 120000 && imposable <= 380000) {
        irgBrut = 24000 + (imposable - 120000) * 0.30;
    } else if (imposable > 380000) {
        irgBrut = 102000 + (imposable - 380000) * 0.35;
    }

    let abattement = irgBrut * 0.40;
    if (abattement < 1000) abattement = 1000;
    if (abattement > 1500) abattement = 1500;

    let irgNet = irgBrut - abattement;
    if (imposable > 30000 && imposable <= 35000) {
        irgNet = irgNet * (8 / 3) - (20000 / 3);
    }
    return irgNet > 0 ? Math.round(irgNet * 100) / 100 : 0;
}

function calculerSoldeConges(dateEmbaucheRaw, congesPris = 0, reliquatAnterieur = 0) {
    if (!dateEmbaucheRaw) return 0;
    const dateEmbauche = new Date(dateEmbaucheRaw);
    if (isNaN(dateEmbauche.getTime())) return 0;

    const maintenant = new Date();
    
    const diffTime = maintenant - dateEmbauche;
    const diffDays = Math.max(0, diffTime / (1000 * 60 * 60 * 24));
    const moisCumules = diffDays / 30.4375;

    const droitsAcquis = moisCumules * 2.5;
    const soldeTotal = parseFloat(reliquatAnterieur || 0) + droitsAcquis - parseFloat(congesPris || 0);

    return Math.max(0, Math.round(soldeTotal * 100) / 100);
}

const formatNum = (num) => {
    return Number(num || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function getPeriodeActive(req) {
    if (!req.session || !req.session.periodeActive) {
        if (req.session) req.session.periodeActive = formatDateToPeriode(new Date());
        return formatDateToPeriode(new Date());
    }
    return req.session.periodeActive;
}

// 0. Dashboard
export const getDashboard = async (req, res) => {
    const periodeActive = getPeriodeActive(req);
    try {
        const parts = periodeActive.split(' ');
        const moisNum = MOIS_NOMS.indexOf(parts[0]) + 1;
        const anneeNum = parseInt(parts[1], 10);

        const bulletinsRes = await pool.query(
            'SELECT * FROM payroll_bulletins WHERE mois = $1 AND annee = $2',
            [moisNum, anneeNum]
        );

        let totalBrut = 0;
        let totalNet = 0;
        let totalEmployees = 0;

        if (bulletinsRes.rows.length > 0) {
            totalEmployees = bulletinsRes.rows.length;
            bulletinsRes.rows.forEach(b => {
                totalBrut += parseFloat(b.brut_cnas || b.salaire_base_calcule || 0);
                totalNet += parseFloat(b.net_a_payer || 0);
            });
        } else {
            const result = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
            totalEmployees = result.rows.length;
            result.rows.forEach(emp => {
                const salaireBase = parseFloat(emp.salaire_de_base || emp.salaire_base || 0);
                const primePanier = 4400;
                const primeVehicule = parseFloat(emp.prime_vehicule ?? 0);
                const brut = salaireBase + primePanier + primeVehicule;
                const cnas = salaireBase * 0.09;
                const imposable = salaireBase - cnas + primePanier + primeVehicule;
                const irg = calculerIRG(imposable);
                const mutuelle = parseFloat(emp.cotisation_mutuelle || 1020.83);
                const net = brut - (cnas + irg + mutuelle);

                totalBrut += brut;
                totalNet += net;
            });
        }

        res.render('dashboard', {
            totalEmployees,
            totalBrut: formatNum(totalBrut),
            totalNet: formatNum(totalNet),
            periodeActive,
            user: req.session?.user
        });
    } catch (err) {
        console.error('Erreur Dashboard :', err);
        res.render('dashboard', { totalEmployees: 0, totalBrut: '0,00', totalNet: '0,00', periodeActive, user: req.session?.user });
    }
};

// 1. Index Paie
export const getPayrollIndex = async (req, res) => {
    const periodeActive = getPeriodeActive(req);
    try {
        const parts = periodeActive.split(' ');
        const moisNum = MOIS_NOMS.indexOf(parts[0]) + 1;
        const anneeNum = parseInt(parts[1], 10);

        const bulletinsRes = await pool.query(
            'SELECT * FROM payroll_bulletins WHERE mois = $1 AND annee = $2',
            [moisNum, anneeNum]
        );
        const bulletinsMap = new Map();
        bulletinsRes.rows.forEach(b => bulletinsMap.set(Number(b.employee_id), b));

        const result = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        let totalBrut = 0;
        let totalNet = 0;

        const employees = result.rows.map(emp => {
            const activeBul = bulletinsMap.get(Number(emp.id));

            let brut, net, imposable;
            if (activeBul) {
                brut = parseFloat(activeBul.brut_cnas || 0);
                imposable = parseFloat(activeBul.net_imposable || 0);
                net = parseFloat(activeBul.net_a_payer || 0);
            } else {
                const salaireBase = parseFloat(emp.salaire_de_base || emp.salaire_base || 0);
                const primePanier = 4400;
                const primeVehicule = parseFloat(emp.prime_vehicule ?? 0);
                brut = salaireBase + primePanier + primeVehicule;
                const cnas = salaireBase * 0.09;
                imposable = salaireBase - cnas + primePanier + primeVehicule;
                const irg = calculerIRG(imposable);
                const mutuelle = parseFloat(emp.cotisation_mutuelle || 1020.83);
                net = brut - (cnas + irg + mutuelle);
            }

            totalBrut += brut;
            totalNet += net;

            return {
                ...emp,
                net_a_payer: net,
                salaire_imposable: imposable,
                total_brut: brut
            };
        });

        res.render('payroll/index', {
            employees,
            totalBrut: formatNum(totalBrut),
            totalNet: formatNum(totalNet),
            periodeActive,
            user: req.session?.user
        });
    } catch (err) {
        console.error('Erreur Payroll Index :', err);
        res.render('payroll/index', { employees: [], totalBrut: '0,00', totalNet: '0,00', periodeActive, user: req.session?.user });
    }
};

// 2. Pointage Page
export const getPointagePage = async (req, res) => {
    try {
        let periodeActive = getPeriodeActive(req);

        if (req.query.mois && req.query.annee) {
            const moisIdx = parseInt(req.query.mois, 10) - 1;
            const anneeNum = parseInt(req.query.annee, 10);
            if (moisIdx >= 0 && moisIdx < 12 && !isNaN(anneeNum)) {
                periodeActive = `${MOIS_NOMS[moisIdx]} ${anneeNum}`;
                req.session.periodeActive = periodeActive;
            }
        }

        const parts = periodeActive.split(' ');
        const selectedMois = MOIS_NOMS.indexOf(parts[0]) + 1;
        const selectedAnnee = parseInt(parts[1], 10);

        const checkClose = await pool.query(
            'SELECT 1 FROM payroll_bulletins_history WHERE periode = $1 LIMIT 1',
            [periodeActive]
        );
        const estCloturee = checkClose.rows.length > 0;

        const result = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        res.render('payroll/pointage', {
            employees: result.rows,
            periodeActive,
            selectedMois,
            selectedAnnee,
            estCloturee,
            user: req.session?.user
        });
    } catch (err) {
        console.error('Erreur Pointage :', err);
        res.render('payroll/pointage', { 
            employees: [], 
            periodeActive: getPeriodeActive(req), 
            selectedMois: 10, 
            selectedAnnee: 2026, 
            estCloturee: false, 
            user: req.session?.user 
        });
    }
};

// 3. Save Pointage
export const savePointageAndCalculate = async (req, res) => {
    const { pointage } = req.body;
    const periodeActive = getPeriodeActive(req);
    const parts = periodeActive.split(' ');
    const moisNum = MOIS_NOMS.indexOf(parts[0]) + 1;
    const anneeNum = parseInt(parts[1], 10);

    const dateDebut = `${anneeNum}-${String(moisNum).padStart(2, '0')}-01`;
    const lastDay = new Date(anneeNum, moisNum, 0).getDate();
    const dateFin = `${anneeNum}-${String(moisNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const employeesRes = await client.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        if (pointage) {
            let index = 0;
            for (const key in pointage) {
                const data = pointage[key];
                const emp = employeesRes.rows[index++];
                if (!emp) continue;

                const rawJoursPanier = data.joursPanier !== undefined ? data.joursPanier : (data.jours_panier !== undefined ? data.jours_panier : null);
                const panierDays = (rawJoursPanier !== null && rawJoursPanier !== '' && !isNaN(Number(rawJoursPanier))) ? Number(rawJoursPanier) : 22;

                const rawBaseDays = data.joursTravailles !== undefined ? data.joursTravailles : (data.jours_travailles !== undefined ? data.jours_travailles : null);
                const baseDays = (rawBaseDays !== null && rawBaseDays !== '' && !isNaN(Number(rawBaseDays))) ? Number(rawBaseDays) : 30;

                const salaireBaseContractuel = parseFloat(emp.salaire_de_base || emp.salaire_base || 0);
                const gainBase = (salaireBaseContractuel / 30) * baseDays;

                const primePanier = panierDays * 200; 
                const primeVehicule = parseFloat(data.primeVehicule || data.prime_vehicule || emp.prime_vehicule || 0);
                const cotisationMutuelle = parseFloat(data.cotisationMutuelle || data.cotisation_mutuelle || emp.cotisation_mutuelle || 1020.83);

                const cnasSalarie = gainBase * 0.09;
                const cnasPatronale = gainBase * 0.26;
                const salaireImposable = gainBase - cnasSalarie + primePanier + primeVehicule;
                const irg = calculerIRG(salaireImposable);

                const totalBrut = gainBase + primePanier + primeVehicule;
                const totalRetenues = cnasSalarie + irg + cotisationMutuelle;
                const netAPayer = totalBrut - totalRetenues;

                const dateEntreeVal = emp.date_entree || emp.date_embauche;
                const soldeCongesCalcul = calculerSoldeConges(dateEntreeVal, emp.conges_pris || 0, emp.reliquat_conges || 0);

                await client.query(
                    `UPDATE payroll_employees 
                     SET cnas_salarie = $1, cnas_patronale = $2, salaire_imposable = $3, irg = $4, net_a_payer = $5, prime_vehicule = $6, cotisation_mutuelle = $7, solde_conges = $8
                     WHERE id = $9`,
                    [cnasSalarie, cnasPatronale, salaireImposable, irg, netAPayer, primeVehicule, cotisationMutuelle, soldeCongesCalcul, emp.id]
                );

                const detailsJson = {
                    payroll: {
                        salaireBase: salaireBaseContractuel,
                        baseDays,
                        panierDays,
                        primePanier,
                        primeVehicule,
                        cotisationMutuelle,
                        cnasSalarial: cnasSalarie,
                        cnasPatronale,
                        assietteIrg: salaireImposable,
                        irg,
                        totalBrut,
                        totalRetenues,
                        netAPayer,
                        soldeConges: soldeCongesCalcul,
                        period: periodeActive,
                        issuedAt: new Date().toLocaleDateString('fr-FR')
                    },
                    employee: {
                        id: emp.id,
                        matricule: emp.matricule || `EMP-00${emp.id}`,
                        nom: emp.nom || '',
                        prenom: emp.prenom || '',
                        cnasSecu: emp.num_ss || '-',
                        fonction: emp.fonction || emp.emploi || 'Employé(e)',
                        dateEmbauche: dateEntreeVal ? new Date(dateEntreeVal).toLocaleDateString('fr-FR') : '-',
                        situationFamiliale: emp.situation_familiale || 'Marié(e)',
                        nombreEnfants: emp.nombre_enfants ?? 0,
                        accountNumber: emp.compte_bancaire || '-'
                    },
                    company: {
                        name: `EURL ${COMPANY_CONFIG.name}`,
                        address: COMPANY_CONFIG.address,
                        postalCode: COMPANY_CONFIG.postalCode,
                        city: COMPANY_CONFIG.city,
                        country: COMPANY_CONFIG.country,
                        phone: COMPANY_CONFIG.phone,
                        cnasNumber: COMPANY_CONFIG.cnasNo,
                        rc: COMPANY_CONFIG.rc,
                        nif: COMPANY_CONFIG.nif
                    }
                };

                await client.query(`
                    INSERT INTO public.payroll_bulletins (
                        employee_id, mois, annee, periode_libelle, date_debut, date_fin, date_paiement, mode_paiement,
                        salaire_base_calcule, brut_cnas, cnas_salarie_9, cnas_patronale_25_5,
                        prime_panier, prime_vehicule, net_imposable, irg_retenu, net_a_payer,
                        details_json
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8,
                        $9, $10, $11, $12,
                        $13, $14, $15, $16, $17,
                        $18
                    )
                    ON CONFLICT (employee_id, mois, annee) 
                    DO UPDATE SET
                        periode_libelle = EXCLUDED.periode_libelle,
                        date_debut = EXCLUDED.date_debut,
                        date_fin = EXCLUDED.date_fin,
                        salaire_base_calcule = EXCLUDED.salaire_base_calcule,
                        brut_cnas = EXCLUDED.brut_cnas,
                        cnas_salarie_9 = EXCLUDED.cnas_salarie_9,
                        cnas_patronale_25_5 = EXCLUDED.cnas_patronale_25_5,
                        prime_panier = EXCLUDED.prime_panier,
                        prime_vehicule = EXCLUDED.prime_vehicule,
                        net_imposable = EXCLUDED.net_imposable,
                        irg_retenu = EXCLUDED.irg_retenu,
                        net_a_payer = EXCLUDED.net_a_payer,
                        details_json = EXCLUDED.details_json;
                `, [
                    emp.id, moisNum, anneeNum, periodeActive, dateDebut, dateFin, dateFin, 'VIREMENT',
                    gainBase, totalBrut, cnasSalarie, cnasPatronale,
                    primePanier, primeVehicule, salaireImposable, irg, netAPayer,
                    JSON.stringify(detailsJson)
                ]);
            }
        }
        await client.query('COMMIT');
        res.redirect('/payroll');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur Calcul et Persistance :', err);
        res.status(500).send("Erreur : " + err.message);
    } finally {
        client.release();
    }
};

// 4. Bulletin Page
export const getBulletinPage = async (req, res) => {
    const empId = req.params.id || 1;
    const periodeActive = getPeriodeActive(req);
    const parts = periodeActive.split(' ');
    const moisNum = MOIS_NOMS.indexOf(parts[0]) + 1;
    const anneeNum = parseInt(parts[1], 10);

    const company = {
        name: `EURL ${COMPANY_CONFIG.name}`,
        address: COMPANY_CONFIG.address,
        postalCode: COMPANY_CONFIG.postalCode,
        city: COMPANY_CONFIG.city,
        country: COMPANY_CONFIG.country,
        phone: COMPANY_CONFIG.phone,
        cnasNumber: COMPANY_CONFIG.cnasNo,
        rc: COMPANY_CONFIG.rc,
        nif: COMPANY_CONFIG.nif
    };

    try {
        const bulRes = await pool.query(
            'SELECT * FROM payroll_bulletins WHERE employee_id = $1 AND mois = $2 AND annee = $3',
            [empId, moisNum, anneeNum]
        );

        if (bulRes.rows.length > 0 && bulRes.rows[0].details_json) {
            const details = typeof bulRes.rows[0].details_json === 'string'
                ? JSON.parse(bulRes.rows[0].details_json)
                : bulRes.rows[0].details_json;

            const empMainRes = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [empId]);
            const dbEmp = empMainRes.rows[0];
            if (dbEmp) {
                const dateEntreeVal = dbEmp.date_entree || dbEmp.date_embauche;
                details.payroll.soldeConges = calculerSoldeConges(dateEntreeVal, dbEmp.conges_pris || 0, dbEmp.reliquat_conges || 0);
            }

            return res.render('payroll/bulletin', {
                company,
                employee: details.employee,
                payroll: details.payroll,
                periodeActive,
                user: req.session?.user
            });
        }

        const empMainRes = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [empId]);
        const dbEmp = empMainRes.rows[0];
        if (!dbEmp) return res.status(404).send("Employé non trouvé");

        const dateEntreeVal = dbEmp.date_entree || dbEmp.date_embauche;

        const employee = {
            matricule: dbEmp.matricule || `EMP-00${empId}`,
            nom: dbEmp.nom || '',
            prenom: dbEmp.prenom || '',
            cnasSecu: dbEmp.num_ss || '-',
            fonction: dbEmp.fonction || dbEmp.emploi || 'Employé(e)',
            dateEmbauche: dateEntreeVal ? new Date(dateEntreeVal).toLocaleDateString('fr-FR') : '-',
            situationFamiliale: dbEmp.situation_familiale || 'Marié(e)',
            nombreEnfants: dbEmp.nombre_enfants ?? 0,
            accountNumber: dbEmp.compte_bancaire || '-'
        };

        const salaireBase = parseFloat(dbEmp.salaire_de_base || dbEmp.salaire_base || 0);
        const primePanier = 4400;
        const primeVehicule = parseFloat(dbEmp.prime_vehicule ?? 0);
        const cnasSalarial = salaireBase * 0.09;
        const imposable = salaireBase - cnasSalarial + primePanier + primeVehicule;
        const irg = calculerIRG(imposable);
        const cotisationMutuelle = parseFloat(dbEmp.cotisation_mutuelle || 1020.83);

        const totalBrut = salaireBase + primePanier + primeVehicule;
        const totalRetenues = cnasSalarial + irg + cotisationMutuelle;
        const netAPayer = totalBrut - totalRetenues;

        const soldeCongesCalcul = calculerSoldeConges(dateEntreeVal, dbEmp.conges_pris || 0, dbEmp.reliquat_conges || 0);

        const payroll = {
            period: periodeActive,
            issuedAt: new Date().toLocaleDateString('fr-FR'),
            paymentMethod: "Virement bancaire",
            baseDays: 30,
            salaireBase: salaireBase,
            primePanier: primePanier,
            panierDays: 22,
            primeVehicule: primeVehicule,
            cnasSalarial: cnasSalarial,
            assietteIrg: imposable,
            irg: irg,
            cotisationMutuelle: cotisationMutuelle,
            totalBrut: totalBrut,
            totalRetenues: totalRetenues,
            netAPayer: netAPayer,
            cumulImposable: imposable * 9,
            cumulCnas: cnasSalarial * 9,
            soldeConges: soldeCongesCalcul,
            cnasPatronale: salaireBase * 0.26,
            totalCoutEmployeur: totalBrut + (salaireBase * 0.26)
        };

        res.render('payroll/bulletin', { company, employee, payroll, periodeActive, user: req.session?.user });
    } catch (err) {
        console.error('Erreur Bulletin :', err);
        res.redirect('/payroll');
    }
};

// 5. Clôture du Mois
export const cloturerMois = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentPeriod = getPeriodeActive(req);
        const parts = currentPeriod.split(' ');
        const moisNum = MOIS_NOMS.indexOf(parts[0]) + 1;
        const anneeNum = parseInt(parts[1], 10);

        const bulletinsRes = await client.query(
            'SELECT * FROM public.payroll_bulletins WHERE mois = $1 AND annee = $2',
            [moisNum, anneeNum]
        );

        const empResult = await client.query('SELECT * FROM payroll_employees ORDER BY id ASC');

        for (const emp of empResult.rows) {
            const activeBul = bulletinsRes.rows.find(b => Number(b.employee_id) === Number(emp.id));

            let detailsObj = {};
            if (activeBul && activeBul.details_json) {
                detailsObj = typeof activeBul.details_json === 'string' ? JSON.parse(activeBul.details_json) : activeBul.details_json;
            }

            const p = detailsObj.payroll || {};
            const e = detailsObj.employee || emp;

            const salaireBase = p.salaireBase !== undefined ? p.salaireBase : parseFloat(emp.salaire_de_base || 0);
            const primePanier = p.primePanier !== undefined ? p.primePanier : 4400;
            const primeVehicule = p.primeVehicule !== undefined ? p.primeVehicule : parseFloat(emp.prime_vehicule ?? 0);
            const totalBrut = p.totalBrut !== undefined ? p.totalBrut : (salaireBase + primePanier + primeVehicule);
            const cnas = p.cnasSalarial !== undefined ? p.cnasSalarial : (salaireBase * 0.09);
            const imposable = p.assietteIrg !== undefined ? p.assietteIrg : (totalBrut - cnas);
            const irg = p.irg !== undefined ? p.irg : calculerIRG(imposable);
            const mutuelle = p.cotisationMutuelle !== undefined ? p.cotisationMutuelle : parseFloat(emp.cotisation_mutuelle || 1020.83);
            const net = p.netAPayer !== undefined ? p.netAPayer : (totalBrut - (cnas + irg + mutuelle));

            const dateEntreeVal = emp.date_entree || emp.date_embauche;
            const soldeCongesCalcul = calculerSoldeConges(dateEntreeVal, emp.conges_pris || 0, emp.reliquat_conges || 0);

            const snapshotData = {
                company: {
                    name: `EURL ${COMPANY_CONFIG.name}`,
                    address: COMPANY_CONFIG.address,
                    postalCode: COMPANY_CONFIG.postalCode,
                    city: COMPANY_CONFIG.city,
                    country: COMPANY_CONFIG.country,
                    phone: COMPANY_CONFIG.phone,
                    cnasNumber: COMPANY_CONFIG.cnasNo,
                    rc: COMPANY_CONFIG.rc,
                    nif: COMPANY_CONFIG.nif
                },
                employee: {
                    id: emp.id,
                    matricule: emp.matricule || e.matricule || `EMP-00${emp.id}`,
                    nom: emp.nom || e.nom || '',
                    prenom: emp.prenom || e.prenom || '',
                    cnasSecu: emp.num_ss || e.cnasSecu || '-',
                    fonction: emp.fonction || emp.emploi || e.fonction || 'Employé(e)',
                    dateEmbauche: emp.date_entree ? new Date(emp.date_entree).toLocaleDateString('fr-FR') : (e.dateEmbauche || '-'),
                    situationFamiliale: emp.situation_familiale || e.situationFamiliale || 'Marié(e)',
                    nombreEnfants: emp.nombre_enfants ?? e.nombreEnfants ?? 0,
                    accountNumber: emp.compte_bancaire || e.accountNumber || '-'
                },
                payroll: {
                    period: currentPeriod,
                    issuedAt: new Date().toLocaleDateString('fr-FR'),
                    paymentMethod: "Virement bancaire",
                    baseDays: p.baseDays !== undefined ? p.baseDays : 30,
                    panierDays: p.panierDays !== undefined ? p.panierDays : 22,
                    salaireBase: salaireBase,
                    primePanier: primePanier,
                    primeVehicule: primeVehicule,
                    cnasSalarial: cnas,
                    assietteIrg: imposable,
                    irg: irg,
                    cotisationMutuelle: mutuelle,
                    totalBrut: totalBrut,
                    totalRetenues: cnas + irg + mutuelle,
                    netAPayer: net,
                    cumulImposable: imposable,
                    cumulCnas: cnas,
                    soldeConges: soldeCongesCalcul,
                    cnasPatronale: salaireBase * 0.26,
                    totalCoutEmployeur: totalBrut + (salaireBase * 0.26)
                },
                calculs: { imposable, cnas, irg, net }
            };

            await client.query(
                `INSERT INTO public.payroll_bulletins_history 
                 (employee_id, periode, mois, annee, salaire_base, salaire_imposable, cnas_salarie, irg, net_a_payer, details_json)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (employee_id, periode) 
                 DO UPDATE SET 
                    mois = EXCLUDED.mois,
                    annee = EXCLUDED.annee,
                    salaire_base = EXCLUDED.salaire_base, 
                    salaire_imposable = EXCLUDED.salaire_imposable, 
                    cnas_salarie = EXCLUDED.cnas_salarie, 
                    irg = EXCLUDED.irg, 
                    net_a_payer = EXCLUDED.net_a_payer, 
                    details_json = EXCLUDED.details_json`,
                [emp.id, currentPeriod, moisNum, anneeNum, salaireBase, imposable, cnas, irg, net, JSON.stringify(snapshotData)]
            );
        }

        await client.query('DELETE FROM public.payroll_bulletins WHERE mois = $1 AND annee = $2', [moisNum, anneeNum]);

        const currentDate = parsePeriodeToDate(currentPeriod);
        currentDate.setMonth(currentDate.getMonth() + 1);
        req.session.periodeActive = formatDateToPeriode(currentDate);

        await client.query('UPDATE payroll_employees SET absences = 0, conge_jours_mois = 0, prime_vehicule = 0');
        await client.query('COMMIT');
        res.redirect('/payroll');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur clôture :', err);
        res.status(500).send("Erreur clôture : " + err.message);
    } finally {
        client.release();
    }
};

// 6. PDF Bulletin
export const downloadBulletinPDF = async (req, res) => {
    const empId = req.params.id;
    const periodeQuery = req.query.periode;
    const periodeActive = periodeQuery || getPeriodeActive(req);
    const parts = periodeActive.split(' ');
    const moisNum = MOIS_NOMS.indexOf(parts[0]) + 1;
    const anneeNum = parseInt(parts[1], 10);

    try {
        let details = null;

        if (periodeQuery) {
            const historyRes = await pool.query(
                'SELECT details_json FROM payroll_bulletins_history WHERE employee_id = $1 AND periode = $2',
                [empId, periodeQuery]
            );
            if (historyRes.rows.length > 0 && historyRes.rows[0].details_json) {
                details = typeof historyRes.rows[0].details_json === 'string'
                    ? JSON.parse(historyRes.rows[0].details_json)
                    : historyRes.rows[0].details_json;
            }
        }

        if (!details) {
            const bulRes = await pool.query(
                'SELECT details_json FROM payroll_bulletins WHERE employee_id = $1 AND mois = $2 AND annee = $3',
                [empId, moisNum, anneeNum]
            );
            if (bulRes.rows.length > 0 && bulRes.rows[0].details_json) {
                details = typeof bulRes.rows[0].details_json === 'string'
                    ? JSON.parse(bulRes.rows[0].details_json)
                    : bulRes.rows[0].details_json;
            }
        }

        const empRes = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [empId]);
        const dbEmp = empRes.rows[0];

        if (!details) {
            if (!dbEmp) return res.status(404).send("Employé introuvable");

            const dateEntreeVal = dbEmp.date_entree || dbEmp.date_embauche;
            const salaireBase = parseFloat(dbEmp.salaire_de_base || 0);
            const primePanier = 4400;
            const primeVehicule = parseFloat(dbEmp.prime_vehicule ?? 0);
            const totalBrut = salaireBase + primePanier + primeVehicule;
            const cnas = salaireBase * 0.09;
            const imposable = salaireBase - cnas + primePanier + primeVehicule;
            const irg = calculerIRG(imposable);
            const mutuelle = parseFloat(dbEmp.cotisation_mutuelle || 1020.83);
            const net = totalBrut - (cnas + irg + mutuelle);

            const soldeCongesCalcul = calculerSoldeConges(dateEntreeVal, dbEmp.conges_pris || 0, dbEmp.reliquat_conges || 0);

            details = {
                employee: {
                    matricule: dbEmp.matricule || `EMP-00${empId}`,
                    nom: dbEmp.nom || '',
                    prenom: dbEmp.prenom || '',
                    fonction: dbEmp.fonction || dbEmp.emploi || 'Employé(e)',
                    cnasSecu: dbEmp.num_ss || '-',
                    dateEmbauche: dateEntreeVal ? new Date(dateEntreeVal).toLocaleDateString('fr-FR') : '-',
                    situationFamiliale: dbEmp.situation_familiale || 'Marié(e)',
                    nombreEnfants: dbEmp.nombre_enfants ?? 0,
                    accountNumber: dbEmp.compte_bancaire || '-'
                },
                payroll: {
                    period: periodeActive,
                    issuedAt: new Date().toLocaleDateString('fr-FR'),
                    paymentMethod: "Virement bancaire",
                    baseDays: 30,
                    salaireBase,
                    primePanier,
                    panierDays: 22,
                    primeVehicule,
                    cnasSalarial: cnas,
                    assietteIrg: imposable,
                    irg,
                    cotisationMutuelle: mutuelle,
                    totalBrut,
                    totalRetenues: cnas + irg + mutuelle,
                    netAPayer: net,
                    cumulImposable: imposable,
                    cumulCnas: cnas,
                    soldeConges: soldeCongesCalcul,
                    cnasPatronale: salaireBase * 0.26,
                    totalCoutEmployeur: totalBrut + (salaireBase * 0.26)
                }
            };
        }

        if (dbEmp) {
            const dateEntreeVal = dbEmp.date_entree || dbEmp.date_embauche;
            details.payroll.soldeConges = calculerSoldeConges(dateEntreeVal, dbEmp.conges_pris || 0, dbEmp.reliquat_conges || 0);
        }

        const comp = {
            name: `EURL ${COMPANY_CONFIG.name}`,
            address: COMPANY_CONFIG.address,
            postalCode: COMPANY_CONFIG.postalCode,
            city: COMPANY_CONFIG.city,
            country: COMPANY_CONFIG.country,
            phone: COMPANY_CONFIG.phone,
            cnasNumber: COMPANY_CONFIG.cnasNo,
            rc: COMPANY_CONFIG.rc,
            nif: COMPANY_CONFIG.nif
        };
        const emp = details.employee || {};
        const pay = details.payroll || {};

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Bulletin_${emp.nom || 'Employe'}_${periodeActive.replace(' ', '_')}.pdf`);
        doc.pipe(res);

        doc.fontSize(12).fillColor('#1d4ed8').text(comp.name, { continued: false });
        doc.fontSize(8).fillColor('#555555')
           .text(`${comp.address}`)
           .text(`N° CNAS : ${comp.cnasNumber} | NIF : ${comp.nif}`);

        doc.fontSize(9).fillColor('#000000')
           .text(`Période de paie : ${pay.period || periodeActive}`, 400, 40, { align: 'right' })
           .text(`Date d'édition : ${pay.issuedAt || new Date().toLocaleDateString('fr-FR')}`, 400, 52, { align: 'right' });

        doc.moveDown(1.5);
        doc.rect(40, doc.y, 515, 20).fill('#222222');
        doc.fillColor('#ffffff').fontSize(10).text("BULLETIN DE PAIE", 40, doc.y + 5, { align: 'center', width: 515 });
        doc.moveDown(1.5);

        const startY = doc.y;
        doc.rect(40, startY, 515, 65).stroke('#cccccc');
        doc.fontSize(8).fillColor('#000000');
        doc.text(`Matricule : ${emp.matricule || '-'}`, 50, startY + 8);
        doc.text(`Nom & Prénom : ${emp.nom || ''} ${emp.prenom || ''}`, 50, startY + 22);
        doc.text(`N° Sec. Sociale : ${emp.cnasSecu || '-'}`, 50, startY + 36);
        doc.text(`Mode Régl. : ${pay.paymentMethod || 'Virement bancaire'}`, 50, startY + 50);

        doc.text(`Fonction : ${emp.fonction || '-'}`, 300, startY + 8);
        doc.text(`Sit. Familiale : ${emp.situationFamiliale || '-'}`, 300, startY + 22);
        doc.text(`Enfants : ${emp.nombreEnfants ?? 0}`, 460, startY + 22);
        doc.text(`CCP / Compte : ${emp.accountNumber || '-'}`, 300, startY + 36);

        doc.y = startY + 75;

        const tableTop = doc.y;
        doc.rect(40, tableTop, 515, 18).fill('#333333');
        doc.fillColor('#ffffff').fontSize(8);
        doc.text("CODE", 45, tableTop + 5, { width: 40 });
        doc.text("DÉSIGNATION / RUBRIQUE", 90, tableTop + 5, { width: 200 });
        doc.text("NOMBRE / BASE", 295, tableTop + 5, { width: 80, align: 'right' });
        doc.text("GAINS (DZD)", 380, tableTop + 5, { width: 80, align: 'right' });
        doc.text("RETENUES (DZD)", 465, tableTop + 5, { width: 85, align: 'right' });

        let currentY = tableTop + 22;
        doc.fillColor('#000000');

        const drawRow = (code, lib, base, gain, retenue) => {
            doc.text(code, 45, currentY, { width: 40 });
            doc.text(lib, 90, currentY, { width: 200 });
            doc.text(base, 295, currentY, { width: 80, align: 'right' });
            doc.text(gain ? formatNum(gain) : '-', 380, currentY, { width: 80, align: 'right' });
            doc.text(retenue ? formatNum(retenue) : '-', 465, currentY, { width: 85, align: 'right' });
            currentY += 15;
        };

        const baseCalc = pay.salaireBase || 0;
        const baseDays = pay.baseDays || 30;
        const gainSalaireBase = (baseCalc / 30) * baseDays;
        drawRow("0010", "Salaire de base proportionnel", `${baseDays},00 j`, gainSalaireBase, null);

        if (pay.primePanier && pay.primePanier > 0) {
            const panierDays = pay.panierDays || 0;
            drawRow("2110", "Indemnité de Panier", `${panierDays} j`, pay.primePanier, null);
        }

        if (pay.primeVehicule && pay.primeVehicule > 0) {
            drawRow("2120", "Prime Véhicule", "1", pay.primeVehicule, null);
        }

        if (pay.cnasSalarial && pay.cnasSalarial > 0) {
            drawRow("2010", "Cotisation Sécurité Sociale (CNAS)", formatNum(gainSalaireBase), null, pay.cnasSalarial);
        }

        if (pay.irg && pay.irg > 0) {
            drawRow("7050", "Impôt sur le Revenu Global (IRG)", formatNum(pay.assietteIrg || 0), null, pay.irg);
        }

        if (pay.cotisationMutuelle && pay.cotisationMutuelle > 0) {
            drawRow("9000", "Cotisation Mutuelle", "1", null, pay.cotisationMutuelle);
        }

        currentY += 5;
        doc.rect(40, currentY, 515, 18).stroke('#aaaaaa');
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text("TOTAUX BRUTS & RETENUES", 50, currentY + 5);
        doc.text(formatNum(pay.totalBrut || 0), 370, currentY + 5, { width: 90, align: 'right' });
        doc.text(formatNum(pay.totalRetenues || 0), 455, currentY + 5, { width: 95, align: 'right' });
        doc.font('Helvetica');

        currentY += 30;
        doc.rect(40, currentY, 320, 25).stroke('#000000');
        doc.rect(360, currentY, 195, 25).fill('#e0f2fe');
        doc.fillColor('#000000').fontSize(8).text("Net à payer arrêté à la somme de :", 45, currentY + 8);
        
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0369a1');
        doc.text(`NET À PAYER : ${formatNum(pay.netAPayer || 0)} DZD`, 365, currentY + 8, { width: 185, align: 'center' });
        doc.font('Helvetica').fillColor('#000000');

        currentY += 35;
        const boxY = currentY;
        doc.rect(40, boxY, 250, 50).stroke('#cccccc');
        doc.rect(305, boxY, 250, 50).stroke('#cccccc');

        doc.fontSize(7).fillColor('#555555');
        doc.text("CUMULS ANNUELS / CONGÉS", 50, boxY + 4, { align: 'center', width: 230 });
        doc.text("COTISATIONS PATRONALES", 315, boxY + 4, { align: 'center', width: 230 });

        doc.fontSize(8).fillColor('#000000');
        doc.text(`Cumul Imposable : ${formatNum(pay.cumulImposable || pay.assietteIrg || 0)}`, 50, boxY + 16);
        doc.text(`Cumul CNAS : ${formatNum(pay.cumulCnas || pay.cnasSalarial || 0)}`, 50, boxY + 27);
        doc.text(`Solde Congés Payés : ${pay.soldeConges !== undefined ? pay.soldeConges : 0} j`, 50, boxY + 38);

        const patronale = pay.cnasPatronale || (gainSalaireBase * 0.26);
        doc.text(`CNAS Patronale (26%) : ${formatNum(patronale)}`, 315, boxY + 18);
        doc.text(`Total Coût Employeur : ${formatNum((pay.totalBrut || 0) + patronale)}`, 315, boxY + 30);

        currentY = boxY + 70;
        doc.fontSize(8);
        doc.text("Signature de l'employé", 80, currentY);
        doc.text("Cachet & Signature de l'employeur", 380, currentY);

        doc.end();
    } catch (err) {
        console.error('Erreur PDF structuré :', err);
        res.status(500).send("Erreur PDF : " + err.message);
    }
};

// 7. Acompte
export const postAjouterAcompte = async (req, res) => {
    const { employeeId, montant } = req.body;
    const periodeActive = getPeriodeActive(req);
    try {
        await pool.query('INSERT INTO payroll_acomptes (employee_id, montant, mois_concerne) VALUES ($1, $2, $3)', [employeeId, parseFloat(montant), periodeActive]);
        res.redirect('/payroll');
    } catch (err) {
        console.error('Erreur acompte :', err);
        res.status(500).send("Erreur acompte");
    }
};

// 8. Historique
export const getHistoriqueBulletins = async (req, res) => {
    const { periode } = req.query;
    const periodeActive = getPeriodeActive(req);
    try {
        let query = 'SELECT * FROM payroll_bulletins_history';
        let params = [];
        if (periode) {
            query += ' WHERE periode = $1 ORDER BY employee_id ASC';
            params.push(periode);
        } else {
            query += ' ORDER BY periode DESC, employee_id ASC';
        }
        const result = await pool.query(query, params);
        const periodesRes = await pool.query('SELECT DISTINCT periode FROM payroll_bulletins_history ORDER BY periode DESC');
        res.render('payroll/historique', {
            bulletins: result.rows,
            periodesDisponibles: periodesRes.rows,
            periodeFiltre: periode || '',
            periodeActive,
            user: req.session?.user
        });
    } catch (err) {
        console.error('Erreur historique :', err);
        res.status(500).send("Erreur historique");
    }
};

// 9. Export Excel Banque (Individuel)
export const exportBankExcel = async (req, res) => {
    const empId = req.params.id;
    const periodeActive = getPeriodeActive(req);

    try {
        const result = await pool.query('SELECT * FROM payroll_employees WHERE id = $1', [empId]);
        const dbEmp = result.rows[0];
        if (!dbEmp) return res.status(404).send("Employé non trouvé");

        const salaireBase = parseFloat(dbEmp.salaire_de_base || 0);
        const primePanier = 4400;
        const primeVehicule = parseFloat(dbEmp.prime_vehicule ?? 0);
        const cnasSalarial = salaireBase * 0.09;
        const imposable = salaireBase - cnasSalarial + primePanier + primeVehicule;
        const irg = calculerIRG(imposable);
        const mutuelle = parseFloat(dbEmp.cotisation_mutuelle || 1020.83);
        const netAPayer = (salaireBase + primePanier + primeVehicule) - (cnasSalarial + irg + mutuelle);

        const companyCompte = "07665-002658-006-09-DZD"; 
        const companySwift = "BNPADZALXXX";

        const excelData = [
            [
                `EURL ${COMPANY_CONFIG.name}`, "SWIFT", "Name", "Account", "SWIFT", 
                "Amount", "Currency", "Subject", "Reference", "Country", "BANK ID"
            ],
            [
                companyCompte,
                companySwift,
                `${dbEmp.nom || ''} ${dbEmp.prenom || ''}`.trim(),
                dbEmp.compte_bancaire || "",
                dbEmp.swift || "",
                Number(netAPayer.toFixed(2)),
                "DZD",
                `Salaire Mois ${periodeActive}`,
                `Salaire Mois ${periodeActive}`,
                "DZ",
                dbEmp.bank_id || ""
            ]
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Virement");

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        
        const fileName = `virement_banque_${dbEmp.matricule || 'agent'}_${periodeActive.replace(' ', '_')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

    } catch (error) {
        console.error("Erreur export Excel banque :", error);
        res.status(500).send("Erreur serveur lors de la génération du fichier Excel.");
    }
};

// 10. Export Excel Global Banque
export const exportAllBankExcel = async (req, res) => {
    const periodeActive = getPeriodeActive(req);

    try {
        const result = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        if (result.rows.length === 0) {
            return res.status(404).send("Aucun employé trouvé.");
        }

        const companyCompte = "07665-002658-006-09-DZD"; 
        const companySwift = "BNPADZALXXX";

        const excelData = [
            [
                `EURL ${COMPANY_CONFIG.name}`, "SWIFT", "Name", "Account", "SWIFT", 
                "Amount", "Currency", "Subject", "Reference", "Country", "BANK ID"
            ]
        ];

        for (const dbEmp of result.rows) {
            const salaireBase = parseFloat(dbEmp.salaire_de_base || 0);
            const primePanier = 4400;
            const primeVehicule = parseFloat(dbEmp.prime_vehicule ?? 0);
            const cnasSalarial = salaireBase * 0.09;
            const imposable = salaireBase - cnasSalarial + primePanier + primeVehicule;
            const irg = calculerIRG(imposable);
            const mutuelle = parseFloat(dbEmp.cotisation_mutuelle || 1020.83);
            const netAPayer = (salaireBase + primePanier + primeVehicule) - (cnasSalarial + irg + mutuelle);

            excelData.push([
                companyCompte,
                companySwift,
                `${dbEmp.nom || ''} ${dbEmp.prenom || ''}`.trim(),
                dbEmp.compte_bancaire || "",
                dbEmp.swift || "",
                Number(netAPayer.toFixed(2)),
                "DZD",
                `Salaire Mois ${periodeActive}`,
                `Salaire Mois ${periodeActive}`,
                "DZ",
                dbEmp.bank_id || ""
            ]);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Virement Global");

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        
        const fileName = `virement_banque_global_${periodeActive.replace(' ', '_')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

    } catch (error) {
        console.error("Erreur export Excel global banque :", error);
        res.status(500).send("Erreur serveur lors de la génération du fichier Excel global.");
    }
};