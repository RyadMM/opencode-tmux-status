# opencode-tmux-status
<img width="436" height="30" alt="image" src="https://github.com/user-attachments/assets/e067765e-2e5e-4642-a09b-5397555ba0f0" />

**[English](README.md)**

**Un coup d'œil à votre barre de statut tmux vous dit ce que fait chaque agent [opencode](https://opencode.ai) : il travaille, il attend votre saisie, ou il a fini — sans changer de fenêtre, sans polling, sans dépendance.**

## Prérequis

- tmux ≥ 3.2
- [opencode](https://opencode.ai) ≥ 1.18
- Une Nerd Font *n'est pas* requise — les icônes ont un repli automatique (voir [Utilisation](#utilisation))

## Installation

```sh
git clone https://github.com/RyadMM/opencode-tmux-status.git
cd opencode-tmux-status && ./install.sh
tmux source-file ~/.config/tmux/tmux.conf   # ou ~/.tmux.conf
```

Redémarrez ensuite vos sessions opencode — les plugins se chargent au démarrage.

L'installateur copie le plugin dans `~/.config/opencode/plugins/`, les fichiers tmux dans `~/.config/tmux/`, et ajoute une ligne `source-file` à votre `tmux.conf`. Rien d'autre n'est touché ; le retirer, c'est un `git rm` et une ligne supprimée.

## Utilisation

Lancez opencode dans n'importe quelle fenêtre et envoyez-lui un message. Sa fenêtre affiche une icône en direct dans la barre de statut :

| État | Signification | Unicode | ASCII |
|------|---------------|:-------:|:-----:|
| `busy` | L'agent travaille | ⚡ | `~` |
| `wait` | L'agent attend votre saisie | ⚑ | `?` |
| `done` | Tour terminé | ✓ | `.` |
| `error` | Erreur de session | ✗ | `!` |

Avec une Nerd Font installée, les glyphes unicode sont automatiquement remplacés par des icônes Nerd Font équivalentes.

Le jeu d'icônes est choisi au démarrage : glyphes Nerd Font si une est installée, unicode sinon. Forcez un jeu dans votre `tmux.conf` si la détection se trompe :

```tmux
set -g @oc-icons "unicode"   # ou "nerd" / "ascii"
```

Les couleurs et glyphes vivent dans `~/.config/tmux/opencode-status.tmux` — les valeurs par défaut sont réglées pour la barre verte standard de tmux.

### Notifications

Les changements d'état jouent un bref bip système macOS (deux pour `wait`, trois pour `error`). Réglage par fenêtre :

```sh
tmux set-option -w @oc-sound 0        # couper le son d'une fenêtre (défaut : on)
tmux set-option -w @oc-sound-done 1   # aussi un bip quand un tour se termine (défaut : off)
```

### Variables d'environnement

| Variable | Effet |
|----------|-------|
| `OPENCODE_TMUX_STATUS_NO_BELL=1` | Désactive tous les bips de notification |
| `OPENCODE_TMUX_STATUS_DEBUG=1` | Journalisation verbeuse des événements dans `/tmp/oc-tmux-status.log` |

### Diagnostic

```sh
~/.config/tmux/scripts/opencode-status-doctor.sh   # états par fenêtre, liveness, fin de log
```

## Comment ça marche

Un pipeline en trois étapes — opencode émet un événement, le plugin écrit une option de fenêtre, tmux affiche l'icône.

**1. Événements → états**

| Événement opencode | État | Quand |
|--------------------|:----:|-------|
| `permission.asked` | `wait` | un outil demande votre approbation |
| outil `question` *(en cours)* | `wait` | question plan-mode / de clarification |
| `session.status busy` | `busy` | l'agent travaille |
| `session.status idle` | `done` | tour terminé |
| `session.error` | `error` | une erreur est survenue |

**2. Plugin → tmux.** Lors d'un changement d'état, le plugin écrit `@opencode-state`, `@opencode-pane` et `@opencode-pid` comme options de fenêtre.

**3. tmux → barre de statut.** `window-status-format` transforme ces options en icône colorée à côté de chaque nom de fenêtre. Formats tmux purs — zéro appel shell, redessin instantané.

**Notes de conception**

- **Changements d'état uniquement.** Un tour d'agent émet 180+ événements ; le plugin déduplique, soit ~4 appels `tmux set-option` par tour. Tout le reste n'est qu'une comparaison de chaînes.
- **Nettoyage de l'état obsolète par PID.** Un hook `pane-focus-in` efface l'icône d'une fenêtre dès que son processus opencode n'existe plus — en vérifiant le PID plutôt que `pane_current_command`, qui lit l'outil bash en cours d'exécution en plein tour et effacerait à tort l'état actif.
- Le plugin ne suit que la session à laquelle vous parlez ; les sessions cachées (génération de titre, résumés, sous-agents) ne font jamais clignoter les icônes. `wait` se déclenche aussi sur l'outil `question` bloquant, donc « l'agent attend votre saisie » est détecté même s'il s'agit d'un appel d'outil, pas d'une permission.

## Dépannage

- **Pas d'icône** — la session précède le plugin (redémarrez opencode), ou aucun message n'a été envoyé.
- **Icône figée** — mettez la fenêtre au premier plan ; le nettoyage l'efface si l'agent est parti.
- **Mauvais glyphes** — forcez `@oc-icons` comme ci-dessus.
- **Rien nulle part** — les transitions sont journalisées dans `/tmp/oc-tmux-status.log` ; lancez le doctor.

## Limites

- Les icônes s'affichent pour les fenêtres de la session tmux à laquelle vous êtes attaché (comportement standard de la liste de fenêtres).
- Plusieurs panes opencode dans une même fenêtre : le dernier actif gagne.
- Un pane déplacé vers une autre fenêtre laisse une icône obsolète sur l'ancienne jusqu'à ce que vous la mettiez au premier plan.

## Licence

[MIT](LICENSE) © Ryad Meftahi
