#!/bin/bash
# =============================================================
# setup_project.sh — Inicializador de Repositorio para Gideon
# Scope: REPOSITORIO — Correr una vez por repo clonado en esta Mac
# Uso: Desde dentro del repo → <ruta-ai-toolkit>/global_tools/setup_project.sh
# =============================================================
set -e

REPO_DIR="$(pwd)"
REPO_NAME="$(basename "$REPO_DIR")"
GIT_HOOKS_DIR="$REPO_DIR/.git/hooks"
GIDEON_GITIGNORE_MARKER="# Gideon QA — archivos locales"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Shipedge Gideon — Setup de Repositorio    ║"
echo "║   Repo: $REPO_NAME"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Verificar que estamos en un repo git ─────────────────────
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "❌ Este directorio no es un repositorio git."
    echo "   Ejecuta este script desde la raíz de un repositorio clonado."
    exit 1
fi

# ─── 1. Instalar Git Hook: post-merge ─────────────────────────
echo "▶ [1/3] Instalando git hook post-merge (auto-graphify)..."

cat > "$GIT_HOOKS_DIR/post-merge" << 'EOF'
#!/bin/bash
# Hook: post-merge — Auto-actualiza el grafo de Graphify tras git pull
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if command -v graphify &> /dev/null; then
    echo "🔄 Gideon: Actualizando grafo de dependencias..."
    graphify . --output .graphify/ > /dev/null 2>&1 &
    echo "✔ Graphify corriendo en background (PID: $!)"
fi
EOF

chmod +x "$GIT_HOOKS_DIR/post-merge"
echo "  ✔ Hook post-merge instalado"

# ─── 2. Crear estructura de carpetas Gideon ───────────────────
echo ""
echo "▶ [2/3] Creando estructura de carpetas Gideon..."

mkdir -p "$REPO_DIR/.gideon/.auth"
mkdir -p "$REPO_DIR/.gideon/.graphify"
mkdir -p "$REPO_DIR/.gideon/matrices"
mkdir -p "$REPO_DIR/.gideon/reports"
echo "  ✔ Creadas: .gideon/.auth/, .gideon/.graphify/, .gideon/matrices/, .gideon/reports/"

# ─── 3. Actualizar .gitignore ─────────────────────────────────
echo ""
echo "▶ [3/3] Actualizando .gitignore..."

GITIGNORE="$REPO_DIR/.gitignore"

if ! grep -q "$GIDEON_GITIGNORE_MARKER" "$GITIGNORE" 2>/dev/null; then
    cat >> "$GITIGNORE" << 'EOF'

# Gideon QA — archivos locales (no subir al repositorio)
.gideon/.auth/
.gideon/.graphify/
.gideon/matrices/
.gideon/reports/
.gideon/credentials.json
EOF
    echo "  ✔ Entradas de Gideon agregadas al .gitignore"
else
    echo "  ✔ .gitignore ya tiene las entradas de Gideon (sin duplicar)"
fi

# ─── Generar grafo inicial ────────────────────────────────────
echo ""
echo "▶ Generando grafo inicial de Graphify (puede tomar un momento)..."
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if command -v graphify &> /dev/null; then
    graphify . --output .gideon/.graphify/ > /dev/null 2>&1 &
    echo "  ✔ Graphify corriendo en background (PID: $!)"
else
    echo "  ⚠️  Graphify no encontrado. Corre primero: install_ai_toolkit.sh"
fi

# ─── Finalización ─────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Repo '$REPO_NAME' listo para Gideon!   ║"
echo "║                                              ║"
echo "║   Estructura creada:                         ║"
echo "║   .gideon/                                  ║"
echo "║   ├── .auth/      ← sesiones Playwright     ║"
echo "║   ├── .graphify/  ← grafo de dependencias   ║"
echo "║   ├── matrices/   ← matrices generadas      ║"
echo "║   └── reports/    ← reportes de QA          ║"
echo "║                                              ║"
echo "║   El grafo se actualizará automáticamente    ║"
echo "║   con cada 'git pull' gracias al hook.       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
