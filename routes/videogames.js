// routes/videogames.js - Endpoints RAWG, IGDB et JVC (toys_api v2.0.0)
import { Router } from 'express';
import {
  searchRawg,
  getRawgGameDetails
} from '../lib/providers/rawg.js';
import {
  searchIgdb,
  getIgdbGameDetails,
  parseIgdbCredentials,
  getIgdbToken
} from '../lib/providers/igdb.js';
import {
  searchJVC,
  getJVCGameById
} from '../lib/providers/jvc.js';
import { addCacheHeaders, asyncHandler, requireParam, requireApiKey, isAutoTradEnabled } from '../lib/utils/index.js';
import {
  RAWG_DEFAULT_MAX,
  RAWG_MAX_LIMIT,
  IGDB_DEFAULT_MAX,
  IGDB_MAX_LIMIT,
  JVC_DEFAULT_MAX
} from '../lib/config.js';

// ============================================================================
// RAWG Router
// ============================================================================
const rawgRouter = Router();
const rawgAuth = requireApiKey('RAWG', 'https://rawg.io/apidocs');

rawgRouter.get("/search", requireParam('q'), rawgAuth, asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = Math.min(parseInt(req.query.max, 10) || RAWG_DEFAULT_MAX, RAWG_MAX_LIMIT);
  const page = parseInt(req.query.page, 10) || 1;
  const platforms = req.query.platforms || null;
  const genres = req.query.genres || null;
  const ordering = req.query.ordering || null;
  const dates = req.query.dates || null;
  const metacritic = req.query.metacritic || null;
  
  const result = await searchRawg(query, req.apiKey, { max, page, platforms, genres, ordering, dates, metacritic });
  addCacheHeaders(res, 300);
  res.json(result);
}));

rawgRouter.get("/game/:id", rawgAuth, asyncHandler(async (req, res) => {
  const gameId = req.params.id;
  if (!gameId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || null;
  
  const result = await getRawgGameDetails(gameId, req.apiKey, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// IGDB Router
// ============================================================================
const igdbRouter = Router();
const igdbAuth = requireApiKey('IGDB', 'https://dev.twitch.tv/console/apps (format: clientId:clientSecret)');

igdbRouter.get("/search", requireParam('q'), igdbAuth, asyncHandler(async (req, res) => {
  const query = req.query.q;
  const max = Math.min(parseInt(req.query.max, 10) || IGDB_DEFAULT_MAX, IGDB_MAX_LIMIT);
  const platforms = req.query.platforms || null;
  const genres = req.query.genres || null;
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const result = await searchIgdb(query, clientId, accessToken, { max, platforms, genres });
  addCacheHeaders(res, 300);
  res.json(result);
}));

igdbRouter.get("/game/:id", igdbAuth, asyncHandler(async (req, res) => {
  const gameId = req.params.id;
  if (!gameId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  const { clientId, clientSecret } = parseIgdbCredentials(req.apiKey);
  const accessToken = await getIgdbToken(clientId, clientSecret);
  
  const autoTrad = isAutoTradEnabled(req);
  const lang = req.query.lang || null;
  
  const result = await getIgdbGameDetails(gameId, clientId, accessToken, { lang, autoTrad });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

// ============================================================================
// JVC Router (pas de clé API)
// ============================================================================
const jvcRouter = Router();

jvcRouter.get("/search", requireParam('q'), asyncHandler(async (req, res) => {
  const q = req.query.q;
  const max = req.query.max ? parseInt(req.query.max, 10) : JVC_DEFAULT_MAX;
  
  const result = await searchJVC(q, { max });
  addCacheHeaders(res, 3600);
  res.json(result);
}));

jvcRouter.get("/game/:id", asyncHandler(async (req, res) => {
  const gameId = req.params.id;
  if (!gameId) return res.status(400).json({ error: "paramètre 'id' manquant" });
  
  if (!/^\d+$/.test(gameId)) {
    return res.status(400).json({ error: "Format d'ID invalide", hint: "L'ID doit être un nombre entier" });
  }
  
  const result = await getJVCGameById(parseInt(gameId, 10));
  if (!result || !result.title) {
    return res.status(404).json({ error: `Jeu ${gameId} non trouvé` });
  }
  addCacheHeaders(res, 3600);
  res.json(result);
}));

export { rawgRouter, igdbRouter, jvcRouter };
