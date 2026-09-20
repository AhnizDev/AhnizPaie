--
-- PostgreSQL database dump
--

\restrict 4kK1T6aYj92bIw1Bs30OPDfO08zfpRCKp2cZcRNmkaCqtZOkNtVxoBSYZxBdG2v

-- Dumped from database version 16.15
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(30),
    subject character varying(150),
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.contacts OWNER TO devuser;

--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contacts_id_seq OWNER TO devuser;

--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.page_views (
    id integer NOT NULL,
    views_count bigint DEFAULT 0
);


ALTER TABLE public.page_views OWNER TO devuser;

--
-- Name: payroll_acomptes; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_acomptes (
    id integer NOT NULL,
    employee_id integer,
    montant numeric(12,2) NOT NULL,
    date_versement date DEFAULT CURRENT_DATE,
    mois_concerne character varying(50) NOT NULL
);


ALTER TABLE public.payroll_acomptes OWNER TO devuser;

--
-- Name: payroll_acomptes_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_acomptes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_acomptes_id_seq OWNER TO devuser;

--
-- Name: payroll_acomptes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_acomptes_id_seq OWNED BY public.payroll_acomptes.id;


--
-- Name: payroll_bulletin_lignes; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_bulletin_lignes (
    id integer NOT NULL,
    bulletin_id integer NOT NULL,
    code_rubrique character varying(20) NOT NULL,
    libelle character varying(150) NOT NULL,
    base_nombre numeric(12,2),
    taux_patronal numeric(6,3),
    montant_patronal numeric(12,2),
    taux_salarial numeric(6,3),
    retenue numeric(12,2) DEFAULT 0.00,
    gain numeric(12,2) DEFAULT 0.00,
    ordre_affichage integer DEFAULT 0
);


ALTER TABLE public.payroll_bulletin_lignes OWNER TO devuser;

--
-- Name: payroll_bulletin_lignes_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_bulletin_lignes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_bulletin_lignes_id_seq OWNER TO devuser;

--
-- Name: payroll_bulletin_lignes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_bulletin_lignes_id_seq OWNED BY public.payroll_bulletin_lignes.id;


