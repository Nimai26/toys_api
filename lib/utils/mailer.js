/**
 * lib/utils/mailer.js - Utilitaire d'envoi d'emails
 * 
 * Utilisé pour les alertes de monitoring
 * 
 * @module utils/mailer
 */

import nodemailer from 'nodemailer';
import { createLogger } from './logger.js';

const log = createLogger('Mailer');

// Configuration SMTP depuis les variables d'environnement
const SMTP_SECURITY = process.env.SMTP_SECURITY || 'starttls';
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: SMTP_SECURITY === 'ssl', // true pour 465/SSL, false pour STARTTLS
  auth: {
    user: process.env.SMTP_USERNAME || '',
    pass: process.env.SMTP_PASSWORD || ''
  },
  tls: {
    rejectUnauthorized: false, // Accepter les certificats auto-signés
    minVersion: 'TLSv1.2'      // Forcer TLS 1.2 minimum
  },
  connectionTimeout: 10000,    // 10 secondes timeout connexion
  greetingTimeout: 10000,      // 10 secondes timeout greeting
  socketTimeout: 30000         // 30 secondes timeout socket
};

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@localhost';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'Toys API';
const DEST_EMAIL = process.env.EMAIL_DEST || '';

// Créer le transporteur une seule fois
let transporter = null;

/**
 * Initialise le transporteur SMTP
 */
function getTransporter() {
  if (!transporter) {
    if (!SMTP_CONFIG.host || !SMTP_CONFIG.auth.user) {
      log.warn('Configuration SMTP incomplète - emails désactivés');
      return null;
    }
    
    transporter = nodemailer.createTransport(SMTP_CONFIG);
    log.info(`Transporteur SMTP initialisé: ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}`);
  }
  return transporter;
}

/**
 * Envoie un email
 * @param {object} options - Options de l'email
 * @param {string} options.to - Destinataire (défaut: EMAIL_DEST)
 * @param {string} options.subject - Sujet
 * @param {string} options.text - Corps texte
 * @param {string} options.html - Corps HTML (optionnel)
 * @returns {Promise<boolean>} - true si envoyé, false sinon
 */
export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter();
  
  if (!transport) {
    log.error('Transporteur SMTP non configuré');
    return false;
  }
  
  const recipient = to || DEST_EMAIL;
  if (!recipient) {
    log.error('Aucun destinataire configuré (EMAIL_DEST)');
    return false;
  }
  
  try {
    const info = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to: recipient,
      subject,
      text,
      html: html || undefined
    });
    
    log.info(`Email envoyé: ${info.messageId} → ${recipient}`);
    return true;
  } catch (err) {
    log.error(`Erreur envoi email: ${err.message}`);
    return false;
  }
}

/**
 * Envoie une alerte de monitoring
 * @param {object} report - Rapport de monitoring
 * @param {Array} report.failures - Liste des échecs
 * @param {number} report.total - Total de tests
 * @param {number} report.passed - Tests réussis
 * @param {Date} report.timestamp - Date du test
 */
