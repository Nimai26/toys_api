/**
 * Routes Amazon - toys_api
 * Endpoints pour recherche et scraping Amazon multi-pays
 */

import { Router } from 'express';
import { createLogger } from '../lib/utils/logger.js';
import { metrics, addCacheHeaders, asyncHandler } from '../lib/utils/index.js';
import {
  searchAmazon,
  getAmazonProduct,
  searchAmazonByBarcode,
  searchMultiCountry as searchAmazonMultiCountry,
  comparePrices as compareAmazonPrices,
  checkVpnStatus,
  rotateVpnIp,
  getSupportedMarketplaces,
  getSupportedCategories,
  isAmazonAvailable,
  getAmazonStatus
} from '../lib/providers/amazon.js';

const router = Router();
const log = createLogger('Route:Amazon');

// -----------------------------
// Endpoints Amazon (Puppeteer Stealth + FlareSolverr fallback)
// -----------------------------

// Statut complet du provider Amazon
router.get("/status", (req, res) => {
  const status = getAmazonStatus();
  res.json({
    ...status,
    message: status.available 
      ? `Amazon disponible (${status.puppeteer.available ? 'Puppeteer Stealth' : 'FlareSolverr'})`
      : `Amazon temporairement désactivé. Retry dans ${status.retryAfter}s`
  });
});

// Recherche Amazon
router.get("/search", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const country = req.query.country || "fr";
  const category = req.query.category || null;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const max = req.query.max ? parseInt(req.query.max, 10) : 20;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazon(q, { country, category, page, limit: max });
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Détails d'un produit Amazon par ASIN
router.get("/product/:asin", asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const country = req.query.country || "fr";

  if (!asin) return res.status(400).json({ error: "ASIN requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await getAmazonProduct(asin, country);
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Recherche par code-barres (EAN/UPC)
router.get("/barcode/:code", asyncHandler(async (req, res) => {
  const { code } = req.params;
  const country = req.query.country || "fr";
  const category = req.query.category || null;

  if (!code) return res.status(400).json({ error: "Code-barres requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazonByBarcode(code, { country, category });
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Recherche multi-pays
router.get("/multi", asyncHandler(async (req, res) => {
  const q = req.query.q;
  const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk"];
  const category = req.query.category || null;

  if (!q) return res.status(400).json({ error: "paramètre 'q' manquant" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await searchAmazonMultiCountry(q, countries, { category });
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Comparaison de prix entre marketplaces
router.get("/compare/:asin", asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const countries = req.query.countries ? req.query.countries.split(",") : ["fr", "us", "uk", "de"];

  if (!asin) return res.status(400).json({ error: "ASIN requis" });

  metrics.requests.total++;
  metrics.sources.amazon.requests++;
  const result = await compareAmazonPrices(asin, countries);
  addCacheHeaders(res, 600);
  res.json(result);
}));

// Statut du VPN Amazon
router.get("/vpn/status", asyncHandler(async (req, res) => {
  const status = await checkVpnStatus();
  res.json(status);
}));

// Rotation d'IP VPN
router.post("/vpn/rotate", asyncHandler(async (req, res) => {
  const result = await rotateVpnIp();
  res.json(result);
}));

// Marketplaces et catégories supportés
router.get("/marketplaces", (req, res) => {
  res.json(getSupportedMarketplaces());
});

router.get("/categories", (req, res) => {
  res.json(getSupportedCategories());
});

export default router;
