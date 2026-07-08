# SMART OfficeHub

Lokale OfficeHub-App mit echter Gmail- und Google-Calendar-Anbindung.

## Einrichten

1. In der Google Cloud Console ein Projekt anlegen.
2. Gmail API und Google Calendar API aktivieren.
3. OAuth-Client vom Typ **Webanwendung** erstellen.
4. Als autorisierte Weiterleitungs-URI eintragen:

```text
http://localhost:8791/oauth2callback
```

5. `config.example.json` nach `config.local.json` kopieren und `clientId` sowie `clientSecret` aus dem eigenen Gmail-Dashboard-OAuth-Client eintragen.
6. App starten:

```bash
npm start
```

7. Im Browser öffnen:

```text
http://localhost:8791
```

## Vercel einrichten

Auf Vercel gibt es keine `config.local.json`. Deshalb müssen die Google-OAuth-Daten in Vercel als Environment Variables gepflegt werden:

```text
GOOGLE_CLIENT_ID=DEINE_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=DEIN_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://DEINE-VERCEL-DOMAIN.vercel.app/oauth2callback
GOOGLE_LOGIN_HINT=metzger@metzger-rea.de
```

`GOOGLE_REDIRECT_URI` ist empfohlen. Wenn sie fehlt, nutzt die App auf Vercel automatisch `https://${VERCEL_URL}/oauth2callback`.
`GOOGLE_LOGIN_HINT` ist optional und schlägt Google beim Anmelden das gewünschte Konto vor.

In der Google Cloud Console muss dieselbe Redirect-URI beim OAuth-Client unter **Autorisierte Weiterleitungs-URIs** eingetragen werden:

```text
https://DEINE-VERCEL-DOMAIN.vercel.app/oauth2callback
```

Für lokale Entwicklung bleibt zusätzlich erlaubt:

```text
http://localhost:8791/oauth2callback
```

Nach Änderungen an Vercel Environment Variables muss die App neu deployed werden.

## Was die App kann

- Gmail OAuth Login
- Posteingang abrufen
- Suche und Filter
- Kalendertermine aus Google Calendar abrufen
- Gmail-Anhänge als Dokumente erkennen
- Archivieren
- In Papierkorb verschieben
- Antwortentwurf in Gmail erstellen

Die App speichert OAuth-Tokens lokal unter `.local/tokens.json`. Diese Datei ist in `.gitignore` ausgeschlossen.

## Scopes

Die App nutzt:

- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/calendar.readonly`

`gmail.modify` erlaubt Lesen, Labels ändern, Archivieren und Papierkorb-Aktionen. `gmail.compose` wird für Gmail-Entwürfe verwendet.
`calendar.readonly` liest kommende Termine aus Google Calendar, ohne Termine zu ändern.

Empfehlung: Diese Gmail-App sollte ein eigenes Google-Cloud-Projekt oder zumindest einen eigenen OAuth-Client verwenden. So erscheint beim Login ein passender App-Name und SMART Booking bleibt fachlich getrennt.