export async function sendMonitoringAlert(report) {
  const { failures, total, passed, timestamp } = report;
  
  // Séparer les échecs critiques des autres
  const criticalFailures = failures.filter(f => f.critical);
  const normalFailures = failures.filter(f => !f.critical);
  
  // Sujet adapté selon la gravité
  const subject = criticalFailures.length > 0
    ? `🔴 CRITIQUE - Toys API - ${criticalFailures.length} provider(s) critique(s) en échec`
    : `⚠️ Toys API - ${failures.length} provider(s) en échec`;
  
  const formatFailure = (f, isCritical) => {
    const icon = isCritical ? '🔴' : '❌';
    const label = isCritical ? ' [CRITIQUE]' : '';
    return `${icon} ${f.provider}${label} (${f.route})\n   Erreur: ${f.error}\n   Résultats: ${f.count}`;
  };
  
  const criticalDetails = criticalFailures.length > 0
    ? `⚠️ PROVIDERS CRITIQUES:\n${criticalFailures.map(f => formatFailure(f, true)).join('\n\n')}\n\n`
    : '';
  
  const normalDetails = normalFailures.length > 0
    ? `Autres échecs:\n${normalFailures.map(f => formatFailure(f, false)).join('\n\n')}`
    : '';
  
  const failureDetails = criticalDetails + normalDetails;
  
  const text = `
🔴 ALERTE MONITORING - Toys API
================================

Date: ${timestamp.toLocaleString('fr-FR')}
Tests: ${passed}/${total} réussis
Échecs: ${failures.length}

DÉTAILS DES ÉCHECS:
${failureDetails}

---
Cet email est envoyé automatiquement par le système de monitoring.
Vérifiez les logs du conteneur pour plus de détails.
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #dc3545; color: white; padding: 15px; border-radius: 5px; }
    .header-warning { background: #ffc107; color: #333; padding: 15px; border-radius: 5px; }
    .stats { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .critical-section { background: #f8d7da; border: 2px solid #dc3545; padding: 10px; margin: 15px 0; border-radius: 5px; }
    .critical-section h3 { color: #dc3545; margin-top: 0; }
    .failure { background: #fff3cd; border-left: 4px solid #dc3545; padding: 10px; margin: 10px 0; }
    .failure-critical { background: #f8d7da; border-left: 4px solid #721c24; padding: 10px; margin: 10px 0; }
    .failure-provider { font-weight: bold; color: #dc3545; }
    .failure-error { color: #666; font-size: 0.9em; }
    .footer { color: #666; font-size: 0.8em; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="${criticalFailures.length > 0 ? 'header' : 'header-warning'}">
    <h2>${criticalFailures.length > 0 ? '🔴 ALERTE CRITIQUE' : '⚠️ ALERTE MONITORING'} - Toys API</h2>
  </div>
  
  <div class="stats">
    <p><strong>Date:</strong> ${timestamp.toLocaleString('fr-FR')}</p>
    <p><strong>Tests:</strong> ${passed}/${total} réussis</p>
    <p><strong>Échecs:</strong> ${failures.length}${criticalFailures.length > 0 ? ` (dont ${criticalFailures.length} critique(s))` : ''}</p>
  </div>
  
  ${criticalFailures.length > 0 ? `
  <div class="critical-section">
    <h3>🔴 PROVIDERS CRITIQUES EN ÉCHEC</h3>
    ${criticalFailures.map(f => `
      <div class="failure-critical">
        <p class="failure-provider">🔴 ${f.provider} [CRITIQUE] (${f.route})</p>
        <p class="failure-error">Erreur: ${f.error}</p>
        <p class="failure-error">Résultats: ${f.count}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${normalFailures.length > 0 ? `
  <h3>Autres échecs:</h3>
  ${normalFailures.map(f => `
    <div class="failure">
      <p class="failure-provider">❌ ${f.provider} (${f.route})</p>
      <p class="failure-error">Erreur: ${f.error}</p>
      <p class="failure-error">Résultats: ${f.count}</p>
    </div>
  `).join('')}
  ` : ''}
  
  <div class="footer">
    <p>Cet email est envoyé automatiquement par le système de monitoring Toys API.</p>
    <p>Vérifiez les logs du conteneur pour plus de détails.</p>
  </div>
</body>
</html>
`;

  return sendEmail({ subject, text, html });
}

/**
 * Vérifie la configuration SMTP
 * @returns {boolean} - true si configuré
 */
export function isMailerConfigured() {
  return !!(SMTP_CONFIG.host && SMTP_CONFIG.auth.user && DEST_EMAIL);
}

/**
 * Teste la connexion SMTP
 * @returns {Promise<boolean>}
 */
export async function testSmtpConnection() {
  const transport = getTransporter();
  if (!transport) return false;
  
  try {
    await transport.verify();
    log.info('Connexion SMTP vérifiée');
    return true;
  } catch (err) {
    log.error(`Échec vérification SMTP: ${err.message}`);
    return false;
  }
}

export default {
  sendEmail,
  sendMonitoringAlert,
  isMailerConfigured,
  testSmtpConnection
};
