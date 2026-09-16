const express = require('express');
const path = require('path');
const { readDb, writeDb, genId } = require('./db');
const { summarizeTranscript } = require('./summarizer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' })); // transcriptions parfois longues
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Cabinets ----------

app.get('/api/cabinets', (req, res) => {
  const db = readDb();
  res.json(db.cabinets);
});

app.get('/api/cabinets/:id', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  res.json(cabinet);
});

app.post('/api/cabinets', (req, res) => {
  const db = readDb();
  const {
    nom, groupePilote, commercial, ctd, gestionnaire, dateDebut, notes,
  } = req.body;

  if (!nom) return res.status(400).json({ error: 'Le nom du cabinet est requis' });

  const cabinet = {
    id: genId('cab'),
    nom,
    groupePilote: groupePilote || '',
    commercial: commercial || '',
    ctd: ctd || '',
    gestionnaire: gestionnaire || '',
    dateDebut: dateDebut || null,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    jalons: [],
  };

  db.cabinets.push(cabinet);
  writeDb(db);
  res.status(201).json(cabinet);
});

app.put('/api/cabinets/:id', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });

  const fields = ['nom', 'groupePilote', 'commercial', 'ctd', 'gestionnaire', 'dateDebut', 'notes'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) cabinet[f] = req.body[f];
  });

  writeDb(db);
  res.json(cabinet);
});

app.delete('/api/cabinets/:id', (req, res) => {
  const db = readDb();
  const idx = db.cabinets.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Cabinet introuvable' });
  db.cabinets.splice(idx, 1);
  writeDb(db);
  res.status(204).end();
});

// ---------- Jalons ----------

app.post('/api/cabinets/:id/jalons', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });

  const { nom, attendu, datePrevue } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom du jalon est requis' });

  const jalon = {
    id: genId('jal'),
    nom,
    attendu: attendu || '',
    dateInitiale: datePrevue || null,
    datePrevue: datePrevue || null,
    statut: 'a_venir', // a_venir | en_cours | fait | en_retard
    historiqueDecalages: [],
    transcripts: [],
  };

  cabinet.jalons.push(jalon);
  writeDb(db);
  res.status(201).json(jalon);
});

app.put('/api/cabinets/:id/jalons/:jalonId', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const jalon = cabinet.jalons.find((j) => j.id === req.params.jalonId);
  if (!jalon) return res.status(404).json({ error: 'Jalon introuvable' });

  const fields = ['nom', 'attendu', 'statut'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) jalon[f] = req.body[f];
  });

  writeDb(db);
  res.json(jalon);
});

app.delete('/api/cabinets/:id/jalons/:jalonId', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const idx = cabinet.jalons.findIndex((j) => j.id === req.params.jalonId);
  if (idx === -1) return res.status(404).json({ error: 'Jalon introuvable' });
  cabinet.jalons.splice(idx, 1);
  writeDb(db);
  res.status(204).end();
});

// Décaler un jalon (avec historique)
app.post('/api/cabinets/:id/jalons/:jalonId/decaler', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const jalon = cabinet.jalons.find((j) => j.id === req.params.jalonId);
  if (!jalon) return res.status(404).json({ error: 'Jalon introuvable' });

  const { nouvelleDate, raison } = req.body;
  if (!nouvelleDate) return res.status(400).json({ error: 'La nouvelle date est requise' });

  jalon.historiqueDecalages.push({
    ancienneDate: jalon.datePrevue,
    nouvelleDate,
    raison: raison || '',
    decaleLe: new Date().toISOString(),
  });
  jalon.datePrevue = nouvelleDate;
  if (jalon.statut === 'en_retard') jalon.statut = 'a_venir';

  writeDb(db);
  res.json(jalon);
});

// ---------- Transcriptions & résumés ----------

app.post('/api/cabinets/:id/jalons/:jalonId/transcript', async (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const jalon = cabinet.jalons.find((j) => j.id === req.params.jalonId);
  if (!jalon) return res.status(404).json({ error: 'Jalon introuvable' });

  const { texte, date } = req.body;
  if (!texte) return res.status(400).json({ error: 'Le texte de la transcription est requis' });

  const transcript = {
    id: genId('trs'),
    date: date || new Date().toISOString(),
    texteBrut: texte,
    resume: null,
    resumeGenereAuto: false,
  };

  const result = await summarizeTranscript({
    texte,
    cabinetNom: cabinet.nom,
    jalonNom: jalon.nom,
    attendu: jalon.attendu,
  }).catch((e) => {
    console.error('Erreur inattendue lors du résumé:', e);
    return { ok: false, reason: 'exception' };
  });

  if (result.ok) {
    transcript.resume = result.resume;
    transcript.resumeGenereAuto = true;
  }

  jalon.transcripts.push(transcript);
  writeDb(db);

  res.status(201).json({ transcript, summaryStatus: result.ok ? 'ok' : result.reason });
});

// Éditer/écrire manuellement un résumé (si pas de clé API, ou pour corriger)
app.put('/api/cabinets/:id/jalons/:jalonId/transcript/:transcriptId', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const jalon = cabinet.jalons.find((j) => j.id === req.params.jalonId);
  if (!jalon) return res.status(404).json({ error: 'Jalon introuvable' });
  const transcript = jalon.transcripts.find((t) => t.id === req.params.transcriptId);
  if (!transcript) return res.status(404).json({ error: 'Transcription introuvable' });

  if (req.body.resume !== undefined) {
    transcript.resume = req.body.resume;
    transcript.resumeGenereAuto = false;
  }

  writeDb(db);
  res.json(transcript);
});

app.delete('/api/cabinets/:id/jalons/:jalonId/transcript/:transcriptId', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const jalon = cabinet.jalons.find((j) => j.id === req.params.jalonId);
  if (!jalon) return res.status(404).json({ error: 'Jalon introuvable' });
  const idx = jalon.transcripts.findIndex((t) => t.id === req.params.transcriptId);
  if (idx === -1) return res.status(404).json({ error: 'Transcription introuvable' });
  jalon.transcripts.splice(idx, 1);
  writeDb(db);
  res.status(204).end();
});

// Indique au front si le résumé auto est disponible côté serveur
app.get('/api/config', (req, res) => {
  res.json({ resumeAutoDisponible: !!process.env.ANTHROPIC_API_KEY });
});

app.listen(PORT, () => {
  console.log(`Grands comptes tracker démarré sur le port ${PORT}`);
});
