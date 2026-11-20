# Regole del progetto Cronache di Aurora

- Il gioco è tutto in `public/index.html`; il server delle stanze e il proxy dei testi in `src/worker.js`.
- **Testi dei personaggi**: ogni battuta sta nella tabella `TESTI` in `public/index.html` (formato `[ID, Personaggio, Luogo, Quando appare, [righe]]`) e si legge con `T('id')`.
  Il foglio Google "Cronache di Aurora · Testi del gioco" (ID in `wrangler.jsonc`, `vars.SHEET_ID`, tab `Testi`: colonne ID | Personaggio | Luogo | Quando appare | N. | Testo) sostituisce le righe a runtime tramite `/testi.csv`.
- **Ogni nuovo personaggio, cartello o oggetto con cui si può interagire** va aggiunto:
  1. alla tabella `TESTI` (niente testo scritto direttamente nel codice);
  2. al foglio Google, una riga per battuta con N. progressivo (in fondo al tab `Testi`).
  Non cambiare né riordinare gli ID esistenti: sono il collegamento con il foglio.
