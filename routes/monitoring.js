/**
 * routes/monitoring.js - Routes de monitoring
 * 
 * Endpoints pour tester manuellement et visualiser l'état du monitoring
 * 
 * @module routes/monitoring
 */

import { Router } from 'express';
import { asyncHandler } from '../lib/utils/index.js';
import { runManualTest, PROVIDER_TESTS } from '../lib/monitoring/healthcheck.js';
import { isMailerConfigured, testSmtpConnection, sendEmail } from '../lib/utils/mailer.js';

const router = Router();

/**
 * GET /monitoring/status
 * Retourne le statut du système de monitoring
 */
router.get('/status', asyncHandler(async (req, res) => {
  // Compter les providers uniques et les critiques
  const uniqueProviders = [...new Set(PROVIDER_TESTS.map(t => t.provider))];
  const criticalProviders = PROVIDER_TESTS.filter(t => t.critical).map(t => t.provider);
  
  const status = {
    enabled: process.env.ENABLE_MONITORING === 'true',
    intervalHours: parseInt(process.env.HEALTHCHECK_INTERVAL_HOURS || '10', 10),
    providers: {
      totalTests: PROVIDER_TESTS.length,
      uniqueProviders: uniqueProviders.length,
      critical: criticalProviders,
      list: uniqueProviders
    },
    mailer: {
      configured: isMailerConfigured(),
      host: process.env.SMTP_HOST || 'non configuré',
      destination: process.env.EMAIL_DEST || 'non configuré'
    },
    testKeys: {
      rebrickable: !!process.env.TEST_REBRICKABLE_KEY,
      tmdb: !!process.env.TEST_TMDB_KEY,
      rawg: !!process.env.TEST_RAWG_KEY,
      tvdb: !!process.env.TEST_TVDB_KEY,
      googlebooks: !!process.env.TEST_GOOGLEBOOKS_KEY,
      comicvine: !!process.env.TEST_COMICVINE_KEY,
      igdb: !!(process.env.TEST_IGDB_CLIENT_ID && process.env.TEST_IGDB_CLIENT_SECRET),
      discogs: !!process.env.TEST_DISCOGS_KEY
    }
  };
  
  res.json(status);
}));

/**
 * POST /monitoring/test
 * Exécute manuellement tous les tests de monitoring
 * ⚠️ Peut prendre plusieurs minutes
 */
router.post('/test', asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  // Exécuter les tests (peut prendre du temps)
  const report = await runManualTest();
  
  res.json({
    success: report.failed === 0,
    summary: `${report.passed}/${report.total} tests réussis`,
    timestamp: report.timestamp,
    passed: report.passed,
    failed: report.failed,
    failures: report.failures.map(f => ({
      provider: f.provider,
      route: f.route,
      error: f.error,
      duration: f.duration
    })),
    // Optionnel: tous les résultats si demandé
    ...(req.query.full === 'true' ? { results: report.results } : {})
  });
}));

/**
 * POST /monitoring/test-email
 * Envoie un email de test
 */
router.post('/test-email', asyncHandler(async (req, res) => {
  if (!isMailerConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'Configuration SMTP incomplète'
    });
  }
  
  // Tester la connexion SMTP
  const smtpOk = await testSmtpConnection();
  if (!smtpOk) {
    return res.status(500).json({
      success: false,
      error: 'Connexion SMTP échouée'
    });
  }
  
  // Envoyer un email de test
  const sent = await sendEmail({
    subject: '✅ Test email - Toys API Monitoring',
    text: `Ceci est un email de test envoyé depuis Toys API.

Date: ${new Date().toLocaleString('fr-FR')}
Serveur: ${process.env.HOSTNAME || 'unknown'}

Si vous recevez cet email, la configuration SMTP est correcte.`,
    html: `
<h2>✅ Test email - Toys API Monitoring</h2>
<p>Ceci est un email de test envoyé depuis Toys API.</p>
<ul>
  <li><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</li>
  <li><strong>Serveur:</strong> ${process.env.HOSTNAME || 'unknown'}</li>
</ul>
<p>Si vous recevez cet email, la configuration SMTP est correcte.</p>
`
  });
  
  if (sent) {
    res.json({
      success: true,
      message: `Email de test envoyé à ${process.env.EMAIL_DEST}`
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Échec envoi email'
    });
  }
}));

/**
 * GET /monitoring/test/:provider
 * Teste un provider spécifique
 */
router.get('/test/:provider', asyncHandler(async (req, res) => {
  const provider = req.params.provider.toLowerCase();
  
  // Import dynamique pour éviter les dépendances circulaires
  const { PROVIDER_TESTS, runTest } = await import('../lib/monitoring/healthcheck.js');
  
  // Trouver les tests pour ce provider
  const tests = PROVIDER_TESTS?.filter(t => 
    t.provider.toLowerCase() === provider
  ) || [];
  
  if (tests.length === 0) {
    return res.status(404).json({
      error: `Provider '${provider}' non trouvé`,
      availableProviders: [...new Set((PROVIDER_TESTS || []).map(t => t.provider))]
    });
  }
  
  const results = [];
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }
  
  res.json({
    provider,
    tests: results.length,
    passed: results.filter(r => r.success).length,
    results
  });
}));

export default router;
