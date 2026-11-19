# Cronache di Aurora

Un gioco di avventura con creature da catturare, allenare ed evolvere, giocabile nel browser (anche da telefono), con multigiocatore a stanze.

- `public/index.html` — il gioco completo (un solo file, con grafica e suoni inclusi).
- `src/worker.js` — il server delle stanze multigiocatore (Cloudflare Worker + Durable Object).
- `wrangler.jsonc` — la configurazione per Cloudflare.

## Pubblicare su Cloudflare (una volta sola)

1. Crea un account gratuito su [dash.cloudflare.com](https://dash.cloudflare.com).
2. Nel pannello apri **Workers & Pages** → **Create** (Crea).
3. Scegli di importare un repository da GitHub (**Import a repository** / *Connect to Git*), autorizza Cloudflare ad accedere al tuo account GitHub e seleziona questo repository.
4. Lascia le impostazioni proposte:
   - Build command: *(vuoto)*
   - Deploy command: `npx wrangler deploy`
   Cloudflare legge `wrangler.jsonc` e pubblica insieme il gioco e il server delle stanze.
5. Al termine ricevi un indirizzo, per esempio `https://cronache-di-aurora.<tuo-nome>.workers.dev`. È il link da condividere.

Da quel momento ogni modifica caricata su questo repository viene ripubblicata automaticamente.

> I nomi dei pulsanti nel pannello di Cloudflare possono cambiare nel tempo. Se non trovi una voce, cerca "Workers Builds" o "Connect to Git" nella documentazione di Cloudflare.

## Come si gioca in multigiocatore

1. Ognuno apre il link e gioca con il proprio salvataggio (resta nel suo browser, su quel dispositivo).
2. Dopo aver ricevuto la prima creatura: **Menu → Multigiocatore → Crea stanza**. Il gioco mostra un codice di 6 cifre.
3. Gli altri scelgono **Unisciti** e inseriscono il codice: compaiono accanto a chi ha creato la stanza, con le proprie creature e i propri oggetti.
4. Davanti a un altro giocatore premi **A** per sfidarlo a una battaglia amichevole.
5. Quando qualcuno inizia una lotta, gli altri nella stanza ricevono la richiesta di aiutarlo e possono unirsi con una loro creatura.

## Costi e limiti

Il server usa i Durable Objects di Cloudflare con archiviazione SQLite, disponibili anche nel piano gratuito, con limiti giornalieri di utilizzo. Le stanze non salvano nulla: tengono solo in memoria chi è collegato. Controlla limiti e prezzi aggiornati su
<https://developers.cloudflare.com/durable-objects/platform/pricing/>.

Massimo 16 giocatori per stanza.

## Provarlo sul proprio computer

Serve [Node.js](https://nodejs.org).

```bash
npm install
npm run dev
```

Poi apri <http://localhost:8787> in due finestre diverse (o due browser) per provare le stanze.

## Sicurezza

Chiunque abbia il link può creare stanze o provare a entrare con un codice. Ogni giocatore calcola le proprie creature sul suo dispositivo: il gioco scarta i dati impossibili che arrivano dagli altri, ma chi modifica il codice potrebbe comunque barare. Va bene per giocare tra amici; non è pensato per competizioni con premi.
