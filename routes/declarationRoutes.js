import express from 'express';
import { 
    getDeclarations, 
    exportDasEmployeur, 
    exportDasSalaries 
} from '../controllers/declarationController.js';

const router = express.Router();

// Page principale du portail des déclarations
router.get('/', getDeclarations);

// Export DAS Employeur au format TXT (D[AA]E[N°CNAS].txt)
router.get('/export-das-employeur', exportDasEmployeur);

// Export DAS Salariés au format TXT (D[AA]S[N°CNAS].txt)
router.get('/export-das-salaries', exportDasSalaries);

export default router;