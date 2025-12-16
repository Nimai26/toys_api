#!/bin/bash
set -e

# --- CHARGEMENT DES CREDENTIALS ---
CREDENTIALS_FILE="/NAS/Data/Mes Images Docker/.docker-credentials"
if [ -f "$CREDENTIALS_FILE" ]; then
    source "$CREDENTIALS_FILE"
fi

# --- CONFIGURATION ---
IMAGE_NAME="toys_api"
DOCKER_USERNAME="${DOCKER_USERNAME:-nimai24}"
README_FILE="README-dockerhub.md"

# --- EXTRACTION DE LA VERSION DEPUIS lib/config.js ---
# Cherche la constante: const API_VERSION = ... || "X.Y.Z"
VERSION=$(grep -oP 'API_VERSION\s*=.*\|\|\s*"\K[0-9]+\.[0-9]+\.[0-9]+' lib/config.js 2>/dev/null | head -1)
if [ -z "$VERSION" ]; then
    # Fallback: cherche aussi dans index.js (ancienne structure)
    VERSION=$(grep -oP 'API_VERSION\s*=\s*"\K[0-9]+\.[0-9]+\.[0-9]+' index.js 2>/dev/null | head -1)
fi

if [ -z "$VERSION" ]; then
    echo "⚠️  Version non trouvée dans lib/config.js ou index.js, utilisation de 'latest' uniquement"
    VERSION=""
fi

# --- AFFICHAGE DES INFOS ---
echo "==================================="
echo "🚀 Déploiement de $IMAGE_NAME"
if [ -n "$VERSION" ]; then
    echo "📦 Version: $VERSION"
fi
echo "==================================="
echo ""

# --- LOGIN DOCKER HUB ---
echo "Connexion à Docker Hub..."
docker login

# --- BUILD IMAGE ---
echo "Construction de l'image Docker..."
docker build -t $IMAGE_NAME .

# --- TAG & PUSH : VERSION SPÉCIFIQUE ---
if [ -n "$VERSION" ]; then
    VERSION_TAG="$DOCKER_USERNAME/$IMAGE_NAME:$VERSION"
    echo "Tagging de l'image : $VERSION_TAG"
    docker tag $IMAGE_NAME $VERSION_TAG
    
    echo "Push de l'image version $VERSION..."
    docker push $VERSION_TAG
    echo "✅ Image $VERSION_TAG poussée avec succès!"
    echo ""
fi

# --- TAG & PUSH : LATEST ---
LATEST_TAG="$DOCKER_USERNAME/$IMAGE_NAME:latest"
echo "Tagging de l'image : $LATEST_TAG"
docker tag $IMAGE_NAME $LATEST_TAG

echo "Push de l'image latest..."
docker push $LATEST_TAG
echo "✅ Image $LATEST_TAG poussée avec succès!"

# --- UPDATE README ON DOCKER HUB ---
if [ -f "$README_FILE" ]; then
    echo ""
    echo "📄 Mise à jour du README sur Docker Hub..."
    
    # Obtenir le token JWT
    TOKEN=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"username": "'"$DOCKER_USERNAME"'", "password": "'"$DOCKER_PASSWORD"'"}' \
        https://hub.docker.com/v2/users/login/ | jq -r .token)
    
    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        # Créer un fichier JSON temporaire avec le contenu du README
        TEMP_JSON=$(mktemp)
        jq -n --rawfile content "$README_FILE" '{"full_description": $content}' > "$TEMP_JSON"
        
        # Mettre à jour la description sur Docker Hub
        RESPONSE=$(curl -s -X PATCH \
            -H "Authorization: JWT $TOKEN" \
            -H "Content-Type: application/json" \
            -d @"$TEMP_JSON" \
            "https://hub.docker.com/v2/repositories/$DOCKER_USERNAME/$IMAGE_NAME/")
        
        # Nettoyer le fichier temporaire
        rm -f "$TEMP_JSON"
        
        if echo "$RESPONSE" | grep -q "full_description"; then
            echo "✅ README mis à jour sur Docker Hub!"
        else
            echo "⚠️  Échec de la mise à jour du README."
        fi
    else
        echo "⚠️  Token Docker Hub non disponible. README non mis à jour."
        echo "💡 Exportez DOCKER_PASSWORD pour activer cette fonctionnalité."
    fi
fi

# --- RÉSUMÉ FINAL ---
echo ""
echo "==========================================="
echo "📋 Images disponibles sur Docker Hub:"
echo "   - $LATEST_TAG"
if [ -n "$VERSION" ]; then
    echo "   - $VERSION_TAG"
fi
echo "==========================================="

# --- GIT PUSH VERS GITHUB ---
GITHUB_REPO="${GITHUB_REPO:-nimai24/toys_api}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

echo ""
echo "🔄 Mise à jour du dépôt GitHub..."

# Initialiser git si nécessaire
if [ ! -d ".git" ]; then
    echo "📁 Initialisation du dépôt git..."
    git init
    git branch -M "$GITHUB_BRANCH"
fi

# Configurer le remote si nécessaire
if ! git remote get-url origin &>/dev/null; then
    echo "🔗 Configuration du remote origin..."
    git remote add origin "git@github.com:$GITHUB_REPO.git"
fi

# Vérifier s'il y a des changements à commiter
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Ajout des fichiers modifiés..."
    git add -A
    
    if [ -n "$VERSION" ]; then
        COMMIT_MSG="🚀 Release v$VERSION"
    else
        COMMIT_MSG="🔄 Update $(date +%Y-%m-%d)"
    fi
    
    git commit -m "$COMMIT_MSG"
    echo "✅ Commit: $COMMIT_MSG"
else
    echo "ℹ️  Aucun changement à commiter"
fi

# Push vers GitHub
echo "📤 Push vers GitHub ($GITHUB_REPO)..."
if git push -u origin "$GITHUB_BRANCH" 2>/dev/null; then
    echo "✅ Code poussé sur GitHub!"
else
    echo "⚠️  Push échoué. Vérifiez votre clé SSH ou token GitHub."
    echo "💡 Configurez avec: git remote set-url origin git@github.com:$GITHUB_REPO.git"
fi

# Tag git si version disponible
if [ -n "$VERSION" ]; then
    if ! git tag | grep -q "^v$VERSION$"; then
        echo "🏷️  Création du tag v$VERSION..."
        git tag -a "v$VERSION" -m "Release v$VERSION"
        git push origin "v$VERSION" 2>/dev/null && echo "✅ Tag v$VERSION poussé!" || echo "⚠️  Push du tag échoué"
    else
        echo "ℹ️  Tag v$VERSION existe déjà"
    fi
fi

echo ""
echo "🎉 Déploiement terminé!"
