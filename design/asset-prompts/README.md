# 🎨 Zoom Hide — Prompts d'images (pour ChatGPT / DALL·E)

Ce dossier contient un prompt par image à générer. Objectif : un look **premium
type Supercell** (Clash Royale / Brawl Stars), cohérent sur tout le jeu.

Mascotte choisie : un **caméléon** 🦎 — il se camoufle en changeant de couleur,
exactement la mécanique de Zoom Hide.

---

## Comment procéder

1. Ouvre un fichier `NN-nom.md`, **copie-colle tout le bloc “PROMPT”** dans ChatGPT (génération d'image).
2. Génère en **1024×1024, PNG**.
3. Passe l'image dans un **background remover** en ligne (le fond est un aplat magenta `#FF00FF`, très facile à détourer).
4. Renomme le PNG détouré avec le **nom final exact** (colonne ci-dessous) et dépose-le dans **`public/assets/`**.

> ⚠️ Le fond doit rester un **aplat de couleur unie sans ombre ni dégradé** pour un détourage automatique propre. Tous les prompts le précisent déjà.

> 💡 Pour garder **le même caméléon** sur toutes les poses : génère d'abord `mascot-hero`, puis dans la même conversation demande les autres poses en disant “même personnage, même style”.

---

## Structure finale attendue

Dépose les PNG détourés ici, avec ces noms **exacts** (c'est ce que le code ira chercher) :

```
public/assets/
├── logo.png              ← emblème loupe (icône d'app / hero landing)
├── wordmark.png          ← texte "ZOOM HIDE" stylisé (optionnel)
├── mascot-hero.png       ← caméléon qui salue avec une loupe (landing)
├── mascot-win.png        ← caméléon qui célèbre (écran "trouvé !")
├── mascot-empty.png      ← caméléon perplexe (listes vides)
├── mascot-search.png     ← caméléon qui se camoufle (chargement / privé)
├── badge-perfect.png     ← badge "Cachette Parfaite" (diamant)
├── badge-easy.png        ← badge Facile (vert)
├── badge-hard.png        ← badge Difficile (orange/feu)
├── badge-legendary.png   ← badge Légendaire (violet/or)
└── star.png              ← étoile dorée (points / score)
```

| Fichier prompt | Image finale | Utilisé dans le code |
|---|---|---|
| `01-logo.md` | `logo.png` | Landing (tuile hero), favicon, partages |
| `02-wordmark.md` | `wordmark.png` | Landing (sous le logo) — optionnel |
| `03-mascot-hero.md` | `mascot-hero.png` | Landing |
| `04-mascot-win.md` | `mascot-win.png` | Écran de victoire + image de partage |
| `05-mascot-empty.md` | `mascot-empty.png` | Feed vide, leaderboard vide |
| `06-mascot-search.md` | `mascot-search.png` | Écran de déverrouillage privé / chargement |
| `07-badge-perfect.md` | `badge-perfect.png` | Reveal, leaderboard, profil cacheur |
| `08-badge-easy.md` | `badge-easy.png` | Reveal / stats cachette |
| `09-badge-hard.md` | `badge-hard.png` | Reveal / stats cachette |
| `10-badge-legendary.md` | `badge-legendary.png` | Reveal / stats cachette |
| `11-star.md` | `star.png` | Scores, leaderboard, boutons |

---

## Palette de référence (pour rester cohérent)

- Fond du jeu : navy profond `#0a1024` → `#101a38`
- Accent doré : `#ffd24a` / `#f6b81e`
- Bleu : `#4d8dff` · Violet : `#8b6cf0`
- Caméléon : vert menthe `#7fd18a` avec taches teal `#3f9e8c`

Quand toutes les images sont dans `public/assets/`, dis-le moi : je les intègre
dans le code (landing, victoire, badges, listes vides, etc.).
