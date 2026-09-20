import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Importation des routes des modules
import employeeRoutes from './routes/employeeRoutes.js';
import rubriqueRoutes from './routes/rubriqueRoutes.js';
import declarationRoutes from './routes/declarationRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import bulletinRoutes from './routes/bulletinRoutes.js';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;

// Reconstitution de __dirname pour ES Modules ("type": "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ahnizpaie_db',
    password: process.env.DB_PASSWORD || 'votre_mot_de_passe',
    port: process.env.DB_PORT || 5432,
});

// Gestion des erreurs inattendues de la base de données (évite le crash du serveur)
pool.on('error', (err) => {
    console.error('Erreur inattendue de connexion PostgreSQL :', err);
});

// Exportation unique du pool pour l'utiliser dans les contrôleurs
export { pool };

// Configuration EJS et middlewares
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuration Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'ahnizpaie_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));

// Middleware de télémétrie / stats pour le footer
app.use((req, res, next) => {
    res.locals.stats = {
        onlineUsers: 1,
        totalViews: 1250,
        totalMessages: 0
    };
    next();
});

// Middleware d'authentification (Protection des routes)
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// --- ROUTES ---

// Redirection racine
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// Page de connexion (GET)
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// Manuel d'utilisation (Accessible sans connexion)
app.get('/guide', (req, res) => {
    res.render('guideAhnizPaie');
});

// Traitement de la connexion (POST)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);

            if (match || password === user.password) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role || 'admin'
                };
                return res.redirect('/dashboard');
            }
        }

        res.render('login', { error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    } catch (err) {
        console.error('Erreur SQL Login :', err);
        res.render('login', { error: 'Erreur système lors de la connexion.' });
    }
});

// Déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Tableau de bord (Protégé)
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payroll_employees ORDER BY id ASC');
        const employees = result.rows;

        let totalBrutVal = 0;
        let totalNetVal = 0;

        employees.forEach(emp => {
            const sBase = parseFloat(emp.salaire_de_base || emp.salaire_base || emp.salaire || emp.base_salary || 0);
            const sImposable = parseFloat(emp.salaire_imposable || emp.imposable || 0);
            const sNet = parseFloat(emp.net_a_payer || emp.net_payer || emp.salaire_net || emp.net || 0);

            const brut = sImposable > 0 ? sImposable : sBase;
            const net = sNet > 0 ? sNet : (sBase > 0 ? sBase : 0);

            totalBrutVal += isNaN(brut) ? 0 : brut;
            totalNetVal += isNaN(net) ? 0 : net;
        });

        // Génération de la période active dynamique
        const dateActuelle = new Date();
        const optionsMois = { month: 'long', year: 'numeric' };
        const periodeActiveStr = dateActuelle.toLocaleDateString('fr-FR', optionsMois);
        const periodeActive = periodeActiveStr.charAt(0).toUpperCase() + periodeActiveStr.slice(1);

        res.render('dashboard', {
            user: req.session.user,
            totalEmployees: employees.length,
            totalBrut: totalBrutVal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalNet: totalNetVal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            periodeActive: periodeActive
        });
    } catch (err) {
        console.error('Erreur SQL Dashboard :', err);
        const dateActuelle = new Date();
        const optionsMois = { month: 'long', year: 'numeric' };
        const periodeActiveStr = dateActuelle.toLocaleDateString('fr-FR', optionsMois);
        const periodeActive = periodeActiveStr.charAt(0).toUpperCase() + periodeActiveStr.slice(1);

        res.render('dashboard', {
            user: req.session.user,
            totalEmployees: 0,
            totalBrut: '0,00',
            totalNet: '0,00',
            periodeActive: periodeActive
        });
    }
});

// --- MONTAGE DES MODULES PROTÉGÉS ---
app.use('/employees', requireAuth, employeeRoutes);
app.use('/rubriques', requireAuth, rubriqueRoutes);
app.use('/declarations', requireAuth, declarationRoutes);
app.use('/payroll', requireAuth, payrollRoutes);
app.use('/bulletins', requireAuth, bulletinRoutes);

// Lancement du serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AhnizPaie] Serveur démarré sur http://0.0.0.0:${PORT}`);
});