import express from 'express';
import { 
    getRubriques, 
    getAddRubrique, 
    postAddRubrique, 
    getEditRubrique, 
    postEditRubrique, 
    deleteRubrique 
} from '../controllers/rubriqueController.js';

const router = express.Router();

router.get('/', getRubriques);
router.get('/add', getAddRubrique);
router.post('/add', postAddRubrique);
router.get('/edit/:id', getEditRubrique);
router.post('/edit/:id', postEditRubrique);
router.post('/delete/:id', deleteRubrique);

export default router;
