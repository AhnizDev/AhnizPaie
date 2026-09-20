import express from 'express';
import { 
    getEmployees, 
    getAddEmployeeForm, 
    createEmployee, 
    getEditEmployeeForm,
    updateEmployee,
    deleteEmployee,
    getEmployeeDetails
} from '../controllers/employeeController.js';

const router = express.Router();

// Liste des salariés
router.get('/', getEmployees);

// Formulaire et création
router.get('/add', getAddEmployeeForm);
router.post('/add', createEmployee);

// Affichage fiche détaillé
router.get('/show/:id', getEmployeeDetails);

// Formulaire et modification
router.get('/edit/:id', getEditEmployeeForm);
router.post('/edit/:id', updateEmployee);

// Suppression
router.post('/delete/:id', deleteEmployee);

export default router;