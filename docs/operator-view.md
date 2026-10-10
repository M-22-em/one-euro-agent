# Où voir One Euro Agent — contrôle du 10 octobre 2026

Ce document est un inventaire daté, pas un tableau de bord en direct. Il sépare le code présent, les instructions et les actions effectivement constatées.

## Les éléments consultables

| Élément | Où le consulter | Ce qu'il établit |
| --- | --- | --- |
| Base existante et historique | [Dépôt et commits](https://github.com/M-22-em/one-euro-agent/commits/main/) | Instructions, modifications et fichiers publiés ; pas un revenu |
| Mission historique | [MISSION.md](../MISSION.md) | Mandat de l'expérience close le 7 octobre ; pas un nouveau mandat |
| Adaptation demandée | [Adaptation Circadian](circadian-adaptation.md) | Boucle commerciale et limites ; pas un moteur installé |
| Code Circadian repris | [Connecteur TaskMarket](../integrations/taskmarket/circadian-mcp/README.md) | 14 fichiers copiés sans modification depuis une version identifiée |
| Provenance exacte | [Manifeste](circadian-import.json) | Dépôt, commit, empreinte de chaque fichier et état d'activation |
| Exécutions GitHub | [Actions](https://github.com/M-22-em/one-euro-agent/actions) | Résultats techniques, logs et erreurs de chaque exécution |
| Automatisations ChatGPT | Interface privée des tâches de l'opératrice | Prompt réellement utilisé, activation et réponses ; séparés des fichiers GitHub |
| Échanges et preuves commerciales | AgentMail et base Notion existants, privés | Réponses, accords, reçus et comptes ; jamais publiés dans ce dépôt |

Le code GitHub ne synchronise pas automatiquement le prompt d'une tâche ChatGPT. Éditer une documentation ne modifie ni ce prompt ni une machine d'exécution.

## État effectivement contrôlé

- Les cinq tâches de suivi One Euro présentes dans l'outil d'automatisation étaient désactivées au contrôle du 10 octobre. Aucune n'a été réactivée.
- L'arbre du dépôt avant cette reprise contenait des documents, un scanner DeskCrew, deux workflows et un exemple. Il ne contenait pas de moteur complet qui choisit, produit, soumet et rapproche un paiement.
- L'[exécution TaskMarket du 3 octobre](https://github.com/M-22-em/one-euro-agent/actions/runs/37110052842) est marquée réussie. Le workflow liste des tâches publiques : ce statut ne prouve ni soumission ni paiement.
- Aucun nouvel encaissement n'a été audité pendant cette reprise. Le montant net reste inconnu dans le manifeste, et non artificiellement fixé à zéro.
- L'environnement de travail de cette session n'est pas connecté. Aucun serveur persistant, modèle, portefeuille ou hébergement n'a été installé ou validé par cette modification.

## Ce qui est repris de Circadian

Source : [Circadian-agent/taskmarket-mcp à la version 3fa7387](https://github.com/Circadian-agent/taskmarket-mcp/tree/3fa7387f64a79d5e143041efb6ea1346c6b3a46f), commit du 10 août 2026.

Les sources, tests, README, dépendances verrouillées et déclarations de licence sont conservés tels quels. La licence MIT est déclarée dans le README et le package ; cette version ne contient pas de fichier LICENSE séparé. L'attribution Circadian est conservée. Les chemins vers un dépôt parent et le portefeuille cités dans le README amont appartiennent à Circadian, pas à One Euro.

Ce connecteur expose la recherche, le détail des tâches, les soumissions existantes, le solde public et les statistiques d'un acheteur. Il expose aussi des écritures côté **acheteur** (créer une tâche, payer des gagnants, rejeter une soumission), protégées par son mécanisme de prévisualisation. Il n'expose pas de commande worker pour candidater, réclamer une tâche ou déposer notre travail.

**Il n'est donc pas le moteur complet de Circadian et n'a pas été activé.** Son jeton de prévisualisation ne prouve pas à lui seul un consentement humain ; ses limites de dépense ne couvrent pas tous les frais et écritures. Un import de code ne constitue aucune autorisation financière.

Les dépôts publics `Circadian-agent/core`, `observability-stack` et `hatch` sont respectivement des bases Open Wallet Standard, OpenSearch et Hatch. Les noms ne prouvent pas qu'il s'agit de son moteur économique. Le moteur de production et ses instructions privées n'ont pas été trouvés dans les sources publiques examinées.

## Vérification reproductible de la copie

Le manifeste donne le SHA Git de chaque fichier amont. On peut comparer ces SHAs à ceux des fichiers importés avec `git ls-files -s integrations/taskmarket/circadian-mcp`. Toute adaptation ultérieure doit rester hors de cette copie, ou être explicitement documentée.

Pour reprendre cette base dans un environnement connecté :

```sh
git clone --branch circadian-base-and-visibility https://github.com/M-22-em/one-euro-agent.git
cd one-euro-agent/integrations/taskmarket/circadian-mcp
npm ci --ignore-scripts
node --test test/policy.test.mjs test/cli.test.mjs test/stdio_smoke.test.mjs
```

Ces trois fichiers de tests amont couvrent les règles, le CLI simulé et le démarrage MCP. Ils n'effectuent aucune transaction réelle. Ne pas remplacer cette sélection par `npm test` sans examiner les tests live, dont certains font des POST sans paiement sur le service.

Vérification exécutée le 10 octobre 2026 : [GitHub Actions nº 38058028311](https://github.com/M-22-em/one-euro-agent/actions/runs/38058028311). Les 14 empreintes correspondent à l'amont ; les 20 tests sélectionnés passent, sans échec ni test ignoré. Le job vérifie le code du commit 2da42dc5a31e658ed607d3c538267c15cc1d0380 dans la proposition nº 5. Ce résultat couvre le connecteur et son démarrage dans le runner de test, pas une installation persistante ni un paiement.

## Condition pour sortir de la boîte noire

Toute future exécution doit relier : version exacte du prompt/configuration → run horodaté → tâche choisie et motif observable → outils et résultats → artefact et vérifications → reçu de soumission → décision → paiement et frais.

Les raisons opérationnelles sont consignées avec leurs preuves, sans exiger ni publier une chaîne de pensée interne. Les journaux détaillés et pièces client restent privés. Un rapport public est anonymisé et autorisé.

L'état doit être explicitement **actif**, **arrêté** ou **en erreur**, avec date de dernière exécution ; l'activité technique et le net comptable sont deux mesures séparées. Les secrets restent dans le stockage sécurisé du futur environnement, jamais dans ce dépôt.

La prochaine intégration nécessaire est le moteur d'exécution avec sa configuration visible et la voie worker officielle. Elle n'est pas masquée par cette copie partielle. L'expérience précédente reste close ; cette reprise n'invente ni nouvelle échéance ni nouvelle autorisation de dépense.
