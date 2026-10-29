# Organisation des assets : antipaste

Produit : AntiPaste (extension Chrome) · bibliothèque marketing : `~/dev/_Vault/AntiPaste/` · audit du 2026-10-29.
À lire avant de déplacer, renommer ou ajouter une image, une vidéo, un logo ou un texte de fiche.

## Où sont les ressources

- Icônes : `icons/`.
- Visuels du store : `~/dev/_Vault/AntiPaste/Marketing/Chrome-Web-Store/en-US/` (`Promotional-Tiles/tile-440x280.png`, `Screenshots/01-overview-1280x800.png`), migrés depuis la racine le 2026-10-29 (suppression à commiter dans ce dépôt).
- Générateurs de visuels, restés ici : `promo_generator.html`, `promo_generator_440x280.html`, `promo_generator_1280x800.html`, `promo_generator_1400x560.html`, `icon_generator.html`.
- Fiche du store : `CHROMEWEBSTORE.md`, confidentialité : `PRIVACY_POLICY.md`.
- Archives publiées : `antipaste-v*.zip` (ignorées par Git).

## À garder dans le dépôt (assets d'exécution)

- `icons/`, `onboarding.*`, `popup/`, `offscreen/` : chargés par l'extension.

## Ne pas déplacer ni restructurer sans audit des dépendances

- `promo_generator*.html`, `icon_generator.html` : chargent `icons/icon-128.png` en chemin relatif, ils doivent rester à la racine. Exporter depuis ici, puis ranger l'export dans `_Vault`.

## Exceptions constatées

- Penser à exclure `memory/`, `CLAUDE.md` et les générateurs du zip de l'extension (archive faite à la main).

## Règles durables

- Le code et les ressources nécessaires à l'exécution restent dans ce dépôt.
- Les ressources marketing indépendantes vont dans `~/dev/_Vault/AntiPaste/` (règles complètes : `~/dev/_Vault/MEMORY.md`).
- `~/dev/_Vault/_shared/` ne reçoit que ce qui sert réellement à plusieurs produits.
- Un fichier utilisé par le code, servi par URL ou écrit par un script n'est jamais déplacé ni renommé sans rechercher toutes ses références (code, CSS, HTML, scripts, `package.json`, docs, fichiers `*ignore`). Une recherche sans résultat ne prouve pas qu'il est inutilisé (chargement dynamique, URL publique) : dans le doute, il reste et on le note ici.
- Aucun fichier suivi par Git n'est sorti vers `_Vault` (non versionné : l'historique serait perdu).
- Langues dans `_Vault` : codes `fr-FR`, `en-US`, `de-DE`... uniquement pour les langues produites. Les kits générés dans le dépôt gardent leurs codes d'origine.
- Nommage : minuscules et tirets, préfixe `01-`, `02-` quand l'ordre compte, mêmes noms et même ordre entre les langues, dimensions en suffixe (`tile-440x280.png`), jamais `final`, `v2-new`, `copie`.
- Une ressource n'a qu'une copie modifiable. Toute copie volontaire est notée ici avec la copie qui fait foi.

## Ajouter une ressource marketing

1. Lue par le code, servie par le site ou produite par un script du dépôt ? Elle reste dans le dépôt, à l'emplacement listé ci-dessus.
2. Sinon : `~/dev/_Vault/AntiPaste/Brand/...` ou `~/dev/_Vault/AntiPaste/Marketing/<Canal>/<langue>/<Type>/`, puis mettre à jour `~/dev/_Vault/AntiPaste/MEMORY.md` (le créer s'il n'existe pas encore).
