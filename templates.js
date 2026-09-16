// Trame standard "beeStart" du programme de déploiement bobbee.
// Les dates ne sont pas incluses : elles se règlent cabinet par cabinet
// via le bouton "Décaler" une fois le jalon créé.

const BEESTART_TEMPLATE = [
  {
    nom: 'Réunion de lancement',
    attendu:
      'Format : 2h, distanciel — Cadrage de projet\n' +
      '- Rappel du pourquoi du projet\n' +
      '- KPI / métriques suivis\n' +
      '- Outils à disposition (bobbee ready, eLearning)\n' +
      '- Présentation de bobbee\n' +
      '- Calendrier / étapes',
  },
  {
    nom: 'Point technique',
    attendu:
      'Format : 2h — Cadrage technique\n' +
      '- Valider la procédure de RDD\n' +
      '- Vérifier le processus d\'intégration des relevés bancaires',
  },
  {
    nom: 'bobbee — Prise en main (eLearning)',
    attendu:
      'Acculturer à l\'utilisation pour finir la maîtrise de la production comptable\n' +
      '- Parcours eLearning fondamentaux\n' +
      '- Collaborer avec les clients de niveau Standard (profil Arthur)\n' +
      '⚠ Plateforme ouverte tout au long du cycle beeStart',
  },
  {
    nom: 'Sessions d\'accompagnement',
    attendu:
      'Format : 2h — 10 sessions\n' +
      'Valider l\'acquisition des compétences tout au long du projet : création dossiers, ' +
      'reprise données, paramétrage, maîtrise de la production comptable, TVA, révision, liasse.',
  },
  {
    nom: 'Session de suivi',
    attendu:
      'Format : 1h — 10 sessions, assurées par le gestionnaire de compte\n' +
      '- Point sur les difficultés rencontrées\n' +
      '- Retour sur les nouveautés livrées\n' +
      '- Présentation de la roadmap à venir',
  },
  {
    nom: 'Entretien de fin de phase',
    attendu:
      'Format : 3h, sur site — Bilan du test réalisé\n' +
      '- Retour sur les KPI définis lors du lancement\n' +
      '- Si ok, projection sur le déploiement à l\'échelle du Cabinet/AGC',
  },
];

module.exports = { BEESTART_TEMPLATE };
