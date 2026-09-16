let cabinets = [];
let activeCabinetId = null;
let resumeAutoDisponible = false;

const cabinetList = document.getElementById('cabinet-list');
const mainContent = document.getElementById('main-content');
const search = document.getElementById('search');

const dlgCabinet = document.getElementById('dlg-cabinet');
const formCabinet = document.getElementById('form-cabinet');
const dlgJalon = document.getElementById('dlg-jalon');
const formJalon = document.getElementById('form-jalon');
const dlgDecaler = document.getElementById('dlg-decaler');
const formDecaler = document.getElementById('form-decaler');
const dlgTranscript = document.getElementById('dlg-transcript');
const formTranscript = document.getElementById('form-transcript');

let editingCabinetId = null;
let jalonTargetCabinetId = null;
let editingJalonId = null;
let decalerTarget = null; // {cabinetId, jalonId}
let transcriptTarget = null; // {cabinetId, jalonId}

const STATUTS = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  fait: 'Fait',
  en_retard: 'En retard',
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(err.error || 'Erreur serveur');
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadConfig() {
  const cfg = await api('/api/config');
  resumeAutoDisponible = cfg.resumeAutoDisponible;
}

async function loadCabinets() {
  cabinets = await api('/api/cabinets');
  renderCabinetList();
  if (activeCabinetId) {
    const still = cabinets.find((c) => c.id === activeCabinetId);
    if (still) renderCabinetDetail(still);
    else { activeCabinetId = null; renderEmpty(); }
  }
}

function renderCabinetList() {
  const q = search.value.trim().toLowerCase();
  cabinetList.innerHTML = '';
  cabinets
    .filter((c) => c.nom.toLowerCase().includes(q))
    .forEach((c) => {
      const li = document.createElement('li');
      li.className = 'cabinet-item' + (c.id === activeCabinetId ? ' active' : '');
      const nbJalons = c.jalons.length;
      const enRetard = c.jalons.filter((j) => j.statut === 'en_retard').length;
      li.innerHTML = `
        <div class="cab-nom">${escapeHtml(c.nom)}</div>
        <div class="cab-meta">${nbJalons} jalon(s)${enRetard ? ` · ${enRetard} en retard` : ''}</div>
      `;
      li.addEventListener('click', () => {
        activeCabinetId = c.id;
        renderCabinetList();
        renderCabinetDetail(c);
      });
      cabinetList.appendChild(li);
    });
}

function renderEmpty() {
  mainContent.innerHTML = `<div class="empty-state"><p>Sélectionne un cabinet à gauche, ou crée-en un nouveau.</p></div>`;
}

function renderCabinetDetail(cabinet) {
  mainContent.innerHTML = `
    <div class="cabinet-header">
      <div class="cabinet-header-top">
        <h2>${escapeHtml(cabinet.nom)}</h2>
        <div>
          <button class="btn btn-sm" data-action="edit-cabinet">Modifier</button>
          <button class="btn btn-sm btn-danger-outline" data-action="delete-cabinet">Supprimer</button>
        </div>
      </div>
      <div class="info-grid">
        <div><div class="label">Groupe pilote</div><div class="value">${escapeHtml(cabinet.groupePilote) || '—'}</div></div>
        <div><div class="label">Commercial</div><div class="value">${escapeHtml(cabinet.commercial) || '—'}</div></div>
        <div><div class="label">CTD</div><div class="value">${escapeHtml(cabinet.ctd) || '—'}</div></div>
        <div><div class="label">Gestionnaire</div><div class="value">${escapeHtml(cabinet.gestionnaire) || '—'}</div></div>
        <div><div class="label">Date de début</div><div class="value">${formatDate(cabinet.dateDebut)}</div></div>
      </div>
      ${cabinet.notes ? `<p style="margin-top:12px;font-size:13px;color:var(--text-muted);white-space:pre-wrap;">${escapeHtml(cabinet.notes)}</p>` : ''}
    </div>

    <div class="section-title">
      <h3>Jalons du déploiement</h3>
      <button class="btn btn-primary btn-sm" data-action="add-jalon">+ Ajouter un jalon</button>
    </div>
    <div id="jalons-container"></div>
  `;

  mainContent.querySelector('[data-action="edit-cabinet"]').addEventListener('click', () => openCabinetDialog(cabinet));
  mainContent.querySelector('[data-action="delete-cabinet"]').addEventListener('click', () => deleteCabinet(cabinet.id));
  mainContent.querySelector('[data-action="add-jalon"]').addEventListener('click', () => openJalonDialog(cabinet.id));

  const container = document.getElementById('jalons-container');
  if (cabinet.jalons.length === 0) {
    container.innerHTML = `<p class="hint">Aucun jalon pour l'instant.</p>`;
  }
  cabinet.jalons.forEach((jalon) => container.appendChild(renderJalonCard(cabinet, jalon)));
}

