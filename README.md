<h1 align="center">CleanLink</h1>

CleanLink est une application web pour nettoyer, raccourcir et analyser des URL. Elle retire les paramètres de suivi connus et signale certains indices suspects pouvant être associés à du phishing.

Les liens raccourcis sont enregistrés dans une base MySQL. Un suivi statistique permet de consulter les clics sans cookie de tracking ni profilage des visiteurs.

Le projet utilise Next.js et TypeScript pour l’interface et la logique serveur ainsi que MySQL pour le stockage des données.

## Installation

### Prérequis

- Git
- Node.js 24 avec npm
- Docker avec Docker Compose

Docker doit être démarré avant de lancer la base de données.

### Récupérer le projet

Depuis le dossier dans lequel tu souhaites installer le projet :

    git clone https://github.com/Shunthail/CleanLink.git
    cd CleanLink

### Installer les dépendances

    npm ci

### Préparer la configuration

    npm run setup

Cette commande crée un fichier `.env` avec les paramètres de connexion et des mots de passe générés automatiquement. Ce fichier est exclu de Git.

### Démarrer la base de données

    npm run db:up
    npm run db:setup

MySQL est accessible localement sur le port 3307. Les données sont conservées dans un volume Docker entre les redémarrages.

### Lancer l’application

    npm run build
    npm start

L’application est ensuite accessible à l’adresse suivante :

http://localhost:3020

Au premier lancement, aucun lien ni aucune statistique ne sont préenregistrés. Les compteurs évoluent à partir des liens créés et des clics enregistrés.

### Développement

Pour lancer le serveur de développement :

    npm run dev

L’application reste accessible sur http://localhost:3020.

### Vérifications

Pour vérifier les types et exécuter les tests :

    npm run typecheck
    npm test

### Arrêter la base de données

    npm run db:down

Cette commande arrête MySQL sans supprimer les données du volume Docker.

## Analyse des liens

L’analyse repose sur des règles appliquées à la structure des URL. Elle peut signaler des paramètres sensibles, des domaines trompeurs ou d’autres indices suspects.

Elle ne garantit pas qu’un site est sûr et ne remplace pas une solution complète de protection contre le phishing.

## À propos du projet

CleanLink est un projet réalisé avec un groupe d’amis de l’école. J’ai pris en charge la logique serveur et la conception de la base MySQL, du stockage des liens aux requêtes utilisées pour les statistiques. Mon travail sur la sécurité a également porté sur la recherche et l’analyse de schémas courants de phishing, notamment les domaines imitant des services connus et les structures d’URL trompeuses, afin de les traduire en règles de détection.

Pour préserver mon anonymat et celui des autres participants, j’ai adapté cette version publique en retirant les informations personnelles présentes dans le projet, notamment les noms, les prénoms et les coordonnées.

Ce dépôt accompagne la présentation de mes compétences sur [shunthail.fr](https://shunthail.fr). Il s’adresse notamment aux recruteurs qui souhaitent consulter mon travail et explorer le code sans avoir à me contacter au préalable.

## Réutilisation et contact

Vous pouvez utiliser le code ou vous inspirer du projet sans me demander d’autorisation. Un message reste toujours apprécié si ce travail vous aide à lancer un projet ou à développer une idée.

Si vous avez une question ou besoin d’aide, vous pouvez me contacter sur Discord : **shunthail**.
