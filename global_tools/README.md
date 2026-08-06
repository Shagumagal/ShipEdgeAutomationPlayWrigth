# 🛠️ Herramientas Globales de IA — Shipedge Toolkit

Esta carpeta contiene los instaladores y plugins globales que potencian a **Gideon QA** en el IDE de Antigravity.

---

## 📦 Los Dos Scripts

### 1. `install_ai_toolkit.sh` — Scope: MÁQUINA
Instala las herramientas de IA en tu Mac y actualiza el plugin de Antigravity.

**Cuándo correrlo:**
- Primera vez que configuras tu Mac.
- Cuando se anuncien nuevas skills o actualizaciones (`git pull` + volver a correr).

```bash
./global_tools/install_ai_toolkit.sh
```

**Qué instala:**
- `tessl` — Contexto inteligente del repositorio para generar código limpio.
- `graphify` — Grafo de dependencias del código fuente.
- Plugin de Antigravity con todas las Skills (Mirror Update automático).

---

### 2. `setup_project.sh` — Scope: REPOSITORIO
Prepara un repositorio específico para trabajar con Gideon.

**Cuándo correrlo:**
- Una vez por cada repositorio que clones en tu Mac.

```bash
cd ~/Projects/x5.xenvio
~/Projects/ai-toolkit/global_tools/setup_project.sh
```

**Qué configura:**
- Git hook `post-merge`: Graphify se actualiza automáticamente con cada `git pull`.
- Carpeta `.gideon/` con subdirectorios para sesiones de auth, grafos, matrices y reportes.
- Entradas en `.gitignore` para que los archivos locales de Gideon nunca se suban al repo.

---

## 🚀 Flujo de Onboarding (QA Nuevo)

```bash
# 1. Clonar el toolkit
git clone <repo>/ai-toolkit ~/Projects/ai-toolkit

# 2. Instalar herramientas en tu Mac (una sola vez)
~/Projects/ai-toolkit/global_tools/install_ai_toolkit.sh

# 3. Por cada proyecto que uses con Gideon:
cd ~/Projects/x5.xenvio
~/Projects/ai-toolkit/global_tools/setup_project.sh

cd ~/Projects/x5.angular
~/Projects/ai-toolkit/global_tools/setup_project.sh
```

## 🔄 Flujo de Actualización (Skills Nuevas)

```bash
cd ~/Projects/ai-toolkit
git pull
./global_tools/install_ai_toolkit.sh
# Reiniciar Antigravity IDE → listo
```