function renderJalonCard(cabinet, jalon) {
  const div = document.createElement('div');
  div.className = 'jalon-card';
  div.innerHTML = `
    <div class="jalon-top">
      <div>
        <div class="jalon-nom">${escapeHtml(jalon.nom)}</div>
        <div class="jalon-date">Prévu le ${formatDate(jalon.datePrevue)}${jalon.historiqueDecalages.length ? ` · décalé ${jalon.historiqueDecalages.length} fois` : ''}</div>
      </div>
      <select data-action="statut" class="badge badge-${jalon.statut}" style="border:none;">
        ${Object.entries(STATUTS).map(([k, v]) => `<option value="${k}" ${k === jalon.statut ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    ${jalon.attendu ? `<div class="jalon-attendu">${escapeHtml(jalon.attendu)}</div>` : ''}
    <div class="jalon-actions">
      <button class="btn btn-sm" data-action="edit-jalon">Modifier</button>
      <button class="btn btn-sm" data-action="decaler">Décaler</button>
      <button class="btn btn-sm" data-action="transcript">+ Déposer une transcription</button>
      <button class="btn btn-sm btn-danger-outline" data-action="delete-jalon">Supprimer</button>
    </div>
    ${jalon.historiqueDecalages.length ? `<div class="historique">${jalon.historiqueDecalages.map((h) => `<div class="historique-item">↪ décalé de ${formatDate(h.ancienneDate)} à ${formatDate(h.nouvelleDate)}${h.raison ? ` — ${escapeHtml(h.raison)}` : ''}</div>`).join('')}</div>` : ''}
    <div class="transcript-list"></div>
  `;

  div.querySelector('[data-action="statut"]').addEventListener('change', (e) => updateJalonStatut(cabinet.id, jalon.id, e.target.value));
  div.querySelector('[data-action="edit-jalon"]').addEventListener('click', () => openJalonDialog(cabinet.id, jalon));
  div.querySelector('[data-action="decaler"]').addEventListener('click', () => openDecalerDialog(cabinet.id, jalon.id));
  div.querySelector('[data-action="transcript"]').addEventListener('click', () => openTranscriptDialog(cabinet.id, jalon.id));
  div.querySelector('[data-action="delete-jalon"]').addEventListener('click', () => deleteJalon(cabinet.id, jalon.id));

  const tList = div.querySelector('.transcript-list');
  jalon.transcripts.slice().reverse().forEach((t) => tList.appendChild(renderTranscriptItem(cabinet.id, jalon.id, t)));

  return div;
}

function renderTranscriptItem(cabinetId, jalonId, t) {
  const div = document.createElement('div');
  div.className = 'transcript-item';
  div.innerHTML = `
    <div class="t-date">
      <span>RDV du ${formatDate(t.date)} ${t.resume !== null ? (t.resumeGenereAuto ? '<span class="tag-auto">résumé auto</span>' : '<span class="tag-manuel">résumé manuel</span>') : ''}</span>
      <button class="btn btn-sm btn-danger-outline" data-action="delete-transcript">Supprimer</button>
    </div>
    ${t.resume !== null
      ? `<div class="t-resume">${escapeHtml(t.resume)}</div><button class="btn btn-sm" data-action="edit-resume" style="margin-top:6px;">Modifier le résumé</button>`
      : `<textarea rows="3" placeholder="Aucun résumé automatique (clé API non configurée) — écris-le ici">${escapeHtml(t.resume || '')}</textarea><button class="btn btn-sm btn-primary" data-action="save-resume" style="margin-top:6px;">Enregistrer le résumé</button>`
    }
  `;

  div.querySelector('[data-action="delete-transcript"]').addEventListener('click', () => deleteTranscript(cabinetId, jalonId, t.id));

  const editBtn = div.querySelector('[data-action="edit-resume"]');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      div.innerHTML = `
        <div class="t-date"><span>RDV du ${formatDate(t.date)}</span></div>
        <textarea rows="4">${escapeHtml(t.resume)}</textarea>
        <button class="btn btn-sm btn-primary" data-action="save-resume" style="margin-top:6px;">Enregistrer</button>
      `;
      div.querySelector('[data-action="save-resume"]').addEventListener('click', () => {
        const val = div.querySelector('textarea').value;
        saveResume(cabinetId, jalonId, t.id, val);
      });
    });
  }
  const saveBtn = div.querySelector('[data-action="save-resume"]');
  if (saveBtn && !editBtn) {
    saveBtn.addEventListener('click', () => {
      const val = div.querySelector('textarea').value;
      saveResume(cabinetId, jalonId, t.id, val);
    });
  }

  return div;
}

// ---------- Actions cabinet ----------

function openCabinetDialog(cabinet) {
  editingCabinetId = cabinet ? cabinet.id : null;
  document.getElementById('dlg-cabinet-title').textContent = cabinet ? 'Modifier le cabinet' : 'Nouveau cabinet';
  formCabinet.reset();
  if (cabinet) {
    formCabinet.nom.value = cabinet.nom || '';
    formCabinet.groupePilote.value = cabinet.groupePilote || '';
    formCabinet.commercial.value = cabinet.commercial || '';
    formCabinet.ctd.value = cabinet.ctd || '';
    formCabinet.gestionnaire.value = cabinet.gestionnaire || '';
    formCabinet.dateDebut.value = cabinet.dateDebut || '';
    formCabinet.notes.value = cabinet.notes || '';
  }
  dlgCabinet.showModal();
}

document.getElementById('btn-new-cabinet').addEventListener('click', () => openCabinetDialog(null));

formCabinet.addEventListener('submit', async () => {
  const payload = Object.fromEntries(new FormData(formCabinet).entries());
  try {
    if (editingCabinetId) {
      await api(`/api/cabinets/${editingCabinetId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/cabinets', { method: 'POST', body: JSON.stringify(payload) });
    }
    await loadCabinets();
  } catch (e) { alert(e.message); }
});

