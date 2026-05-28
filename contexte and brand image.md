# Antares — Contexte & Brand Image

> Brief brand complet à fournir à un outil IA vidéo, un freelance vidéaste, une agence pub ou n'importe quel collaborateur pour qu'il livre une production 100 % cohérente avec l'identité Antares.

---

## 1. Contexte du projet

### Pitch en une phrase
**Extension Chrome qui scanne automatiquement chaque token Solana que tu croises sur DexScreener, pump.fun, Photon, Axiom, Birdeye, GMGN ou GeckoTerminal — et te dit en 2 secondes si c'est un scam.**

### Ce que ça fait concrètement
Tu navigues normalement sur une plateforme de trading Solana. Dès qu'une page de token s'ouvre, un overlay apparaît automatiquement en haut à droite avec :
- Un **verdict clair** : SAFE / CAUTION / DANGER / RUG
- Un **score sur 1000 points**
- Les **7 couches d'analyse** (liquidité, holders, snipers, mint authority, honeypot, etc.)
- 4 panels **Pro** au clic : Insider Watch, Buy/Sell Flow, Wash Volume, Sniper Map

Plus besoin d'aller-retour entre RugCheck + GoPlus + DexScreener + BubbleMaps. Tout est centralisé.

### Tech
À chaque scan, l'extension agrège **6 sources indépendantes** : DexScreener, RugCheck, GoPlus, Helius, Solscan, GeckoTerminal. Un scoring engine (moyenne géométrique + diminishing penalties + Safe Gate sur flags critiques) sort un verdict unique.

### Cible
Traders Solana actifs qui veulent **arrêter de se faire rug** en mémé-coins. Utilisateurs intensifs de pump.fun / Axiom / Photon qui voient des dizaines de tokens par jour.

### Pricing
- **Free** : verdict + score + overlay basique, scans illimités, pas de compte
- **Pro** : 24,99 $ / 30 jours — débloque les 4 Deep Analysis tabs + AI Summary + Critical Flags
- **Yearly** : 149,99 $ / an

Paiement crypto (NOWPayments). Aucun tracking, aucune collecte de données perso.

### Positionnement
- Pas de VC, pas de token, pas de paywall sur l'essentiel
- Anti-bullshit, technique, direct
- Live sur **antaresscan.com**

---

## 2. Palette de couleurs

### Couleur principale (brand)

| Nom | Hex | Usage |
|---|---|---|
| **Antares Green** | `#00e5b0` | Couleur primaire, CTA, accents, verdict SAFE, glow |
| Glow Green soft | `rgba(0,229,176,.12)` | Box-shadow / text-shadow halo discret |
| Glow Green strong | `rgba(0,229,176,.35)` | Drop-shadow watermark, hover focus |

### Neutres (dark theme uniquement)

| Nom | Hex | Usage |
|---|---|---|
| **Background** | `#0a0a0c` | Fond principal, full bleed |
| **Card** | `#111114` | Cartes, panels |
| **Card-2** | `#0d0d10` | Hover / variant |
| **Border** | `#1a1a1e` | Bordures fines |
| **Dim** | `#3a3a3f` | Texte secondaire désactivé |
| **Text body** | `#c8c8cc` | Texte courant |
| **Text bright** | `#eaeaea` | Texte des titres |

### Système de verdict (4 niveaux)

| Verdict | Hex | Plage de score |
|---|---|---|
| 🟢 **SAFE** | `#00e5b0` | 900-1000 |
| 🟡 **CAUTION** | `#f5d000` | 600-899 |
| 🟠 **DANGER** | `#ff5f5f` | 350-599 |
| 🔴 **RUG** | `#ff2244` | 0-349 |

### Tier Pro

| Tier | Hex |
|---|---|
| Pro (mensuel) | `#00e5b0` (green) |
| Yearly / Lifetime | `#a78bfa` (purple) |

### Stripe signature (animation top de page)

