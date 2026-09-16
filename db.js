const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function defaultFieldsConfig() {
  return {
    cabinet: [
      { id: 'nom', label: 'Nom du cabinet', type: 'text', fixed: true, required: true },
      { id: 'groupePilote', label: 'Groupe pilote', type: 'text' },
      { id: 'commercial', label: 'Commercial', type: 'text' },
      { id: 'ctd', label: 'CTD', type: 'text' },
      { id: 'gestionnaire', label: 'Gestionnaire en charge', type: 'text' },
      { id: 'dateDebut', label: 'Date de début', type: 'date' },
      { id: 'notes', label: 'Notes', type: 'textarea' },
    ],
    jalon: [
      { id: 'nom', label: 'Nom du jalon', type: 'text', fixed: true, required: true },
      { id: 'attendu', label: 'Ce qui est attendu', type: 'textarea' },
    ],
  };
}

// S'assure que db.fieldsConfig existe (utile pour une base créée avant
// l'introduction des champs configurables).
function ensureFieldsConfig(db) {
  const defaults = defaultFieldsConfig();
  if (!db.fieldsConfig) db.fieldsConfig = defaults;
  if (!db.fieldsConfig.cabinet) db.fieldsConfig.cabinet = defaults.cabinet;
  if (!db.fieldsConfig.jalon) db.fieldsConfig.jalon = defaults.jalon;
  return db;
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return ensureFieldsConfig({ cabinets: [] });
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return ensureFieldsConfig(JSON.parse(raw));
  } catch (e) {
    console.error('Erreur de lecture de la base JSON, réinitialisation.', e);
    return ensureFieldsConfig({ cabinets: [] });
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  readDb, writeDb, genId, ensureFieldsConfig, defaultFieldsConfig,
};
