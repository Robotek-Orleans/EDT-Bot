# EDT-Bot
Bot Discord pour trouver des salles dans l'emploi du temps

Ce bot est basé sur @Jig0ll https://github.com/Jiogo18/jig0ll

# Commandes

## Salle

`salle (filtre)` : Informations sur les salles dans l'emploi du temps. Les salles marquées 'libre' n'ont pas d'évenement avant 4 heures après la commande.
Le filter peut contenir :
- Nom de la salle (F022, F1, L-, Cab, ...)
- Information temporelle (dans 10 h, dans 2 j)
- Niveau (PeiP2, A4-GPSE, A2-TP2-S2, ...)

# Lancer avec Docker

- `git clone https://github.com/Robotek-Orleans/EDT-Bot`
- `npm install`
- Créer les fichiers database.env et EDT-Bot.env :
  - database.env contient POSTGRES_PASSWORD, POSTGRES_USER, POSTGRES_DB
  - EDT-Bot.env contient DISCORD_TOKEN, BOT_ID, DATABASE_URL, EDT_URL, EDT_DIR
- `cd EDT-Bot`
- `sudo docker-compose up --build`