Gradient infini horizontal :
```
#c0007a → #00e5b0 → #c8c000 → #c0002a → #00e5b0 → #c0007a
```
(rose → vert → jaune → rouge → vert → rose, 6s linear infinite, opacité .7)

---

## 3. Typographie

### Display / Titles → **Bebas Neue 400**

- Condensé, sans-serif, ALL CAPS naturel
- `letter-spacing: .04em` à `.06em`
- `line-height: .88` à `.9` (tight)
- Tailles : `clamp(48px, 8vw, 100px)` pour les h1 des pages internes
- Taille hero home : `clamp(68px, 11vw, 130px)`
- Self-hosted, `font-display: swap`
- Source publique : [Google Fonts — Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue)

### Body / UI / Technique → **IBM Plex Mono**

- Monospace, weights `400` / `600` / `700`
- `letter-spacing: .04em` (body) à `.28em` (eyebrows)
- Eyebrows / labels : `font-size: 11px`, `letter-spacing: .28em`, `text-transform: uppercase`, weight 600
- Tailles body : 11-13px
- Self-hosted, `font-display: swap`
- Source publique : [Google Fonts — IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

### Hiérarchie typique

1. **Eyebrow** (au-dessus du titre) : 11px IBM Plex Mono 600, vert, ALL CAPS, letter-spacing .28em — précédé d'un trait pulsant 22→30px
2. **H1** : Bebas Neue 400, jusqu'à 100-130px, blanc cassé `#eaeaea`, avec un mot accent en vert
3. **Sub** : 13px IBM Plex Mono 400, gris `#7a7a82`, ligne verte à gauche (border-left 2px solid green) + padding-left 16px

---

## 4. Logo

### Glyphe principal
- **Symbole atome** (3 ellipses entrelacées + noyau central + glow vert subtil)
- Fichier : `/assets/icon.png` (4.7 KB)
- URL publique : https://antaresscan.com/assets/icon.png
- Taille nav : 38px de haut
- En watermark grand format : 900px, opacité .08, drop-shadow vert .35
- Couleur de base : blanc/clair sur fond sombre

### Wordmark
- Texte "ANTARES" en **Bebas Neue 400, 30px**, `letter-spacing: .18em`, couleur `#e0e0e0`
- Toujours placé après l'icône, gap 10px
- ALL CAPS systématique

### Favicon
- `/assets/favicon.png` (19.6 KB) — version + détaillée du logo
- URL publique : https://antaresscan.com/assets/favicon.png

### Open Graph image (prêt-à-partager sociaux)
- `/assets/og-image.png` (1200×630, 26.5 KB)
- `/assets/og-image.svg` (vectoriel, 6.3 KB, scalable infiniment)
- URL : https://antaresscan.com/assets/og-image.png

---

## 5. Signatures visuelles à reproduire

### 5.1. Glitch effect sur les titres
Effet RGB-split : rose `#ff006e` + vert `#00e5b0` en `::before`/`::after`, animation steppée 0.45s — bruit numérique style "scan en cours" sur hover ou reveal.

### 5.2. Glow halo sur les éléments verts
```css
text-shadow: 0 0 60px rgba(0,229,176,.15);
box-shadow: 0 0 30px rgba(0,229,176,.12), 0 0 60px rgba(0,229,176,.08);
```

### 5.3. Hover translate sur CTAs
```css
transform: translate(-2px,-2px);
box-shadow: 4px 4px 0 #fff;
```
Effet "carte qui se lève" au survol — courant sur tous les boutons primaires.

### 5.4. Pulse line sur les eyebrows
Petit trait vert 22px qui pulse en largeur (22 → 30px, animation 2s ease infinite).

### 5.5. Reveal au scroll
Opacity 0 + translateY(40px) → opacity 1 + translateY(0) quand l'élément entre dans le viewport. Easing : `cubic-bezier(.22,1,.36,1)`, durée .8s.

### 5.6. Watermark atom flottant
Sur le CTA final de la home, le logo atome :
- 900px de large, opacité .08, drop-shadow vert
- Animation float : rotation ±2°, translation ±4px, scale 1 → 1.025, loop 9s ease-in-out
- Reveal d'entrée : fade-in de 1.6s quand la section devient visible

### 5.7. CTA principal
Bouton vert `#00e5b0`, fond solide, padding 15×32px, font IBM Plex Mono 700 11px, letter-spacing .1em, ALL CAPS, box-shadow décalé `3px 3px 0 rgba(255,255,255,.8)`.

---

## 6. Tonalité / Voice

### Caractéristiques
- **Sérieux + punchy** — pas marketing-ronflant, parle aux traders
- **Technique** — chiffres précis (7 layers, 1000-point score, 6 sources, 2 seconds)
- **Anti-bullshit** — "no VC, no token, no paywall", "stop getting scammed"
- **Direct** — verbes d'action, phrases courtes, ALL CAPS pour les punchlines

### Slogans clés

| Slogan | Contexte |
|---|---|
| **"Stop getting scammed."** | Hero principal home |
| **"The next rug pull won't warn you. Antares will."** | CTA final home |
| **"Trade with the lights on."** | Closing |
| **"Two seconds · seven layers · one verdict"** | Pricing hero |
| **"No mercy for scammers."** | Footer / signature |
| **"Where Antares wins & loses"** | Compare page |
| **"7 LAYERS. 1000 POINTS."** | Engine page |

### Vocabulaire de marque (à favoriser)

- Verdict (pas "résultat")
- Scan (pas "analyse")
- Rug / rug pull (pas "arnaque")
- Detect / surface (pas "trouver")
- Risk-screening tool (pas "outil de sécurité")
- Solana token (pas "crypto" générique)
- DexScreener, pump.fun, Photon, Axiom, Birdeye, GMGN, GeckoTerminal (toujours nommer les plateformes)

---

## 7. Fichiers d'identité — chemins & URLs

### Local

```
C:\Users\lenny.pierre.ROBINDULAC\OneDrive - SHAREPOINT GROUPE COME\Bureau\antares-website\
├── assets\
│   ├── icon.png            ← logo atome principal (4.7 KB)
│   ├── favicon.png         ← favicon (19.6 KB)
│   ├── og-image.png        ← carte sociale 1200×630 (26.5 KB)
│   └── og-image.svg        ← carte sociale vectorielle (6.3 KB)
├── fonts\
│   ├── bebas-neue-400.woff2          (8.6 KB)
│   ├── ibm-plex-mono-400.woff2       (10 KB)
│   ├── ibm-plex-mono-600.woff2       (10 KB)
│   └── ibm-plex-mono-700.woff2       (10 KB)
└── css\
    ├── base.css            ← variables, fonts, nav, .shell, h1 (13.7 KB)
    ├── home-animations.css ← animations spécifiques home (3 KB)
    └── mobile-fixes.css    ← overrides mobile (31 KB)
```

### URLs publiques (à pointer dans InVideo AI / Tella / etc.)

- https://antaresscan.com/assets/icon.png
- https://antaresscan.com/assets/favicon.png
- https://antaresscan.com/assets/og-image.png
- https://antaresscan.com/assets/og-image.svg
- https://antaresscan.com/fonts/bebas-neue-400.woff2
- https://antaresscan.com/fonts/ibm-plex-mono-400.woff2
- https://antaresscan.com/fonts/ibm-plex-mono-600.woff2
- https://antaresscan.com/fonts/ibm-plex-mono-700.woff2
- https://antaresscan.com/css/base.css

---

## 8. Prompt prêt à coller dans InVideo AI / autre outil IA vidéo

```
Modern SaaS launch ad, 45 seconds, vertical 9:16 + horizontal 16:9 versions.

Dark futuristic theme — near-black background #0a0a0c, mint-green accent
#00e5b0, occasional red flash #ff2244 to signal "rug pull".

Typography:
- Bebas Neue ALL CAPS for headlines (extra-condensed, tight line-height)
- IBM Plex Mono for body text, eyebrows and technical labels
- Wide letter-spacing on eyebrows (.28em)

Brand mark: atom icon (three intersecting ellipses + central nucleus),
faint green glow halo around it.

Visual cues:
- Animated multicolor gradient stripe across the top
  (pink #c0007a → teal #00e5b0 → yellow #c8c000 → red #c0002a → teal → pink)
- Subtle RGB-split glitch on title reveals (pink/green ghosting)
- Pulsing green underline (22→30px) under section labels
- Floating atom watermark behind closing slogan, faint, slow rotation
- Verdict pill labels: SAFE green / CAUTION yellow / DANGER orange / RUG red

Tone: serious-but-punchy, direct, anti-bullshit, addressing crypto traders
who are tired of getting rugged. Technical, precise, no fluff.

Tagline options (one per scene or rotating):
- "Stop getting scammed."
- "The next rug pull won't warn you. Antares will."
- "Two seconds. Seven layers. One verdict."
- "No mercy for scammers."

Footage: crypto trading interfaces (DexScreener-style charts), blockchain
abstractions, alert overlays with green/red verdicts, candlestick charts.
No corporate stock footage, no smiling people in suits.

Outro: atom logo + "ANTARES" wordmark in Bebas Neue, fade-in with green
glow, then "INSTALL — antaresscan.com" CTA in mint-green block button.
```

---

## 9. Script suggéré pour une pub 45s

> *(voix off, IBM Plex Mono à l'écran, ton calme et déterminé)*
>
> **0:00** — *(stripe gradient animée, écran noir)*
> Every day, traders lose millions to Solana rug pulls.
>
> **0:05** — *(chart pump.fun, prix qui s'effondre, flash rouge "RUG")*
> One bad token. One missed flag. Everything gone.
>
> **0:12** — *(logo atome qui apparaît avec glitch + glow vert)*
> Antares scans every Solana token, in two seconds.
>
> **0:18** — *(split screen : DexScreener avec overlay vert SAFE 847/1000 → puis token avec overlay rouge RUG 89/1000)*
> Seven detection layers. One thousand points. One verdict.
>
> **0:26** — *(panels qui s'ouvrent : Insider Watch heatmap, Buy/Sell Flow, Wash Volume, Sniper Map)*
> Insider Watch. Buy/Sell Flow. Wash Volume. Sniper Map.
> The signals you'd never check, surfaced before your wallet signs.
>
> **0:36** — *(écran noir, logo atome flottant, big text Bebas Neue)*
> **THE NEXT RUG PULL WON'T WARN YOU.**
> **ANTARES WILL.**
>
> **0:42** — *(CTA mint-green "INSTALL — antaresscan.com")*
> Free. No account. Install in sixty seconds.

---

## 10. Don'ts (à éviter absolument dans la pub)

❌ Photos stock corporate (réunions, poignées de main, équipe diverse souriante)
❌ Couleurs hors palette (pas de bleu, pas d'orange vif, pas de violet sauf tier yearly)
❌ Sérif (Times, Georgia…) — uniquement Bebas Neue + IBM Plex Mono
❌ Sans-serif arrondi style "tech 2018" (Inter, Roboto, Poppins…) — trop générique
❌ Fond clair / dark-light toggle — l'identité est dark-only
❌ Musique épique cinématique style "trailer" — ton trop dramatique
❌ Promesses légalement risquées ("garanti zéro rug", "100 % sûr") — Antares est un outil probabiliste, jamais une garantie
❌ Mots-clés trading agressifs ("pump", "moon", "100x") — la marque est anti-hype

---

**Fichier généré le 2026-05-13 — version live sur antaresscan.com**
