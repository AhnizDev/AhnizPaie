import express from 'express';
import {
    getDashboard,
    getPayrollIndex,
    getPointagePage,
    savePointageAndCalculate,
    getBulletinPage,
    cloturerMois,
    downloadBulletinPDF,
    postAjouterAcompte,
    getHistoriqueBulletins,
    exportBankExcel,
    exportAllBankExcel // <--- Ajoute cette ligne ici
} from '../controllers/payrollController.js';

const router = express.Router();

// Route pour l'accueil de la paie (tableau de bord / index)
router.get('/', getPayrollIndex);

// Routes pour la saisie et le calcul du pointage mensuel
router.get('/pointage', getPointagePage);
router.post('/pointage', savePointageAndCalculate);

// Routes pour la consultation et l'impression individuelle des bulletins
router.get('/bulletin', getBulletinPage);
router.get('/bulletin/:id', getBulletinPage);

// Route pour le téléchargement direct du bulletin au format PDF (PDFKit)
router.get('/pdf/:id', downloadBulletinPDF);

// Route pour l'export Excel destiné à la banque
router.get('/export-bank/:id', exportBankExcel); // <--- 2. Ajoute la route ici

// Route indépendante pour télécharger le fichier global de tous les salariés
router.get('/export-bank-all', exportAllBankExcel);

// Route pour l'historique et la consultation des archives de paie des mois précédents
router.get('/historique', getHistoriqueBulletins);

// Route pour l'enregistrement d'un acompte sur salaire
router.post('/acompte', postAjouterAcompte);

// Route pour la clôture du mois (bascule automatique vers la période suivante)
router.post('/cloturer', cloturerMois);

export default router;