async function deleteCabinet(id) {
  if (!confirm('Supprimer ce cabinet et tous ses jalons ?')) return;
  await api(`/api/cabinets/${id}`, { method: 'DELETE' });
  if (activeCabinetId === id) activeCabinetId = null;
  await loadCabinets();
  renderEmpty();
}

// ---------- Actions jalon ----------

function openJalonDialog(cabinetId, jalon) {
  jalonTargetCabinetId = cabinetId;
  editingJalonId = jalon ? jalon.id : null;
  document.getElementById('dlg-jalon-title').textContent = jalon ? 'Modifier le jalon' : 'Nouveau jalon';
  formJalon.reset();
  if (jalon) {
    formJalon.nom.value = jalon.nom || '';
    formJalon.attendu.value = jalon.attendu || '';
    formJalon.datePrevue.value = jalon.datePrevue || '';
  }
  dlgJalon.showModal();
}

formJalon.addEventListener('submit', async () => {
  const payload = Object.fromEntries(new FormData(formJalon).entries());
  try {
    if (editingJalonId) {
      await api(`/api/cabinets/${jalonTargetCabinetId}/jalons/${editingJalonId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api(`/api/cabinets/${jalonTargetCabinetId}/jalons`, { method: 'POST', body: JSON.stringify(payload) });
    }
    await loadCabinets();
  } catch (e) { alert(e.message); }
});

async function updateJalonStatut(cabinetId, jalonId, statut) {
  await api(`/api/cabinets/${cabinetId}/jalons/${jalonId}`, { method: 'PUT', body: JSON.stringify({ statut }) });
  await loadCabinets();
}

async function deleteJalon(cabinetId, jalonId) {
  if (!confirm('Supprimer ce jalon ?')) return;
  await api(`/api/cabinets/${cabinetId}/jalons/${jalonId}`, { method: 'DELETE' });
  await loadCabinets();
}

// ---------- Décaler ----------

function openDecalerDialog(cabinetId, jalonId) {
  decalerTarget = { cabinetId, jalonId };
  formDecaler.reset();
  dlgDecaler.showModal();
}

formDecaler.addEventListener('submit', async () => {
  const payload = Object.fromEntries(new FormData(formDecaler).entries());
  try {
    await api(`/api/cabinets/${decalerTarget.cabinetId}/jalons/${decalerTarget.jalonId}/decaler`, {
      method: 'POST', body: JSON.stringify(payload),
    });
    await loadCabinets();
  } catch (e) { alert(e.message); }
});

// ---------- Transcription ----------

function openTranscriptDialog(cabinetId, jalonId) {
  transcriptTarget = { cabinetId, jalonId };
  formTranscript.reset();
  document.getElementById('transcript-hint').textContent = resumeAutoDisponible
    ? 'Un résumé sera généré automatiquement à l\'envoi.'
    : 'Pas de résumé automatique configuré — tu pourras écrire le résumé toi-même juste après.';
  dlgTranscript.showModal();
}

formTranscript.addEventListener('submit', async () => {
  const payload = Object.fromEntries(new FormData(formTranscript).entries());
  const submitBtn = formTranscript.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi...';
  try {
    await api(`/api/cabinets/${transcriptTarget.cabinetId}/jalons/${transcriptTarget.jalonId}/transcript`, {
      method: 'POST', body: JSON.stringify(payload),
    });
    await loadCabinets();
  } catch (e) { alert(e.message); }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Envoyer';
});

async function saveResume(cabinetId, jalonId, transcriptId, resume) {
  await api(`/api/cabinets/${cabinetId}/jalons/${jalonId}/transcript/${transcriptId}`, {
    method: 'PUT', body: JSON.stringify({ resume }),
  });
  await loadCabinets();
}

async function deleteTranscript(cabinetId, jalonId, transcriptId) {
  if (!confirm('Supprimer cette transcription et son résumé ?')) return;
  await api(`/api/cabinets/${cabinetId}/jalons/${jalonId}/transcript/${transcriptId}`, { method: 'DELETE' });
  await loadCabinets();
}

// ---------- Utilitaires ----------

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('dialog').close());
});

search.addEventListener('input', renderCabinetList);

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('fr-FR');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// ---------- Init ----------

(async function init() {
  await loadConfig();
  await loadCabinets();
})();
