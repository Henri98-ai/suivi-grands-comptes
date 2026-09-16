// Appelle l'API Anthropic pour résumer une transcription de RDV.
// Nécessite la variable d'environnement ANTHROPIC_API_KEY sur Render.
// Si la clé n'est pas configurée, retourne null et l'utilisateur peut saisir
// le résumé manuellement depuis l'interface.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

async function summarizeTranscript({ texte, cabinetNom, jalonNom, attendu }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'no_api_key' };
  }

  const prompt = `Tu résumes une transcription de rendez-vous dans le cadre du déploiement du logiciel bobbee chez un cabinet comptable.

Cabinet : ${cabinetNom}
Jalon concerné : ${jalonNom}
Ce qui est attendu à ce jalon : ${attendu || 'non précisé'}

Consignes pour le résumé :
- 5 à 10 lignes maximum, en français, style synthétique et factuel
- Mentionne les décisions prises, les points bloquants, les actions à faire et par qui
- Signale explicitement si un point du jalon semble non couvert ou à risque
- Pas de préambule, pas de formule de politesse, va directement au résumé

Transcription brute :
"""
${texte}
"""`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('Erreur API Anthropic:', response.status, errText);
    return { ok: false, reason: 'api_error', status: response.status, detail: errText };
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) {
    return { ok: false, reason: 'empty_response' };
  }

  return { ok: true, resume: textBlock.text.trim() };
}

module.exports = { summarizeTranscript };
