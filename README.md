# Segeljakt art — Andreas Segeljakt

Webbplatsen publiceras från `main` med GitHub Pages. Museet skapas automatiskt av bildfilerna i `assets/`, så nya bilder behöver inte läggas in i `index.html`.

## Ladda upp från Windows

Installera [Git for Windows](https://git-scm.com/download/win) och [Python 3 för Windows](https://www.python.org/downloads/windows/) en gång. Se till att Python-kommandon och Tcl/Tk installeras. Klona sedan webbplatsen med `git clone https://github.com/Segeljakt-Art/segeljakt-art.github.io.git` i en mapp på datorn.

Dubbelklicka på **Ladda upp målning.cmd** i den klonade mappen. Programmet öppnar ett fönster där du väljer bild och fyller i titel, år, målningsnummer, pris, medium, dimensioner och upphovsrätt. Titeln måste fyllas i; övriga fält visas med standardvärden. Klicka på **Ladda upp målning**. Programmet hämtar senaste versionen, kopierar bilden, uppdaterar JSON-filen och publicerar ändringen. Första uppladdningen kan öppna en GitHub-inloggning i webbläsaren via Git Credential Manager; kontot behöver skrivrätt till projektet.

Nya bilder visas automatiskt i Museum när GitHub Pages är färdigt. Bildspelet på startsidan styrs separat i `script.js`. Programmet skriver inte över en bild med samma filnamn. Om en commit skapades men uppladdningen misslyckades, kör `git push origin main` när problemet är löst.

## Lägg till en målning

1. Lägg en `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg` eller `.gif` i `assets/` och pusha ändringen. Filnamnet ska inte börja med `_`, eftersom Jekyll då hoppar över filen.
2. Lägg till en post i `_data/artworks.json` med **exakt samma filnamn** som nyckel. Där kan du ange `title`, `year`, `copyright`, `painting_number`, `price`, `medium` och `dimensions`.

En bild visas även utan en JSON-post. Då visas ”Utan titel” och värdena under `_defaults` för övriga uppgifter. Ändra standardvärdena i JSON-filen om de ska gälla för alla nya bilder. Alla befintliga bilder har upphovsrätt angiven som Andreas Segeljakt; övriga detaljer står som ”Ej angivet” tills riktiga uppgifter fylls i. Ange priser som text, till exempel `"4 500 kr"`.

Museet visar bilderna i bokstavsordning efter filnamn. Klicka på en bild för att se den större. Bildspelet på startsidan har en egen ordning som fortfarande styrs i `script.js`.

## Byt färgtema

Öppna `index.html` och ändra de två attributen på `<html>` högst upp:

```html
<html lang="sv" data-theme="sand" data-artwork-view="light">
```

`data-theme` kan vara `sand` (nuvarande ljusa tema), `sage` (grönt) eller `charcoal` (mörkt). `data-artwork-view` styr bakgrunden och texten **när en museibild är förstorad**: välj `light` eller `dark`. Inställningarna är oberoende, så till exempel `data-theme="sand"` kan kombineras med `data-artwork-view="dark"`. Färgerna för varje tema finns samlade högst upp i `styles.css`; där kan du ändra exakta färgkoder.

## Förhandsvisa lokalt

Sidan använder Jekyll för att läsa bildmappen och JSON-filen. Kör `jekyll build --destination /tmp/segeljakt-preview` från projektmappen och servera sedan den byggda mappen, till exempel med `python3 -m http.server 8000 --directory /tmp/segeljakt-preview`. Öppna `http://localhost:8000`.