--
-- Name: payroll_bulletins; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_bulletins (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    pointage_id integer,
    mois integer NOT NULL,
    annee integer NOT NULL,
    periode_libelle character varying(100) NOT NULL,
    date_debut date NOT NULL,
    date_fin date NOT NULL,
    date_paiement date NOT NULL,
    mode_paiement character varying(50) DEFAULT 'VIREMENT'::character varying,
    salaire_base_calcule numeric(12,2) DEFAULT 0.00 NOT NULL,
    brut_cnas numeric(12,2) DEFAULT 0.00 NOT NULL,
    cnas_salariae_9 numeric(12,2) DEFAULT 0.00 NOT NULL,
    cnas_patronale_25_5 numeric(12,2) DEFAULT 0.00 NOT NULL,
    fond_logement numeric(12,2) DEFAULT 0.00,
    prime_panier numeric(12,2) DEFAULT 0.00,
    prime_voiture numeric(12,2) DEFAULT 0.00,
    net_imposable numeric(12,2) DEFAULT 0.00 NOT NULL,
    irg_retenu numeric(12,2) DEFAULT 0.00 NOT NULL,
    salaire_apres_impot numeric(12,2) DEFAULT 0.00 NOT NULL,
    net_a_payer numeric(12,2) DEFAULT 0.00 NOT NULL,
    cumul_brut numeric(12,2) DEFAULT 0.00,
    cumul_imposable numeric(12,2) DEFAULT 0.00,
    cumul_net numeric(12,2) DEFAULT 0.00,
    cumul_cnas numeric(12,2) DEFAULT 0.00,
    reliquat_cp numeric(5,2) DEFAULT 0.00,
    valeur_reliquat numeric(12,2) DEFAULT 0.00,
    droit_cp numeric(5,2) DEFAULT 0.00,
    valeur_droit numeric(12,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    details_json jsonb,
    cnas_salarie_9 numeric(12,2) DEFAULT 0,
    prime_vehicule numeric(12,2) DEFAULT 0,
    rubriques_json text,
    status character varying(20) DEFAULT 'draft'::character varying,
    CONSTRAINT payroll_bulletins_annee_check CHECK ((annee >= 2000)),
    CONSTRAINT payroll_bulletins_mois_check CHECK (((mois >= 1) AND (mois <= 12)))
);


ALTER TABLE public.payroll_bulletins OWNER TO devuser;

--
-- Name: payroll_bulletins_history; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_bulletins_history (
    id integer NOT NULL,
    employee_id integer,
    periode character varying(50) NOT NULL,
    salaire_base numeric(12,2),
    salaire_imposable numeric(12,2),
    cnas_salarie numeric(12,2),
    irg numeric(12,2),
    net_a_payer numeric(12,2),
    details_json jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    mois integer,
    annee integer
);


ALTER TABLE public.payroll_bulletins_history OWNER TO devuser;

--
-- Name: payroll_bulletins_history_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_bulletins_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_bulletins_history_id_seq OWNER TO devuser;

--
-- Name: payroll_bulletins_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_bulletins_history_id_seq OWNED BY public.payroll_bulletins_history.id;


--
-- Name: payroll_bulletins_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_bulletins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_bulletins_id_seq OWNER TO devuser;

--
-- Name: payroll_bulletins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_bulletins_id_seq OWNED BY public.payroll_bulletins.id;


--
-- Name: payroll_employees; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_employees (
    id integer NOT NULL,
    matricule character varying(20) NOT NULL,
    nom character varying(50) NOT NULL,
    prenom character varying(50) NOT NULL,
    adresse text,
    emploi character varying(100),
    num_ss character varying(30),
    date_entree date,
    section_atelier character varying(20),
    horaire_mensuel numeric(6,2) DEFAULT 173.33,
    salaire_de_base numeric(12,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    date_naissance date,
    cnas_salarie numeric(12,2) DEFAULT 0,
    cnas_patronale numeric(12,2) DEFAULT 0,
    salaire_imposable numeric(12,2) DEFAULT 0,
    irg numeric(12,2) DEFAULT 0,
    net_a_payer numeric(12,2) DEFAULT 0,
    cotisation_mutuelle numeric DEFAULT 1020.83,
    prime_vehicule numeric DEFAULT 0,
    absences numeric DEFAULT 0,
    conge_jours_mois numeric DEFAULT 0,
    mode_paiement character varying(50) DEFAULT 'Virement'::character varying,
    compte_bancaire character varying(50),
    swift character varying(30),
    bank_id character varying(30),
    situation_familiale character varying(50) DEFAULT 'Marié(e)'::character varying,
    nombre_enfants integer DEFAULT 0,
    solde_conges numeric(6,2),
    reliquat_conges numeric DEFAULT 0,
    conges_pris numeric DEFAULT 0
);


ALTER TABLE public.payroll_employees OWNER TO devuser;

--
-- Name: payroll_employees_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_employees_id_seq OWNER TO devuser;

--
-- Name: payroll_employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_employees_id_seq OWNED BY public.payroll_employees.id;


--
-- Name: payroll_pointage_details; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_pointage_details (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    rubrique_id integer NOT NULL,
    periode character varying(7) NOT NULL,
    valeur numeric(12,2) DEFAULT 0.00
);


ALTER TABLE public.payroll_pointage_details OWNER TO devuser;

--
-- Name: payroll_pointage_details_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_pointage_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_pointage_details_id_seq OWNER TO devuser;

--
-- Name: payroll_pointage_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_pointage_details_id_seq OWNED BY public.payroll_pointage_details.id;


--
-- Name: payroll_pointages; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_pointages (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    mois integer NOT NULL,
    annee integer NOT NULL,
    jours_travailles numeric(5,2) DEFAULT 22.00,
    horaire_mensuel numeric(6,2) DEFAULT 173.33,
    jours_absence numeric(5,2) DEFAULT 0.00,
    heures_sup numeric(5,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payroll_pointages_annee_check CHECK ((annee >= 2000)),
    CONSTRAINT payroll_pointages_mois_check CHECK (((mois >= 1) AND (mois <= 12)))
);


ALTER TABLE public.payroll_pointages OWNER TO devuser;

--
-- Name: payroll_pointages_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_pointages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_pointages_id_seq OWNER TO devuser;

--
-- Name: payroll_pointages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_pointages_id_seq OWNED BY public.payroll_pointages.id;


--
-- Name: payroll_rubriques; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.payroll_rubriques (
    id integer NOT NULL,
    code integer NOT NULL,
    libelle character varying(100) NOT NULL,
    type_rubrique character varying(20),
    taux_salarie numeric(5,3) DEFAULT 0.000,
    taux_patronal numeric(5,3) DEFAULT 0.000,
    CONSTRAINT payroll_rubriques_type_rubrique_check CHECK (((type_rubrique)::text = ANY ((ARRAY['gain'::character varying, 'retenue'::character varying, 'patronale'::character varying, 'totaux'::character varying])::text[])))
);


ALTER TABLE public.payroll_rubriques OWNER TO devuser;

--
-- Name: payroll_rubriques_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.payroll_rubriques_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_rubriques_id_seq OWNER TO devuser;

--
-- Name: payroll_rubriques_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.payroll_rubriques_id_seq OWNED BY public.payroll_rubriques.id;


--
-- Name: rubriques; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.rubriques (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle character varying(150) NOT NULL,
    type character varying(20) NOT NULL,
    cotisable boolean DEFAULT true,
    imposable boolean DEFAULT true,
    mode_calcul character varying(20) DEFAULT 'FIXE'::character varying,
    valeur_par_defaut numeric(12,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rubriques_type_check CHECK (((type)::text = ANY ((ARRAY['GAIN'::character varying, 'RETENUE'::character varying])::text[])))
);


ALTER TABLE public.rubriques OWNER TO devuser;

--
-- Name: rubriques_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.rubriques_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rubriques_id_seq OWNER TO devuser;

--
-- Name: rubriques_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.rubriques_id_seq OWNED BY public.rubriques.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL
);


ALTER TABLE public.users OWNER TO devuser;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO devuser;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: visitor_logs; Type: TABLE; Schema: public; Owner: devuser
--

CREATE TABLE public.visitor_logs (
    id integer NOT NULL,
    session_id character varying(255),
    visit_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address character varying(45),
    ip_type character varying(10) DEFAULT 'IPv4'::character varying,
    isp character varying(255),
    org character varying(255),
    country_name character varying(100),
    country_code character varying(10),
    region_name character varying(100),
    city_name character varying(100),
    postal_code character varying(20),
    latitude numeric(10,6),
    longitude numeric(10,6),
    maps_coords character varying(50),
    is_exact_gps smallint DEFAULT 0,
    device character varying(50),
    device_brand character varying(100),
    device_model character varying(100),
    screen_resolution character varying(30),
    viewport_size character varying(30),
    pixel_ratio numeric(4,2),
    cpu_cores integer,
    device_memory numeric(5,2),
    os character varying(50),
    os_version character varying(50),
    browser character varying(50),
    browser_version character varying(50),
    language character varying(20),
    accept_language text,
    page character varying(255),
    referer text,
    http_method character varying(10),
    is_first_visit smallint DEFAULT 0,
    is_bot boolean DEFAULT false,
    is_proxy boolean DEFAULT false,
    is_hosting boolean DEFAULT false,
    raw_user_agent text
);


ALTER TABLE public.visitor_logs OWNER TO devuser;

--
-- Name: visitor_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: devuser
--

CREATE SEQUENCE public.visitor_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.visitor_logs_id_seq OWNER TO devuser;

--
-- Name: visitor_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: devuser
--

ALTER SEQUENCE public.visitor_logs_id_seq OWNED BY public.visitor_logs.id;


--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);


--
-- Name: payroll_acomptes id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_acomptes ALTER COLUMN id SET DEFAULT nextval('public.payroll_acomptes_id_seq'::regclass);


--
-- Name: payroll_bulletin_lignes id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletin_lignes ALTER COLUMN id SET DEFAULT nextval('public.payroll_bulletin_lignes_id_seq'::regclass);


--
-- Name: payroll_bulletins id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins ALTER COLUMN id SET DEFAULT nextval('public.payroll_bulletins_id_seq'::regclass);


--
-- Name: payroll_bulletins_history id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins_history ALTER COLUMN id SET DEFAULT nextval('public.payroll_bulletins_history_id_seq'::regclass);


--
-- Name: payroll_employees id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_employees ALTER COLUMN id SET DEFAULT nextval('public.payroll_employees_id_seq'::regclass);


--
-- Name: payroll_pointage_details id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointage_details ALTER COLUMN id SET DEFAULT nextval('public.payroll_pointage_details_id_seq'::regclass);


--
-- Name: payroll_pointages id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointages ALTER COLUMN id SET DEFAULT nextval('public.payroll_pointages_id_seq'::regclass);


--
-- Name: payroll_rubriques id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_rubriques ALTER COLUMN id SET DEFAULT nextval('public.payroll_rubriques_id_seq'::regclass);


--
-- Name: rubriques id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.rubriques ALTER COLUMN id SET DEFAULT nextval('public.rubriques_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: visitor_logs id; Type: DEFAULT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.visitor_logs ALTER COLUMN id SET DEFAULT nextval('public.visitor_logs_id_seq'::regclass);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: payroll_acomptes payroll_acomptes_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_acomptes
    ADD CONSTRAINT payroll_acomptes_pkey PRIMARY KEY (id);


--
-- Name: payroll_bulletin_lignes payroll_bulletin_lignes_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletin_lignes
    ADD CONSTRAINT payroll_bulletin_lignes_pkey PRIMARY KEY (id);


--
-- Name: payroll_bulletins_history payroll_bulletins_history_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins_history
    ADD CONSTRAINT payroll_bulletins_history_pkey PRIMARY KEY (id);


--
-- Name: payroll_bulletins payroll_bulletins_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins
    ADD CONSTRAINT payroll_bulletins_pkey PRIMARY KEY (id);


--
-- Name: payroll_employees payroll_employees_matricule_key; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_employees
    ADD CONSTRAINT payroll_employees_matricule_key UNIQUE (matricule);


--
-- Name: payroll_employees payroll_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_employees
    ADD CONSTRAINT payroll_employees_pkey PRIMARY KEY (id);


--
-- Name: payroll_pointage_details payroll_pointage_det_unique; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointage_details
    ADD CONSTRAINT payroll_pointage_det_unique UNIQUE (employee_id, rubrique_id, periode);


--
-- Name: payroll_pointage_details payroll_pointage_details_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointage_details
    ADD CONSTRAINT payroll_pointage_details_pkey PRIMARY KEY (id);


--
-- Name: payroll_pointages payroll_pointages_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointages
    ADD CONSTRAINT payroll_pointages_pkey PRIMARY KEY (id);


--
-- Name: payroll_rubriques payroll_rubriques_code_key; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_rubriques
    ADD CONSTRAINT payroll_rubriques_code_key UNIQUE (code);


--
-- Name: payroll_rubriques payroll_rubriques_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_rubriques
    ADD CONSTRAINT payroll_rubriques_pkey PRIMARY KEY (id);


--
-- Name: rubriques rubriques_code_key; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.rubriques
    ADD CONSTRAINT rubriques_code_key UNIQUE (code);


--
-- Name: rubriques rubriques_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.rubriques
    ADD CONSTRAINT rubriques_pkey PRIMARY KEY (id);


--
-- Name: payroll_bulletins unique_emp_mois_annee; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins
    ADD CONSTRAINT unique_emp_mois_annee UNIQUE (employee_id, mois, annee);


--
-- Name: payroll_bulletins_history unique_emp_periode_hist; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins_history
    ADD CONSTRAINT unique_emp_periode_hist UNIQUE (employee_id, periode);


--
-- Name: payroll_bulletins unique_employee_mois_annee; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins
    ADD CONSTRAINT unique_employee_mois_annee UNIQUE (employee_id, mois, annee);


--
-- Name: payroll_bulletins_history unique_employee_periode; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins_history
    ADD CONSTRAINT unique_employee_periode UNIQUE (employee_id, periode);


--
-- Name: payroll_bulletins_history unique_history_emp_periode; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins_history
    ADD CONSTRAINT unique_history_emp_periode UNIQUE (employee_id, periode);


--
-- Name: payroll_bulletins unq_bulletin_employee_periode; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins
    ADD CONSTRAINT unq_bulletin_employee_periode UNIQUE (employee_id, mois, annee);


--
-- Name: payroll_pointages unq_pointage_employee_periode; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointages
    ADD CONSTRAINT unq_pointage_employee_periode UNIQUE (employee_id, mois, annee);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: visitor_logs visitor_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_bulletins_emp; Type: INDEX; Schema: public; Owner: devuser
--

CREATE INDEX idx_bulletins_emp ON public.payroll_bulletins USING btree (employee_id);


--
-- Name: idx_lignes_bulletin; Type: INDEX; Schema: public; Owner: devuser
--

CREATE INDEX idx_lignes_bulletin ON public.payroll_bulletin_lignes USING btree (bulletin_id);


--
-- Name: idx_payroll_bulletins_history_unique; Type: INDEX; Schema: public; Owner: devuser
--

CREATE UNIQUE INDEX idx_payroll_bulletins_history_unique ON public.payroll_bulletins_history USING btree (employee_id, periode);


--
-- Name: idx_pointages_emp; Type: INDEX; Schema: public; Owner: devuser
--

CREATE INDEX idx_pointages_emp ON public.payroll_pointages USING btree (employee_id);


--
-- Name: payroll_acomptes payroll_acomptes_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_acomptes
    ADD CONSTRAINT payroll_acomptes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.payroll_employees(id) ON DELETE CASCADE;


--
-- Name: payroll_bulletin_lignes payroll_bulletin_lignes_bulletin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletin_lignes
    ADD CONSTRAINT payroll_bulletin_lignes_bulletin_id_fkey FOREIGN KEY (bulletin_id) REFERENCES public.payroll_bulletins(id) ON DELETE CASCADE;


--
-- Name: payroll_bulletins payroll_bulletins_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins
    ADD CONSTRAINT payroll_bulletins_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.payroll_employees(id) ON DELETE RESTRICT;


--
-- Name: payroll_bulletins_history payroll_bulletins_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins_history
    ADD CONSTRAINT payroll_bulletins_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.payroll_employees(id) ON DELETE CASCADE;


--
-- Name: payroll_bulletins payroll_bulletins_pointage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_bulletins
    ADD CONSTRAINT payroll_bulletins_pointage_id_fkey FOREIGN KEY (pointage_id) REFERENCES public.payroll_pointages(id) ON DELETE SET NULL;


--
-- Name: payroll_pointage_details payroll_pointage_details_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointage_details
    ADD CONSTRAINT payroll_pointage_details_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.payroll_employees(id) ON DELETE CASCADE;


--
-- Name: payroll_pointage_details payroll_pointage_details_rubrique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointage_details
    ADD CONSTRAINT payroll_pointage_details_rubrique_id_fkey FOREIGN KEY (rubrique_id) REFERENCES public.payroll_rubriques(id) ON DELETE CASCADE;


--
-- Name: payroll_pointages payroll_pointages_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: devuser
--

ALTER TABLE ONLY public.payroll_pointages
    ADD CONSTRAINT payroll_pointages_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.payroll_employees(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 4kK1T6aYj92bIw1Bs30OPDfO08zfpRCKp2cZcRNmkaCqtZOkNtVxoBSYZxBdG2v

