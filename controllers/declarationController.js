import pool from '../config/db.js';
import { COMPANY_CONFIG } from '../config/company.js';

// Helper pour formater les dates au format JJ/MM/AAAA (Affichage Web)
const formatDateFr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// Helper pour formater les dates au format JJMMAAAA (Export CNAS)
const formatDateCnas = (dateInput) => {
    if (!dateInput) return '01011900';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '01011900';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}${month}${year}`;
};

// Helper pour cadrer les montants arrondis avec zéros à gauche
const formatMontantCnas = (val, length = 8) => {
    const num = Math.round(Number(val) || 0);
    return String(num).padStart(length, '0');
};

// Helper pour déterminer le trimestre selon le libellé de la période (ex: "Septembre 2026")
const getTrimestreFromPeriode = (periodeStr) => {
    if (!periodeStr) return 0;
    const p = String(periodeStr).toLowerCase();
    if (p.includes('janv') || p.includes('févr') || p.includes('fevr') || p.includes('mars')) return 1;
    if (p.includes('avr') || p.includes('mai') || p.includes('juin')) return 2;
    if (p.includes('juil') || p.includes('août') || p.includes('aout') || p.includes('sept')) return 3;
    if (p.includes('oct') || p.includes('nov') || p.includes('déc') || p.includes('dec')) return 4;
    return 0;
};

// Page principale des déclarations (Hub central)
export const getDeclarations = async (req, res) => {
    try {
        let employeesList = [];
        try {
            const empResult = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
            employeesList = empResult.rows.map(emp => ({
                ...emp,
                date_naissance_formatted: formatDateFr(emp.date_naissance),
                date_entree_formatted: formatDateFr(emp.date_entree)
            }));
        } catch (dbErr) {
            console.warn("Erreur lecture table payroll_employees :", dbErr.message);
        }

        const company = {
            name: COMPANY_CONFIG.name || 'AhniZTech',
            address: COMPANY_CONFIG.address || 'Dar El Beïda, Alger',
            cnasNo: COMPANY_CONFIG.cnasNo || '1636564639',
            nif: COMPANY_CONFIG.nif || '000616129054931',
            rc: COMPANY_CONFIG.rc || '06 B 097 5008',
            agenceCnas: COMPANY_CONFIG.agenceCnas || 'Agence CNAS Alger',
            centreImpots: COMPANY_CONFIG.centreImpots || 'Recette des Impôts'
        };

        const dateActuelle = new Date();
        const anneeCourante = String(dateActuelle.getFullYear());
        const optionsMois = { month: 'long', year: 'numeric' };
        const moisActuelStr = dateActuelle.toLocaleDateString('fr-FR', optionsMois);
        const moisActuel = moisActuelStr.charAt(0).toUpperCase() + moisActuelStr.slice(1);

        // Récupération des données réelles du mois depuis payroll_bulletins_history
        let masseSalarialeMensuelle = 0;
        let cnasSalariale = 0;
        let irgMensuel = 0;
        let hasHistoryData = false;

        try {
            const historyResult = await pool.query(
                "SELECT * FROM payroll_bulletins_history WHERE periode ILIKE $1",
                [`%${moisActuel}%`]
            );
            if (historyResult.rows.length > 0) {
                hasHistoryData = true;
                historyResult.rows.forEach(b => {
                    masseSalarialeMensuelle += Number(b.salaire_base || 0);
                    cnasSalariale += Number(b.cnas_salarie || 0);
                    irgMensuel += Number(b.irg || 0);
                });
            }
        } catch (hErr) {
            console.warn("Erreur lecture payroll_bulletins_history :", hErr.message);
        }

        // Si aucun bulletin calculé pour ce mois dans l'historique, calcul basé sur le salaire de base
        if (!hasHistoryData) {
            masseSalarialeMensuelle = employeesList.reduce((acc, emp) => acc + Number(emp.salaire_de_base || 0), 0);
            cnasSalariale = masseSalarialeMensuelle * 0.09;
            irgMensuel = masseSalarialeMensuelle * 0.12;
        }

        const cnasPatronale = masseSalarialeMensuelle * 0.26;
        const totalCnasMensuel = cnasSalariale + cnasPatronale;

        const declarationsData = {
            periodeAnnee: anneeCourante,
            periodeMois: moisActuel,
            totalEmployees: employeesList.length,
            masseSalarialeTotale: masseSalarialeMensuelle * 12,
            masseSalarialeMensuelle: masseSalarialeMensuelle,
            cotisationCnasSalarialeAnnuelle: cnasSalariale * 12,
            cotisationCnasPatronaleAnnuelle: cnasPatronale * 12,
            totalCnasVerserAnnuel: totalCnasMensuel * 12,
            irgMensuel: irgMensuel,
            cnasSalarialeMensuelle: cnasSalariale,
            cnasPatronaleMensuelle: cnasPatronale,
            totalCnasMensuel: totalCnasMensuel
        };

        res.render('declarations/index', { 
            company, 
            declaration: declarationsData, 
            employeesList,
            user: req.session ? req.session.user : null 
        });
    } catch (err) {
        console.error('Erreur Déclarations :', err.message);
        res.status(500).send("Erreur de chargement des déclarations : " + err.message);
    }
};

// Export DAS Employeur (Format fixe CNAS basé sur payroll_bulletins_history)
export const exportDasEmployeur = async (req, res) => {
    try {
        const anneeFull = parseInt(req.query.annee) || new Date().getFullYear();
        const annee2Digits = String(anneeFull).slice(-2);
        
        const cnas10 = (COMPANY_CONFIG.cnasNo || '1636564639').replace(/\D/g, '').padStart(10, '0');
        const filename = `D${annee2Digits}E${cnas10}.txt`;

        const empResult = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        const employees = empResult.rows;
        const totalEmployees = employees.length;

        // Lecture des bulletins de l'année sélectionnée dans l'historique
        const historyResult = await pool.query(
            "SELECT * FROM payroll_bulletins_history WHERE periode LIKE $1",
            [`%${anneeFull}%`]
        );
        const historyRows = historyResult.rows;

        let totalT1 = 0, totalT2 = 0, totalT3 = 0, totalT4 = 0;

        if (historyRows.length > 0) {
            historyRows.forEach(b => {
                const trim = getTrimestreFromPeriode(b.periode);
                const val = Math.round(Number(b.salaire_base || 0));
                if (trim === 1) totalT1 += val;
                else if (trim === 2) totalT2 += val;
                else if (trim === 3) totalT3 += val;
                else if (trim === 4) totalT4 += val;
            });
        } else {
            // Secours si aucun bulletin enregistré pour l'année
            const masseMensuelle = employees.reduce((acc, emp) => acc + Number(emp.salaire_de_base || 0), 0);
            const masseTrim = Math.round(masseMensuelle * 3);
            totalT1 = masseTrim; totalT2 = masseTrim; totalT3 = masseTrim; totalT4 = masseTrim;
        }

        const masseAnnuelle = totalT1 + totalT2 + totalT3 + totalT4;

        // Champs texte cadrés avec espaces selon la norme fixe CNAS
        const raisonSociale = (COMPANY_CONFIG.name || 'AHNI ZTECH').toUpperCase().padEnd(30, ' ');
        const formeJuridique = (COMPANY_CONFIG.formeJuridique || 'EURL').toUpperCase().padEnd(22, ' ');
        const adresse = (COMPANY_CONFIG.address || 'DAR EL BEIDA ALGER').toUpperCase().padEnd(40, ' ');

        // Formatage des montants
        const t1 = String(totalT1).padStart(12, ' ');
        const t2 = String(totalT2).padStart(12, ' ');
        const t3 = String(totalT3).padStart(12, ' ');
        const t4 = String(totalT4).padStart(12, ' ');
        const annuel = String(masseAnnuelle).padStart(13, ' ');
        const nbEmp = String(totalEmployees).padStart(10, ' ');

        // Construction de la ligne employeur CNAS
        let line = `${cnas10}N${anneeFull}14200`;
        line += `${raisonSociale}`;
        line += `${formeJuridique}`;
        line += `${adresse}`;
        line += `${t1}   `;
        line += `${t2}   `;
        line += `${t3}   `;
        line += `${t4}   `;
        line += `${annuel}   `;
        line += `${nbEmp}`;

        const txtContent = line + '\r\n';

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(txtContent);
    } catch (err) {
        res.status(500).send("Erreur génération DAS Employeur : " + err.message);
    }
};

// Export DAS Salariés (Format fixe CNAS basé sur payroll_bulletins_history)
export const exportDasSalaries = async (req, res) => {
    try {
        const anneeFull = parseInt(req.query.annee) || new Date().getFullYear();
        const annee2Digits = String(anneeFull).slice(-2);
        
        const cnas10 = (COMPANY_CONFIG.cnasNo || '1636564639').replace(/\D/g, '').padStart(10, '0');
        const filename = `D${annee2Digits}S${cnas10}.txt`;

        const empResult = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        const employees = empResult.rows;

        // Lecture des bulletins de l'année sélectionnée dans l'historique
        const historyResult = await pool.query(
            "SELECT * FROM payroll_bulletins_history WHERE periode LIKE $1",
            [`%${anneeFull}%`]
        );
        const historyRows = historyResult.rows;

        let txtContent = '';

        employees.forEach((emp, index) => {
            const numOrdre = String(index + 1);
            const numSs = (emp.num_ss || '').replace(/\D/g, '').padStart(12, '0');
            const nom = (emp.nom || '').toUpperCase().padEnd(26, ' ');
            const prenom = (emp.prenom || '').toUpperCase().padEnd(30, ' ');
            const dateNaiss = formatDateCnas(emp.date_naissance);
            const dateEntree = formatDateCnas(emp.date_entree);
            const emploi = (emp.emploi || '').padEnd(30, ' ');

            // Filtrage des bulletins propres à cet employé
            const empBulletins = historyRows.filter(h => Number(h.employee_id) === Number(emp.id));

            let t1 = 0, t2 = 0, t3 = 0, t4 = 0;

            if (empBulletins.length > 0) {
                empBulletins.forEach(b => {
                    const trim = getTrimestreFromPeriode(b.periode);
                    const val = Number(b.salaire_base || 0);
                    if (trim === 1) t1 += val;
                    else if (trim === 2) t2 += val;
                    else if (trim === 3) t3 += val;
                    else if (trim === 4) t4 += val;
                });
            } else {
                // Secours si aucun bulletin enregistré pour cet employé
                const sTrim = Number(emp.salaire_de_base || 0) * 3;
                t1 = sTrim; t2 = sTrim; t3 = sTrim; t4 = sTrim;
            }

            const trimMontants = [t1, t2, t3, t4];
            const salaireAnnuel = t1 + t2 + t3 + t4;

            // Alignement des données de la ligne salarié
            let line = `${cnas10}${anneeFull}${numOrdre}    `;
            line += `${numSs}`;
            line += `${nom}`;
            line += `${prenom}`;
            line += `${dateNaiss}66 `;

            // Génération des 4 Trimestres
            for (let t = 0; t < 4; t++) {
                line += `J${formatMontantCnas(trimMontants[t], 8)}  66 `;
            }

            // Cumul Annuel + Date Entrée + Emploi
            line += `  ${formatMontantCnas(salaireAnnuel, 9)}   `;
            line += `${dateEntree}      `;
            line += `${emploi}`;

            txtContent += line + '\r\n';
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(txtContent);
    } catch (err) {
        res.status(500).send("Erreur génération DAS Salariés : " + err.message);
    }
};