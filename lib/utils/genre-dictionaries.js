/**
 * lib/utils/genre-dictionaries.js - Dictionnaires de traduction des genres
 * 
 * Catégories couvertes :
 * - Films/Séries (IMDB, TMDB, TVDB)
 * - Jeux vidéo (RAWG, IGDB)
 * - Musique (Deezer, MusicBrainz)
 * - Livres (Google Books, OpenLibrary)
 * - Jeux de société
 * - Jouets
 * 
 * @module utils/genre-dictionaries
 */

// ============================================================================
// FILMS / SÉRIES (IMDB, TMDB, TVDB)
// ============================================================================

export const MEDIA_GENRES = {
  // Genres principaux
  action: { fr: 'Action', de: 'Action', es: 'Acción', it: 'Azione', pt: 'Ação' },
  adventure: { fr: 'Aventure', de: 'Abenteuer', es: 'Aventura', it: 'Avventura', pt: 'Aventura' },
  animation: { fr: 'Animation', de: 'Animation', es: 'Animación', it: 'Animazione', pt: 'Animação' },
  biography: { fr: 'Biographie', de: 'Biografie', es: 'Biografía', it: 'Biografia', pt: 'Biografia' },
  comedy: { fr: 'Comédie', de: 'Komödie', es: 'Comedia', it: 'Commedia', pt: 'Comédia' },
  crime: { fr: 'Crime', de: 'Krimi', es: 'Crimen', it: 'Crimine', pt: 'Crime' },
  documentary: { fr: 'Documentaire', de: 'Dokumentation', es: 'Documental', it: 'Documentario', pt: 'Documentário' },
  drama: { fr: 'Drame', de: 'Drama', es: 'Drama', it: 'Dramma', pt: 'Drama' },
  family: { fr: 'Famille', de: 'Familie', es: 'Familia', it: 'Famiglia', pt: 'Família' },
  fantasy: { fr: 'Fantastique', de: 'Fantasy', es: 'Fantasía', it: 'Fantasy', pt: 'Fantasia' },
  'film-noir': { fr: 'Film Noir', de: 'Film Noir', es: 'Cine Negro', it: 'Film Noir', pt: 'Film Noir' },
  history: { fr: 'Histoire', de: 'Geschichte', es: 'Historia', it: 'Storia', pt: 'História' },
  horror: { fr: 'Horreur', de: 'Horror', es: 'Terror', it: 'Horror', pt: 'Terror' },
  music: { fr: 'Musique', de: 'Musik', es: 'Música', it: 'Musica', pt: 'Música' },
  musical: { fr: 'Comédie musicale', de: 'Musical', es: 'Musical', it: 'Musical', pt: 'Musical' },
  mystery: { fr: 'Mystère', de: 'Mystery', es: 'Misterio', it: 'Mistero', pt: 'Mistério' },
  romance: { fr: 'Romance', de: 'Romantik', es: 'Romance', it: 'Romantico', pt: 'Romance' },
  'sci-fi': { fr: 'Science-Fiction', de: 'Sci-Fi', es: 'Ciencia Ficción', it: 'Fantascienza', pt: 'Ficção Científica' },
  'science fiction': { fr: 'Science-Fiction', de: 'Sci-Fi', es: 'Ciencia Ficción', it: 'Fantascienza', pt: 'Ficção Científica' },
  sport: { fr: 'Sport', de: 'Sport', es: 'Deporte', it: 'Sport', pt: 'Esporte' },
  sports: { fr: 'Sport', de: 'Sport', es: 'Deporte', it: 'Sport', pt: 'Esporte' },
  thriller: { fr: 'Thriller', de: 'Thriller', es: 'Suspense', it: 'Thriller', pt: 'Suspense' },
  war: { fr: 'Guerre', de: 'Krieg', es: 'Guerra', it: 'Guerra', pt: 'Guerra' },
  western: { fr: 'Western', de: 'Western', es: 'Western', it: 'Western', pt: 'Faroeste' },
  // Genres TV
  news: { fr: 'Actualités', de: 'Nachrichten', es: 'Noticias', it: 'Notizie', pt: 'Notícias' },
  'reality-tv': { fr: 'Télé-réalité', de: 'Reality-TV', es: 'Reality', it: 'Reality', pt: 'Reality Show' },
  reality: { fr: 'Télé-réalité', de: 'Reality-TV', es: 'Reality', it: 'Reality', pt: 'Reality Show' },
  'talk-show': { fr: 'Talk-show', de: 'Talkshow', es: 'Talk Show', it: 'Talk Show', pt: 'Talk Show' },
  'game-show': { fr: 'Jeu télévisé', de: 'Spielshow', es: 'Concurso', it: 'Game Show', pt: 'Programa de TV' },
  short: { fr: 'Court-métrage', de: 'Kurzfilm', es: 'Cortometraje', it: 'Cortometraggio', pt: 'Curta-metragem' },
  soap: { fr: 'Soap opera', de: 'Seifenoper', es: 'Telenovela', it: 'Soap opera', pt: 'Novela' },
  // Genres pour adultes
  adult: { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  erotic: { fr: 'Érotique', de: 'Erotik', es: 'Erótico', it: 'Erotico', pt: 'Erótico' },
  erotica: { fr: 'Érotique', de: 'Erotik', es: 'Erótico', it: 'Erotico', pt: 'Erótico' },
  pornographic: { fr: 'Pornographique', de: 'Pornografisch', es: 'Pornográfico', it: 'Pornografico', pt: 'Pornográfico' },
  pornography: { fr: 'Pornographie', de: 'Pornografie', es: 'Pornografía', it: 'Pornografia', pt: 'Pornografia' }
};

// ============================================================================
// JEUX VIDÉO (RAWG, IGDB, JVC)
// ============================================================================

export const VIDEOGAME_GENRES = {
  // Genres principaux
  action: { fr: 'Action', de: 'Action', es: 'Acción', it: 'Azione', pt: 'Ação' },
  adventure: { fr: 'Aventure', de: 'Abenteuer', es: 'Aventura', it: 'Avventura', pt: 'Aventura' },
  'action-adventure': { fr: 'Action-Aventure', de: 'Action-Abenteuer', es: 'Acción-Aventura', it: 'Azione-Avventura', pt: 'Ação-Aventura' },
  rpg: { fr: 'Jeu de rôle', de: 'Rollenspiel', es: 'Juego de rol', it: 'Gioco di ruolo', pt: 'RPG' },
  'role-playing': { fr: 'Jeu de rôle', de: 'Rollenspiel', es: 'Juego de rol', it: 'Gioco di ruolo', pt: 'RPG' },
  shooter: { fr: 'Tir', de: 'Shooter', es: 'Disparos', it: 'Sparatutto', pt: 'Tiro' },
  fps: { fr: 'FPS', de: 'Ego-Shooter', es: 'FPS', it: 'FPS', pt: 'FPS' },
  'first-person shooter': { fr: 'Tir à la première personne', de: 'Ego-Shooter', es: 'Disparos en primera persona', it: 'Sparatutto in prima persona', pt: 'Tiro em primeira pessoa' },
  'third-person shooter': { fr: 'Tir à la troisième personne', de: 'Third-Person-Shooter', es: 'Disparos en tercera persona', it: 'Sparatutto in terza persona', pt: 'Tiro em terceira pessoa' },
  strategy: { fr: 'Stratégie', de: 'Strategie', es: 'Estrategia', it: 'Strategia', pt: 'Estratégia' },
  'real-time strategy': { fr: 'Stratégie temps réel', de: 'Echtzeit-Strategie', es: 'Estrategia en tiempo real', it: 'Strategia in tempo reale', pt: 'Estratégia em tempo real' },
  'turn-based strategy': { fr: 'Stratégie au tour par tour', de: 'Rundenbasierte Strategie', es: 'Estrategia por turnos', it: 'Strategia a turni', pt: 'Estratégia por turnos' },
  simulation: { fr: 'Simulation', de: 'Simulation', es: 'Simulación', it: 'Simulazione', pt: 'Simulação' },
  sports: { fr: 'Sport', de: 'Sport', es: 'Deportes', it: 'Sport', pt: 'Esportes' },
  racing: { fr: 'Course', de: 'Rennen', es: 'Carreras', it: 'Corse', pt: 'Corrida' },
  puzzle: { fr: 'Puzzle', de: 'Rätsel', es: 'Puzle', it: 'Puzzle', pt: 'Puzzle' },
  platformer: { fr: 'Plateforme', de: 'Jump\'n\'Run', es: 'Plataformas', it: 'Platform', pt: 'Plataforma' },
  platform: { fr: 'Plateforme', de: 'Jump\'n\'Run', es: 'Plataformas', it: 'Platform', pt: 'Plataforma' },
  fighting: { fr: 'Combat', de: 'Kampfspiel', es: 'Lucha', it: 'Picchiaduro', pt: 'Luta' },
  arcade: { fr: 'Arcade', de: 'Arcade', es: 'Arcade', it: 'Arcade', pt: 'Arcade' },
  indie: { fr: 'Indépendant', de: 'Indie', es: 'Independiente', it: 'Indie', pt: 'Indie' },
  casual: { fr: 'Casual', de: 'Casual', es: 'Casual', it: 'Casual', pt: 'Casual' },
  mmo: { fr: 'MMO', de: 'MMO', es: 'MMO', it: 'MMO', pt: 'MMO' },
  mmorpg: { fr: 'MMORPG', de: 'MMORPG', es: 'MMORPG', it: 'MMORPG', pt: 'MMORPG' },
  survival: { fr: 'Survie', de: 'Survival', es: 'Supervivencia', it: 'Sopravvivenza', pt: 'Sobrevivência' },
  horror: { fr: 'Horreur', de: 'Horror', es: 'Terror', it: 'Horror', pt: 'Terror' },
  'survival horror': { fr: 'Survival Horror', de: 'Survival Horror', es: 'Terror de supervivencia', it: 'Survival Horror', pt: 'Terror de sobrevivência' },
  sandbox: { fr: 'Bac à sable', de: 'Sandbox', es: 'Sandbox', it: 'Sandbox', pt: 'Sandbox' },
  'open world': { fr: 'Monde ouvert', de: 'Open World', es: 'Mundo abierto', it: 'Mondo aperto', pt: 'Mundo aberto' },
  stealth: { fr: 'Infiltration', de: 'Stealth', es: 'Sigilo', it: 'Stealth', pt: 'Furtivo' },
  'hack and slash': { fr: 'Hack\'n\'Slash', de: 'Hack\'n\'Slay', es: 'Hack and slash', it: 'Hack and slash', pt: 'Hack and slash' },
  'beat em up': { fr: 'Beat\'em up', de: 'Beat\'em up', es: 'Beat\'em up', it: 'Beat\'em up', pt: 'Beat\'em up' },
  metroidvania: { fr: 'Metroidvania', de: 'Metroidvania', es: 'Metroidvania', it: 'Metroidvania', pt: 'Metroidvania' },
  roguelike: { fr: 'Roguelike', de: 'Roguelike', es: 'Roguelike', it: 'Roguelike', pt: 'Roguelike' },
  roguelite: { fr: 'Roguelite', de: 'Roguelite', es: 'Roguelite', it: 'Roguelite', pt: 'Roguelite' },
  'visual novel': { fr: 'Visual Novel', de: 'Visual Novel', es: 'Novela visual', it: 'Visual Novel', pt: 'Visual Novel' },
  'tower defense': { fr: 'Tower Defense', de: 'Tower Defense', es: 'Defensa de torres', it: 'Tower Defense', pt: 'Tower Defense' },
  'battle royale': { fr: 'Battle Royale', de: 'Battle Royale', es: 'Battle Royale', it: 'Battle Royale', pt: 'Battle Royale' },
  // Genres pour adultes
  adult: { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  erotic: { fr: 'Érotique', de: 'Erotik', es: 'Erótico', it: 'Erotico', pt: 'Erótico' },
  hentai: { fr: 'Hentai', de: 'Hentai', es: 'Hentai', it: 'Hentai', pt: 'Hentai' },
  mature: { fr: 'Mature', de: 'Erwachsen', es: 'Maduro', it: 'Maturo', pt: 'Maduro' },
  nsfw: { fr: 'NSFW', de: 'NSFW', es: 'NSFW', it: 'NSFW', pt: 'NSFW' }
};

// ============================================================================
// MUSIQUE (Deezer, MusicBrainz, Discogs)
// ============================================================================

export const MUSIC_GENRES = {
  // Genres principaux
  rock: { fr: 'Rock', de: 'Rock', es: 'Rock', it: 'Rock', pt: 'Rock' },
  pop: { fr: 'Pop', de: 'Pop', es: 'Pop', it: 'Pop', pt: 'Pop' },
  'hip-hop': { fr: 'Hip-hop', de: 'Hip-Hop', es: 'Hip-hop', it: 'Hip-hop', pt: 'Hip-hop' },
  'hip hop': { fr: 'Hip-hop', de: 'Hip-Hop', es: 'Hip-hop', it: 'Hip-hop', pt: 'Hip-hop' },
  rap: { fr: 'Rap', de: 'Rap', es: 'Rap', it: 'Rap', pt: 'Rap' },
  jazz: { fr: 'Jazz', de: 'Jazz', es: 'Jazz', it: 'Jazz', pt: 'Jazz' },
  blues: { fr: 'Blues', de: 'Blues', es: 'Blues', it: 'Blues', pt: 'Blues' },
  classical: { fr: 'Classique', de: 'Klassik', es: 'Clásica', it: 'Classica', pt: 'Clássica' },
  electronic: { fr: 'Électronique', de: 'Elektronisch', es: 'Electrónica', it: 'Elettronica', pt: 'Eletrônica' },
  electro: { fr: 'Électro', de: 'Elektro', es: 'Electro', it: 'Elettro', pt: 'Electro' },
  dance: { fr: 'Dance', de: 'Dance', es: 'Dance', it: 'Dance', pt: 'Dance' },
  house: { fr: 'House', de: 'House', es: 'House', it: 'House', pt: 'House' },
  techno: { fr: 'Techno', de: 'Techno', es: 'Techno', it: 'Techno', pt: 'Techno' },
  trance: { fr: 'Trance', de: 'Trance', es: 'Trance', it: 'Trance', pt: 'Trance' },
  'drum and bass': { fr: 'Drum and Bass', de: 'Drum and Bass', es: 'Drum and Bass', it: 'Drum and Bass', pt: 'Drum and Bass' },
  dubstep: { fr: 'Dubstep', de: 'Dubstep', es: 'Dubstep', it: 'Dubstep', pt: 'Dubstep' },
  metal: { fr: 'Metal', de: 'Metal', es: 'Metal', it: 'Metal', pt: 'Metal' },
  'heavy metal': { fr: 'Heavy Metal', de: 'Heavy Metal', es: 'Heavy Metal', it: 'Heavy Metal', pt: 'Heavy Metal' },
  punk: { fr: 'Punk', de: 'Punk', es: 'Punk', it: 'Punk', pt: 'Punk' },
  'punk rock': { fr: 'Punk Rock', de: 'Punkrock', es: 'Punk Rock', it: 'Punk Rock', pt: 'Punk Rock' },
  alternative: { fr: 'Alternatif', de: 'Alternative', es: 'Alternativo', it: 'Alternativo', pt: 'Alternativo' },
  indie: { fr: 'Indie', de: 'Indie', es: 'Indie', it: 'Indie', pt: 'Indie' },
  folk: { fr: 'Folk', de: 'Folk', es: 'Folk', it: 'Folk', pt: 'Folk' },
  country: { fr: 'Country', de: 'Country', es: 'Country', it: 'Country', pt: 'Country' },
  reggae: { fr: 'Reggae', de: 'Reggae', es: 'Reggae', it: 'Reggae', pt: 'Reggae' },
  soul: { fr: 'Soul', de: 'Soul', es: 'Soul', it: 'Soul', pt: 'Soul' },
  funk: { fr: 'Funk', de: 'Funk', es: 'Funk', it: 'Funk', pt: 'Funk' },
  'r&b': { fr: 'R&B', de: 'R&B', es: 'R&B', it: 'R&B', pt: 'R&B' },
  rnb: { fr: 'R&B', de: 'R&B', es: 'R&B', it: 'R&B', pt: 'R&B' },
  disco: { fr: 'Disco', de: 'Disco', es: 'Disco', it: 'Disco', pt: 'Disco' },
  gospel: { fr: 'Gospel', de: 'Gospel', es: 'Gospel', it: 'Gospel', pt: 'Gospel' },
  latin: { fr: 'Latino', de: 'Latin', es: 'Latino', it: 'Latino', pt: 'Latino' },
  salsa: { fr: 'Salsa', de: 'Salsa', es: 'Salsa', it: 'Salsa', pt: 'Salsa' },
  world: { fr: 'Musique du monde', de: 'Weltmusik', es: 'Música del mundo', it: 'World Music', pt: 'Música do mundo' },
  'world music': { fr: 'Musique du monde', de: 'Weltmusik', es: 'Música del mundo', it: 'World Music', pt: 'Música do mundo' },
  soundtrack: { fr: 'Bande originale', de: 'Soundtrack', es: 'Banda sonora', it: 'Colonna sonora', pt: 'Trilha sonora' },
  'film score': { fr: 'Musique de film', de: 'Filmmusik', es: 'Música de película', it: 'Colonna sonora', pt: 'Trilha de filme' },
  ambient: { fr: 'Ambient', de: 'Ambient', es: 'Ambient', it: 'Ambient', pt: 'Ambient' },
  'new age': { fr: 'New Age', de: 'New Age', es: 'New Age', it: 'New Age', pt: 'New Age' },
  opera: { fr: 'Opéra', de: 'Oper', es: 'Ópera', it: 'Opera', pt: 'Ópera' },
  chanson: { fr: 'Chanson française', de: 'Chanson', es: 'Canción francesa', it: 'Chanson', pt: 'Chanson' },
  schlager: { fr: 'Variété allemande', de: 'Schlager', es: 'Schlager', it: 'Schlager', pt: 'Schlager' },
  // Adulte
  adult: { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  explicit: { fr: 'Explicite', de: 'Explizit', es: 'Explícito', it: 'Esplicito', pt: 'Explícito' }
};

// ============================================================================
// LIVRES (Google Books, OpenLibrary)
// ============================================================================

export const BOOK_GENRES = {
  // Fiction
  fiction: { fr: 'Fiction', de: 'Belletristik', es: 'Ficción', it: 'Narrativa', pt: 'Ficção' },
  'literary fiction': { fr: 'Fiction littéraire', de: 'Literarische Fiktion', es: 'Ficción literaria', it: 'Narrativa letteraria', pt: 'Ficção literária' },
  'science fiction': { fr: 'Science-Fiction', de: 'Science-Fiction', es: 'Ciencia ficción', it: 'Fantascienza', pt: 'Ficção científica' },
  fantasy: { fr: 'Fantasy', de: 'Fantasy', es: 'Fantasía', it: 'Fantasy', pt: 'Fantasia' },
  mystery: { fr: 'Mystère', de: 'Krimi', es: 'Misterio', it: 'Giallo', pt: 'Mistério' },
  thriller: { fr: 'Thriller', de: 'Thriller', es: 'Thriller', it: 'Thriller', pt: 'Thriller' },
  horror: { fr: 'Horreur', de: 'Horror', es: 'Terror', it: 'Horror', pt: 'Terror' },
  romance: { fr: 'Romance', de: 'Liebesroman', es: 'Romance', it: 'Rosa', pt: 'Romance' },
  'historical fiction': { fr: 'Roman historique', de: 'Historischer Roman', es: 'Ficción histórica', it: 'Romanzo storico', pt: 'Ficção histórica' },
  adventure: { fr: 'Aventure', de: 'Abenteuer', es: 'Aventura', it: 'Avventura', pt: 'Aventura' },
  crime: { fr: 'Policier', de: 'Krimi', es: 'Novela negra', it: 'Giallo', pt: 'Policial' },
  detective: { fr: 'Policier', de: 'Detektivroman', es: 'Novela detectivesca', it: 'Giallo', pt: 'Detetive' },
  western: { fr: 'Western', de: 'Western', es: 'Western', it: 'Western', pt: 'Faroeste' },
  // Non-fiction
  'non-fiction': { fr: 'Non-fiction', de: 'Sachbuch', es: 'No ficción', it: 'Saggistica', pt: 'Não-ficção' },
  nonfiction: { fr: 'Non-fiction', de: 'Sachbuch', es: 'No ficción', it: 'Saggistica', pt: 'Não-ficção' },
  biography: { fr: 'Biographie', de: 'Biografie', es: 'Biografía', it: 'Biografia', pt: 'Biografia' },
  autobiography: { fr: 'Autobiographie', de: 'Autobiografie', es: 'Autobiografía', it: 'Autobiografia', pt: 'Autobiografia' },
  memoir: { fr: 'Mémoires', de: 'Memoiren', es: 'Memorias', it: 'Memorie', pt: 'Memórias' },
  history: { fr: 'Histoire', de: 'Geschichte', es: 'Historia', it: 'Storia', pt: 'História' },
  science: { fr: 'Sciences', de: 'Wissenschaft', es: 'Ciencia', it: 'Scienza', pt: 'Ciência' },
  philosophy: { fr: 'Philosophie', de: 'Philosophie', es: 'Filosofía', it: 'Filosofia', pt: 'Filosofia' },
  psychology: { fr: 'Psychologie', de: 'Psychologie', es: 'Psicología', it: 'Psicologia', pt: 'Psicologia' },
  'self-help': { fr: 'Développement personnel', de: 'Selbsthilfe', es: 'Autoayuda', it: 'Self-help', pt: 'Autoajuda' },
  business: { fr: 'Business', de: 'Wirtschaft', es: 'Negocios', it: 'Business', pt: 'Negócios' },
  economics: { fr: 'Économie', de: 'Wirtschaft', es: 'Economía', it: 'Economia', pt: 'Economia' },
  politics: { fr: 'Politique', de: 'Politik', es: 'Política', it: 'Politica', pt: 'Política' },
  travel: { fr: 'Voyage', de: 'Reise', es: 'Viajes', it: 'Viaggi', pt: 'Viagem' },
  cooking: { fr: 'Cuisine', de: 'Kochen', es: 'Cocina', it: 'Cucina', pt: 'Culinária' },
  art: { fr: 'Art', de: 'Kunst', es: 'Arte', it: 'Arte', pt: 'Arte' },
  photography: { fr: 'Photographie', de: 'Fotografie', es: 'Fotografía', it: 'Fotografia', pt: 'Fotografia' },
  religion: { fr: 'Religion', de: 'Religion', es: 'Religión', it: 'Religione', pt: 'Religião' },
  spirituality: { fr: 'Spiritualité', de: 'Spiritualität', es: 'Espiritualidad', it: 'Spiritualità', pt: 'Espiritualidade' },
  // Jeunesse
  'children\'s': { fr: 'Jeunesse', de: 'Kinderbuch', es: 'Infantil', it: 'Per bambini', pt: 'Infantil' },
  children: { fr: 'Jeunesse', de: 'Kinderbuch', es: 'Infantil', it: 'Per bambini', pt: 'Infantil' },
  'young adult': { fr: 'Young Adult', de: 'Jugendbuch', es: 'Juvenil', it: 'Young Adult', pt: 'Jovem adulto' },
  // BD/Comics/Manga
  comics: { fr: 'Bande dessinée', de: 'Comics', es: 'Cómics', it: 'Fumetti', pt: 'Quadrinhos' },
  'graphic novel': { fr: 'Roman graphique', de: 'Graphic Novel', es: 'Novela gráfica', it: 'Graphic novel', pt: 'Graphic novel' },
  manga: { fr: 'Manga', de: 'Manga', es: 'Manga', it: 'Manga', pt: 'Mangá' },
  // Adulte
  adult: { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  erotic: { fr: 'Érotique', de: 'Erotik', es: 'Erótico', it: 'Erotico', pt: 'Erótico' },
  erotica: { fr: 'Érotique', de: 'Erotik', es: 'Erótico', it: 'Erotico', pt: 'Erótico' },
  'erotic romance': { fr: 'Romance érotique', de: 'Erotischer Roman', es: 'Romance erótico', it: 'Romance erotico', pt: 'Romance erótico' }
};

// ============================================================================
// JEUX DE SOCIÉTÉ (BoardGameGeek)
// ============================================================================

export const BOARDGAME_GENRES = {
  // Types de jeux
  'strategy': { fr: 'Stratégie', de: 'Strategie', es: 'Estrategia', it: 'Strategia', pt: 'Estratégia' },
  'abstract strategy': { fr: 'Stratégie abstraite', de: 'Abstrakte Strategie', es: 'Estrategia abstracta', it: 'Strategia astratta', pt: 'Estratégia abstrata' },
  'party game': { fr: 'Jeu d\'ambiance', de: 'Partyspiel', es: 'Juego de fiesta', it: 'Party game', pt: 'Jogo de festa' },
  party: { fr: 'Ambiance', de: 'Party', es: 'Fiesta', it: 'Party', pt: 'Festa' },
  'family game': { fr: 'Jeu familial', de: 'Familienspiel', es: 'Juego familiar', it: 'Gioco per famiglie', pt: 'Jogo familiar' },
  family: { fr: 'Familial', de: 'Familie', es: 'Familiar', it: 'Famiglia', pt: 'Familiar' },
  'children\'s game': { fr: 'Jeu pour enfants', de: 'Kinderspiel', es: 'Juego infantil', it: 'Gioco per bambini', pt: 'Jogo infantil' },
  'card game': { fr: 'Jeu de cartes', de: 'Kartenspiel', es: 'Juego de cartas', it: 'Gioco di carte', pt: 'Jogo de cartas' },
  'deck building': { fr: 'Deck building', de: 'Deck Building', es: 'Construcción de mazos', it: 'Deck building', pt: 'Deck building' },
  'worker placement': { fr: 'Placement d\'ouvriers', de: 'Worker Placement', es: 'Colocación de trabajadores', it: 'Piazzamento lavoratori', pt: 'Alocação de trabalhadores' },
  'area control': { fr: 'Contrôle de territoire', de: 'Gebietskontrolle', es: 'Control de área', it: 'Controllo territorio', pt: 'Controle de área' },
  'tile placement': { fr: 'Placement de tuiles', de: 'Plättchen legen', es: 'Colocación de losetas', it: 'Piazzamento tessere', pt: 'Colocação de peças' },
  'dice rolling': { fr: 'Lancer de dés', de: 'Würfelspiel', es: 'Tirada de dados', it: 'Lancio dadi', pt: 'Rolagem de dados' },
  'cooperative': { fr: 'Coopératif', de: 'Kooperativ', es: 'Cooperativo', it: 'Cooperativo', pt: 'Cooperativo' },
  'co-op': { fr: 'Coopératif', de: 'Kooperativ', es: 'Cooperativo', it: 'Cooperativo', pt: 'Cooperativo' },
  'competitive': { fr: 'Compétitif', de: 'Kompetitiv', es: 'Competitivo', it: 'Competitivo', pt: 'Competitivo' },
  'solo': { fr: 'Solo', de: 'Solo', es: 'Solitario', it: 'Solitario', pt: 'Solo' },
  'two-player': { fr: 'Deux joueurs', de: 'Zwei Spieler', es: 'Dos jugadores', it: 'Due giocatori', pt: 'Dois jogadores' },
  'trivia': { fr: 'Quiz', de: 'Quizspiel', es: 'Trivia', it: 'Quiz', pt: 'Trivia' },
  'deduction': { fr: 'Déduction', de: 'Deduktion', es: 'Deducción', it: 'Deduzione', pt: 'Dedução' },
  'bluffing': { fr: 'Bluff', de: 'Bluffen', es: 'Farol', it: 'Bluff', pt: 'Blefe' },
  'negotiation': { fr: 'Négociation', de: 'Verhandlung', es: 'Negociación', it: 'Negoziazione', pt: 'Negociação' },
  'trading': { fr: 'Commerce', de: 'Handel', es: 'Comercio', it: 'Commercio', pt: 'Comércio' },
  'economic': { fr: 'Économique', de: 'Wirtschaft', es: 'Económico', it: 'Economico', pt: 'Econômico' },
  'war game': { fr: 'Jeu de guerre', de: 'Kriegsspiel', es: 'Juego de guerra', it: 'Wargame', pt: 'Jogo de guerra' },
  'wargame': { fr: 'Jeu de guerre', de: 'Kriegsspiel', es: 'Juego de guerra', it: 'Wargame', pt: 'Jogo de guerra' },
  'miniatures': { fr: 'Figurines', de: 'Miniaturen', es: 'Miniaturas', it: 'Miniature', pt: 'Miniaturas' },
  'eurogame': { fr: 'Eurogame', de: 'Eurogame', es: 'Eurogame', it: 'Eurogame', pt: 'Eurogame' },
  'ameritrash': { fr: 'Ameritrash', de: 'Ameritrash', es: 'Ameritrash', it: 'Ameritrash', pt: 'Ameritrash' },
  'legacy': { fr: 'Legacy', de: 'Legacy', es: 'Legacy', it: 'Legacy', pt: 'Legacy' },
  'campaign': { fr: 'Campagne', de: 'Kampagne', es: 'Campaña', it: 'Campagna', pt: 'Campanha' },
  'dungeon crawler': { fr: 'Dungeon Crawler', de: 'Dungeon Crawler', es: 'Dungeon Crawler', it: 'Dungeon Crawler', pt: 'Dungeon Crawler' },
  'rpg': { fr: 'Jeu de rôle', de: 'Rollenspiel', es: 'Juego de rol', it: 'Gioco di ruolo', pt: 'RPG' },
  'role-playing': { fr: 'Jeu de rôle', de: 'Rollenspiel', es: 'Juego de rol', it: 'Gioco di ruolo', pt: 'RPG' },
  // Thèmes
  'fantasy': { fr: 'Fantasy', de: 'Fantasy', es: 'Fantasía', it: 'Fantasy', pt: 'Fantasia' },
  'science fiction': { fr: 'Science-Fiction', de: 'Science-Fiction', es: 'Ciencia ficción', it: 'Fantascienza', pt: 'Ficção científica' },
  'horror': { fr: 'Horreur', de: 'Horror', es: 'Terror', it: 'Horror', pt: 'Terror' },
  'medieval': { fr: 'Médiéval', de: 'Mittelalter', es: 'Medieval', it: 'Medievale', pt: 'Medieval' },
  'historical': { fr: 'Historique', de: 'Historisch', es: 'Histórico', it: 'Storico', pt: 'Histórico' },
  // Adulte
  'adult': { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  'mature': { fr: 'Mature', de: 'Erwachsen', es: 'Maduro', it: 'Maturo', pt: 'Maduro' }
};

// ============================================================================
// JOUETS (LEGO, Mega, etc.)
// ============================================================================

export const TOY_CATEGORIES = {
  // Types de jouets
  'building blocks': { fr: 'Blocs de construction', de: 'Bausteine', es: 'Bloques de construcción', it: 'Costruzioni', pt: 'Blocos de construção' },
  'construction': { fr: 'Construction', de: 'Konstruktion', es: 'Construcción', it: 'Costruzioni', pt: 'Construção' },
  'action figures': { fr: 'Figurines d\'action', de: 'Actionfiguren', es: 'Figuras de acción', it: 'Action figure', pt: 'Figuras de ação' },
  'dolls': { fr: 'Poupées', de: 'Puppen', es: 'Muñecas', it: 'Bambole', pt: 'Bonecas' },
  'plush': { fr: 'Peluches', de: 'Plüschtiere', es: 'Peluches', it: 'Peluche', pt: 'Pelúcias' },
  'stuffed animals': { fr: 'Peluches', de: 'Stofftiere', es: 'Animales de peluche', it: 'Peluche', pt: 'Bichos de pelúcia' },
  'vehicles': { fr: 'Véhicules', de: 'Fahrzeuge', es: 'Vehículos', it: 'Veicoli', pt: 'Veículos' },
  'cars': { fr: 'Voitures', de: 'Autos', es: 'Coches', it: 'Auto', pt: 'Carros' },
  'trains': { fr: 'Trains', de: 'Züge', es: 'Trenes', it: 'Treni', pt: 'Trens' },
  'planes': { fr: 'Avions', de: 'Flugzeuge', es: 'Aviones', it: 'Aerei', pt: 'Aviões' },
  'puzzles': { fr: 'Puzzles', de: 'Puzzles', es: 'Puzles', it: 'Puzzle', pt: 'Quebra-cabeças' },
  'educational': { fr: 'Éducatif', de: 'Lernspielzeug', es: 'Educativo', it: 'Educativo', pt: 'Educativo' },
  'outdoor': { fr: 'Extérieur', de: 'Outdoor', es: 'Exterior', it: 'Esterno', pt: 'Exterior' },
  'remote control': { fr: 'Télécommandé', de: 'Ferngesteuert', es: 'Radio control', it: 'Radiocomandato', pt: 'Controle remoto' },
  'rc': { fr: 'Télécommandé', de: 'Ferngesteuert', es: 'Radio control', it: 'Radiocomandato', pt: 'Controle remoto' },
  'electronic': { fr: 'Électronique', de: 'Elektronisch', es: 'Electrónico', it: 'Elettronico', pt: 'Eletrônico' },
  'robots': { fr: 'Robots', de: 'Roboter', es: 'Robots', it: 'Robot', pt: 'Robôs' },
  'arts & crafts': { fr: 'Loisirs créatifs', de: 'Basteln', es: 'Manualidades', it: 'Arte e artigianato', pt: 'Artes e artesanato' },
  'musical': { fr: 'Musical', de: 'Musikspielzeug', es: 'Musical', it: 'Musicale', pt: 'Musical' },
  'pretend play': { fr: 'Jeu d\'imitation', de: 'Rollenspiel', es: 'Juego simbólico', it: 'Gioco simbolico', pt: 'Faz de conta' },
  'dress up': { fr: 'Déguisement', de: 'Verkleidung', es: 'Disfraces', it: 'Travestimenti', pt: 'Fantasia' },
  'collectibles': { fr: 'Objets de collection', de: 'Sammlerstücke', es: 'Coleccionables', it: 'Collezionabili', pt: 'Colecionáveis' },
  'trading cards': { fr: 'Cartes à collectionner', de: 'Sammelkarten', es: 'Cartas coleccionables', it: 'Carte collezionabili', pt: 'Cartas colecionáveis' },
  'miniatures': { fr: 'Figurines', de: 'Miniaturen', es: 'Miniaturas', it: 'Miniature', pt: 'Miniaturas' },
  'models': { fr: 'Maquettes', de: 'Modelle', es: 'Maquetas', it: 'Modelli', pt: 'Modelos' },
  'model kits': { fr: 'Maquettes à monter', de: 'Modellbausätze', es: 'Kits de maquetas', it: 'Kit modelli', pt: 'Kits de modelos' },
  // Thèmes
  'space': { fr: 'Espace', de: 'Weltraum', es: 'Espacio', it: 'Spazio', pt: 'Espaço' },
  'castle': { fr: 'Château', de: 'Burg', es: 'Castillo', it: 'Castello', pt: 'Castelo' },
  'pirates': { fr: 'Pirates', de: 'Piraten', es: 'Piratas', it: 'Pirati', pt: 'Piratas' },
  'dinosaurs': { fr: 'Dinosaures', de: 'Dinosaurier', es: 'Dinosaurios', it: 'Dinosauri', pt: 'Dinossauros' },
  'superheroes': { fr: 'Super-héros', de: 'Superhelden', es: 'Superhéroes', it: 'Supereroi', pt: 'Super-heróis' },
  'princesses': { fr: 'Princesses', de: 'Prinzessinnen', es: 'Princesas', it: 'Principesse', pt: 'Princesas' },
  'animals': { fr: 'Animaux', de: 'Tiere', es: 'Animales', it: 'Animali', pt: 'Animais' },
  'vehicles': { fr: 'Véhicules', de: 'Fahrzeuge', es: 'Vehículos', it: 'Veicoli', pt: 'Veículos' },
  'city': { fr: 'Ville', de: 'Stadt', es: 'Ciudad', it: 'Città', pt: 'Cidade' },
  // Âge
  'baby': { fr: 'Bébé', de: 'Baby', es: 'Bebé', it: 'Neonato', pt: 'Bebê' },
  'toddler': { fr: 'Tout-petit', de: 'Kleinkind', es: 'Niño pequeño', it: 'Bambino piccolo', pt: 'Criança pequena' },
  'preschool': { fr: 'Préscolaire', de: 'Vorschule', es: 'Preescolar', it: 'Prescolare', pt: 'Pré-escolar' },
  // Adulte/Collectionneur
  'adult': { fr: 'Adulte', de: 'Erwachsene', es: 'Adulto', it: 'Adulti', pt: 'Adulto' },
  'collector': { fr: 'Collectionneur', de: 'Sammler', es: 'Coleccionista', it: 'Collezionista', pt: 'Colecionador' },
  '18+': { fr: '18+', de: '18+', es: '18+', it: '18+', pt: '18+' }
};

// ============================================================================
// FONCTION UTILITAIRE POUR ACCÉDER AUX DICTIONNAIRES
// ============================================================================

/**
 * Obtient tous les dictionnaires disponibles
 */
export const ALL_DICTIONARIES = {
  media: MEDIA_GENRES,
  videogame: VIDEOGAME_GENRES,
  music: MUSIC_GENRES,
  book: BOOK_GENRES,
  boardgame: BOARDGAME_GENRES,
  toy: TOY_CATEGORIES
};

/**
 * Recherche une traduction dans un dictionnaire spécifique
 * @param {string} term - Terme à traduire (en anglais)
 * @param {string} lang - Code langue cible (fr, de, es, it, pt)
 * @param {string} category - Catégorie de dictionnaire (media, videogame, music, book, boardgame, toy)
 * @returns {string|null} - Traduction ou null si non trouvée
 */
export function lookupInDictionary(term, lang, category = 'media') {
  if (!term || !lang || lang === 'en') return term;
  
  const dict = ALL_DICTIONARIES[category] || MEDIA_GENRES;
  const key = term.toLowerCase().trim();
  const translations = dict[key];
  
  if (translations && translations[lang]) {
    return translations[lang];
  }
  
  return null;
}

/**
 * Recherche une traduction dans tous les dictionnaires
 * @param {string} term - Terme à traduire
 * @param {string} lang - Code langue cible
 * @returns {string|null} - Traduction ou null
 */
export function lookupInAllDictionaries(term, lang) {
  if (!term || !lang || lang === 'en') return term;
  
  const key = term.toLowerCase().trim();
  
  for (const dict of Object.values(ALL_DICTIONARIES)) {
    if (dict[key] && dict[key][lang]) {
      return dict[key][lang];
    }
  }
  
  return null;
}
