const express = require('express');
const path = require('path');
const {
  readDb, writeDb, genId, ensureFieldsConfig,
} = require('./db');
const { summarizeTranscript } = require('./summarizer');
const { BEESTART_TEMPLATE } = require('./templates');

const app = express();
const PORT = process.env.PORT || 3000;
const VALID_FIELD_TYPES = ['text', 'textarea', 'date'];

app.use(express.json({ limit: '5mb' })); // transcriptions parfois longues
app.use(express.static(path.join(__dirname, 'public')));

function emptyValueFor(type) {
  if (type === 'date') return null;
  return '';
}

// ---------- Champs configurables (cabinet & jalon) ----------

app.get('/api/fields/:entity', (req, res) => {
  const db = ensureFieldsConfig(readDb());
  const list = db.fieldsConfig[req.params.entity];
  if (!list) return res.status(404).json({ error: 'Type de champ inconnu' });
  res.json(list);
});

app.post('/api/fields/:entity', (req, res) => {
  const db = ensureFieldsConfig(readDb());
  const list = db.fieldsConfig[req.params.entity];
  if (!list) return res.status(404).json({ error: 'Type de champ inconnu' });

  const { label } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Le libellé du champ est requis' });
  const type = VALID_FIELD_TYPES.includes(req.body.type) ? req.body.type : 'text';

  list.push({ id: genId('champ'), label: label.trim(), type });
  writeDb(db);
  res.status(201).json(list);
});

app.put('/api/fields/:entity/:fieldId', (req, res) => {
  const db = ensureFieldsConfig(readDb());
  const list = db.fieldsConfig[req.params.entity];
  if (!list) return res.status(404).json({ error: 'Type de champ inconnu' });
  const field = list.find((f) => f.id === req.params.fieldId);
  if (!field) return res.status(404).json({ error: 'Champ introuvable' });
  if (field.fixed) return res.status(400).json({ error: 'Ce champ ne peut pas être modifié' });

  if (req.body.label !== undefined) {
    if (!req.body.label.trim()) return res.status(400).json({ error: 'Le libellé ne peut pas être vide' });
    field.label = req.body.label.trim();
  }
  if (req.body.type !== undefined && VALID_FIELD_TYPES.includes(req.body.type)) {
    field.type = req.body.type;
  }

  writeDb(db);
  res.json(list);
});

app.delete('/api/fields/:entity/:fieldId', (req, res) => {
  const db = ensureFieldsConfig(readDb());
  const list = db.fieldsConfig[req.params.entity];
  if (!list) return res.status(404).json({ error: 'Type de champ inconnu' });
  const idx = list.findIndex((f) => f.id === req.params.fieldId);
  if (idx === -1) return res.status(404).json({ error: 'Champ introuvable' });
  if (list[idx].fixed) return res.status(400).json({ error: 'Ce champ ne peut pas être supprimé' });

  list.splice(idx, 1);
  writeDb(db);
  res.json(list);
});

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
  const db = ensureFieldsConfig(readDb());
  const fields = db.fieldsConfig.cabinet;

  const nom = req.body.nom && req.body.nom.trim();
  if (!nom) return res.status(400).json({ error: 'Le nom du cabinet est requis' });

  const cabinet = {
    id: genId('cab'),
    createdAt: new Date().toISOString(),
    jalons: [],
  };

  fields.forEach((f) => {
    if (f.id === 'nom') { cabinet.nom = nom; return; }
    cabinet[f.id] = req.body[f.id] !== undefined ? req.body[f.id] : emptyValueFor(f.type);
  });

  db.cabinets.push(cabinet);
  writeDb(db);
  res.status(201).json(cabinet);
});

app.put('/api/cabinets/:id', (req, res) => {
  const db = ensureFieldsConfig(readDb());
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });

  db.fieldsConfig.cabinet.forEach((f) => {
    if (req.body[f.id] !== undefined) cabinet[f.id] = req.body[f.id];
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
  const db = ensureFieldsConfig(readDb());
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });

  const fields = db.fieldsConfig.jalon;
  const nom = req.body.nom && req.body.nom.trim();
  if (!nom) return res.status(400).json({ error: 'Le nom du jalon est requis' });

  const jalon = {
    id: genId('jal'),
    dateInitiale: req.body.datePrevue || null,
    datePrevue: req.body.datePrevue || null,
    statut: 'a_venir', // a_venir | en_cours | fait | en_retard
    historiqueDecalages: [],
    transcripts: [],
  };

  fields.forEach((f) => {
    if (f.id === 'nom') { jalon.nom = nom; return; }
    jalon[f.id] = req.body[f.id] !== undefined ? req.body[f.id] : emptyValueFor(f.type);
  });

  cabinet.jalons.push(jalon);
  writeDb(db);
  res.status(201).json(jalon);
});

// Créer d'un coup les jalons de la trame standard beeStart (sans dates)
app.post('/api/cabinets/:id/jalons/appliquer-trame', (req, res) => {
  const db = readDb();
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });

  const nouveauxJalons = BEESTART_TEMPLATE.map((item) => ({
    id: genId('jal'),
    nom: item.nom,
    attendu: item.attendu,
    dateInitiale: null,
    datePrevue: null,
    statut: 'a_venir',
    historiqueDecalages: [],
    transcripts: [],
  }));

  cabinet.jalons.push(...nouveauxJalons);
  writeDb(db);
  res.status(201).json(cabinet);
});

app.put('/api/cabinets/:id/jalons/:jalonId', (req, res) => {
  const db = ensureFieldsConfig(readDb());
  const cabinet = db.cabinets.find((c) => c.id === req.params.id);
  if (!cabinet) return res.status(404).json({ error: 'Cabinet introuvable' });
  const jalon = cabinet.jalons.find((j) => j.id === req.params.jalonId);
  if (!jalon) return res.status(404).json({ error: 'Jalon introuvable' });

  db.fieldsConfig.jalon.forEach((f) => {
    if (req.body[f.id] !== undefined) jalon[f.id] = req.body[f.id];
  });
  if (req.body.statut !== undefined) jalon.statut = req.body.statut;

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
