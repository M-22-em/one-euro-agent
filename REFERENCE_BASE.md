# Base de travail — Circadian-like Agent

Date de structuration : 11 octobre 2026.

Objectif de ce document : séparer ce qui est **observé dans les sources**, ce qui est **inconnu**, et ce qui peut être **réutilisé comme principe d'architecture**. Il ne décrit pas encore l'architecture finale de One Euro Agent.

## Matrice de référence

| Source | Ce que la source prouve / montre | Ce qu'elle ne permet pas d'affirmer | Ce qu'on garde comme base de travail |
|---|---|---|---|
| **Circadian** | Agent autonome sous supervision humaine ; exploration de plusieurs venues ; 11,73 USD de revenu brut sur 19 jours ; 5 paiements ; TaskMarket = 3 gains sur 34 entrées ; Frantic = 2 paiements ; chaque paiement publié avec transaction on-chain ; ledger append-only ; distinction explicite revenu brut / profit ; publication de mesures et résultats réels. | La stack interne complète n'est pas publiée : runtime exact, scheduler, base de données, orchestration interne, système de mémoire, gestion des secrets, logique complète de sélection des tâches et interface opérateur ne sont pas documentés publiquement de bout en bout. | **Comportement économique et méthode expérimentale** : essayer des marchés réels, mesurer chaque tentative, vérifier les paiements, publier les échecs, distinguer activité et revenu, réallouer l'effort vers les canaux/acheteurs qui paient réellement. |
| **x402 Bounty Hunter / DeskCrew** | Boucle d'exécution réelle et étroite : lire un board → sélectionner une bounty → acheter du contexte / payer une soumission → rédiger avec un LLM → soumettre → attendre décision humaine → recevoir USDC si approuvé. Le CLI a un dry-run, un mode live, des plafonds de prix/dépense, publie concurrence et historique, et peut recevoir des événements push (row.available, draft.decided, payout.sent). Les paiements sont vérifiables on-chain. | Ce projet n'est pas un système complet d'entreprise autonome multi-marketplace. Son `--max-spend` est un garde-fou de process, pas une comptabilité globale de long terme. Il ne fournit pas à lui seul un dashboard économique complet, une base d'état universelle ou une orchestration multi-venue. | **Boucle transactionnelle exécutable** : tool réel, coût réel, résultat réel, preuve de soumission, preuve de paiement, garde-fous économiques dans le code, préférence pour événements push plutôt que polling quand disponible. |
| **Forge402** | Architecture open source avec frontend Next.js, backend Express, agent daemon, runs planifiés, orchestrateur partagé, paiements x402 automatiques, budget guardrails, pause automatique quand les crédits sont épuisés, stockage de rapports, webhooks, dashboard avec agents/crédits/paiements, clés privées côté serveur. | Forge402 est un marketplace/outillage x402 sur Stellar, pas une reproduction de Circadian. Sa logique métier, son protocole de paiement, son modèle de revenus et son choix de Venice AI ne sont pas des contraintes pour notre agent. Le projet sert de référence d'architecture, pas de template à copier intégralement. | **Architecture d'autonomie visible** : runtime unique, agent daemon, scheduler, budget dans le code, wallet côté serveur, dashboard opérateur, rapports persistés, pause/reprise, webhooks. |
| **Agent Marketplace (Juwebien)** | Architecture documentée avec Coordinator off-chain, state machine Redis, PostgreSQL pour l'audit, API FastAPI, workflows à états, timeouts, matching, write-ahead log/recovery, et séparation explicite entre orchestration, état, audit et paiement. Le projet reconnaît lui-même que le Coordinator est encore en cours et n'est pas production-ready. | Ce n'est pas une preuve qu'il faut Redis, PostgreSQL, smart contracts, Arbitrum, escrow multi-stage ou une architecture distribuée pour notre cas. La plupart de ces choix répondent à son produit de marketplace et à ses contraintes de confiance, pas aux nôtres. | **Principes d'état et d'audit** : machine à états explicite, source de vérité persistante, journal append-only, reprise après incident, séparation état opérationnel / audit / paiement. |

## Ce que les quatre sources couvrent ensemble

Elles ne décrivent pas une architecture unique. Elles couvrent quatre angles complémentaires :

1. **Circadian — quoi mesurer et comment apprendre économiquement.**
2. **x402 Bounty Hunter — comment une boucle économique réelle s'exécute.**
3. **Forge402 — comment rendre un agent autonome, budgété et visible depuis une interface.**
4. **Agent Marketplace — comment rendre l'état, les transitions et l'audit explicites et persistants.**

## Contraintes déduites pour notre futur agent

Ces contraintes sont des **déductions de travail**, pas des faits sur Circadian :

- une action économique réelle doit produire un identifiant ou une preuve externe ;
- l'état ne doit pas dépendre de la mémoire du LLM ;
- le budget doit être appliqué par le code, pas uniquement par le prompt ;
- les revenus potentiels, soumissions, acceptations, paiements et coûts doivent rester séparés ;
- l'agent doit pouvoir reprendre après erreur sans répéter une dépense ou une soumission ;
- l'opératrice doit disposer d'une interface permettant de voir l'état courant, l'historique des actions, les coûts, les résultats et les blocages ;
- l'autonomie doit être accordée par classes d'actions et plafonds, pas par autorisation manuelle à chaque micropaiement ;
- commencer par une boucle économique complète sur une seule venue avant d'ajouter d'autres marchés.

## Ce qu'on ne décide pas encore

Aucun choix n'est figé à ce stade concernant :

- framework agentique ;
- orchestrateur ;
- runtime cloud ;
- base de données ;
- framework frontend ;
- réseau blockchain ;
- fournisseur de modèle ;
- multi-agent ou mono-agent.

Ces choix viendront seulement après définition de la première boucle économique à reproduire.

## Sources originales

- Circadian, **"$11.73 gross in 19 days: one AI agent's earnings record"** : https://circadian-agent.com/research/agent-economy-earnings
- Circadian, **"The Agent Economy, measured"** : https://circadian-agent.com/brief/2026-07
- Circadian, **"One day on Frantic"** : https://circadian-agent.com/notes/frantic-first-day
- x402 Bounty Hunter : https://github.com/webmilmind1/x402-bounty-hunter
- Forge402 : https://github.com/AswinWebDev/Forge402
- Agent Marketplace : https://github.com/Juwebien/agent-marketplace
- Agent Marketplace architecture : https://github.com/Juwebien/agent-marketplace/blob/master/ARCHITECTURE.md
