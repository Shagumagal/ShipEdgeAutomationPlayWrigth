#!/bin/bash
# =============================================================
# install_ai_toolkit.sh — Instalador Global de Herramientas IA
# Scope: MÁQUINA — Correr una vez por Mac, o re-correr para actualizar
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DEST="$HOME/.gemini/config/plugins/shipedge-toolkit-plugin"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Shipedge AI Toolkit — Instalador Global    ║"
echo "║   Herramientas: Tessl + Graphify + Plugin    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── 1. Verificar dependencias base ───────────────────────────
echo "▶ [1/3] Verificando dependencias..."

if ! command -v npm &> /dev/null; then
    echo "  ❌ npm no encontrado. Instala Node.js primero: https://nodejs.org"
    exit 1
fi
echo "  ✔ npm $(npm --version)"

if ! command -v uv &> /dev/null; then
    echo "  📦 Instalando uv (gestor de paquetes Python)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
    echo "  ✔ uv instalado"
else
    echo "  ✔ uv $(uv --version)"
fi

# ─── 2. Instalar / Actualizar Tessl y Graphify ────────────────
echo ""
echo "▶ [2/3] Instalando herramientas de análisis..."

echo "  📦 Tessl CLI..."
npm install -g @tessl/cli --silent
echo "  ✔ tessl $(tessl --version 2>/dev/null || echo 'instalado')"

echo "  📦 Graphify..."
uv tool install graphifyy --quiet
export PATH="$HOME/.local/bin:$PATH"
echo "  ✔ graphify instalado"

# ─── 3. Mirror Update del Plugin en Antigravity ───────────────
echo ""
echo "▶ [3/3] Actualizando plugin en Antigravity IDE (Mirror Update)..."

if [ -d "$SCRIPT_DIR/plugin" ]; then
    rm -rf "$PLUGIN_DEST"
    mkdir -p "$PLUGIN_DEST"
    cp -r "$SCRIPT_DIR/plugin/"* "$PLUGIN_DEST/"
    echo "  ✔ Plugin actualizado en: $PLUGIN_DEST"
    echo "  📋 Skills disponibles:"
    ls "$PLUGIN_DEST/skills/" 2>/dev/null | sed 's/^/     - /'
else
    echo "  ⚠️  No se encontró la carpeta 'plugin'. Verifica la estructura."
fi

# ─── Finalización ─────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ ¡Instalación completada!                ║"
echo "║                                              ║"
echo "║   Siguiente paso si es un repo nuevo:        ║"
echo "║   cd <tu-proyecto>                           ║"
echo "║   <ruta>/setup_project.sh                   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "🔄 Para actualizar en el futuro: git pull && ./install_ai_toolkit.sh"
echo ""
