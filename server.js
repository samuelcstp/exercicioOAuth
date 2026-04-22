import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Serve o frontend (pasta public/) na raiz
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = './users.json';
const AVISOS_FILE = './avisos.json';

// ========== HELPERS ==========

const saveOrUpdateUser = (profile) => {
  let users = [];
  if (fs.existsSync(DB_FILE)) {
    users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }

  const userData = { email: profile.email, name: profile.name, role: 'user' };
  const idx = users.findIndex(u => u.email === profile.email);
  if (idx >= 0) users[idx] = userData; else users.push(userData);

  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  return userData;
};

const getAvisos = () => {
  if (!fs.existsSync(AVISOS_FILE)) return [];
  return JSON.parse(fs.readFileSync(AVISOS_FILE, 'utf8'));
};

const saveAvisos = (avisos) =>
  fs.writeFileSync(AVISOS_FILE, JSON.stringify(avisos, null, 2));

// ========== MIDDLEWARE JWT ==========

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ========== GOOGLE OAUTH ==========

app.get('/auth/google', (req, res) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${BASE}/auth/google/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'profile email');
  res.redirect(url.toString());
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { data: tokens } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: `${BASE}/auth/google/callback`,
      grant_type: 'authorization_code',
    });

    const { data: profile } = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    const user = saveOrUpdateUser(profile);
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.redirect(`/callback?token=${token}`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect('/login?error=auth_failed');
  }
});

// ========== MICROSOFT OAUTH ==========

app.get('/auth/microsoft', (req, res) => {
  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', process.env.MS_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', `${BASE}/auth/microsoft/callback`);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'user.read');
  res.redirect(url.toString());
});

app.get('/auth/microsoft/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      code,
      redirect_uri: `${BASE}/auth/microsoft/callback`,
      grant_type: 'authorization_code',
      scope: 'user.read',
    });

    const { data: tokens } = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { data: me } = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const user = saveOrUpdateUser({
      name: me.displayName,
      email: me.mail || me.userPrincipalName,
    });

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.redirect(`/callback?token=${token}`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect('/login?error=auth_failed');
  }
});

// ========== API DE AVISOS ==========

app.get('/api/me', auth, (req, res) => res.json(req.user));

app.get('/api/avisos', auth, (req, res) => res.json(getAvisos()));

app.post('/api/avisos', auth, (req, res) => {
  const { titulo, texto } = req.body;
  if (!titulo?.trim() || !texto?.trim())
    return res.status(400).json({ error: 'Título e texto são obrigatórios' });

  const avisos = getAvisos();
  const novo = {
    id: Date.now().toString(),
    titulo: titulo.trim(),
    texto: texto.trim(),
    autor: req.user.name,
    email: req.user.email,
    criadoEm: new Date().toISOString(),
  };
  avisos.unshift(novo);
  saveAvisos(avisos);
  res.status(201).json(novo);
});

app.delete('/api/avisos/:id', auth, (req, res) => {
  let avisos = getAvisos();
  const aviso = avisos.find(a => a.id === req.params.id);
  if (!aviso) return res.status(404).json({ error: 'Aviso não encontrado' });
  if (aviso.email !== req.user.email)
    return res.status(403).json({ error: 'Você só pode excluir seus próprios avisos' });

  saveAvisos(avisos.filter(a => a.id !== req.params.id));
  res.json({ ok: true });
});

// Rotas SPA — qualquer rota não-API devolve o HTML correspondente
app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/callback', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'callback.html')));
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
