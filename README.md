# Segeljakt art — Andreas Segeljakt

Webbplatsen publiceras från `main` med GitHub Pages. Museet skapas automatiskt av bildfilerna i `assets/`, så nya bilder behöver inte läggas in i `index.html`.

## Lägg till en målning

1. Lägg en `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg` eller `.gif` i `assets/` och pusha ändringen. Filnamnet ska inte börja med `_`, eftersom Jekyll då hoppar över filen.
2. Lägg till en post i `_data/artworks.json` med **exakt samma filnamn** som nyckel. Där kan du ange `title`, `year`, `copyright`, `painting_number`, `price`, `medium` och `dimensions`.

En bild visas även utan en JSON-post. Då används filnamnet som titel och värdena under `_defaults` för övriga uppgifter. Ändra standardvärdena i JSON-filen om de ska gälla för alla nya bilder. Alla befintliga bilder har upphovsrätt angiven som Andreas Segeljakt; övriga detaljer står som ”Ej angivet” tills riktiga uppgifter fylls i. Ange priser som text, till exempel `"4 500 kr"`.

Museet visar bilderna i bokstavsordning efter filnamn. Klicka på en bild för att se den större. Bildspelet på startsidan har en egen ordning som fortfarande styrs i `script.js`.

`stillhet-vid-vattnet-2026.png` är ett AI-genererat digitalt koncept och är märkt som sådant i metadatafilen. Det är inte en fysisk originalmålning.

## Förhandsvisa lokalt

Sidan använder Jekyll för att läsa bildmappen och JSON-filen. Kör `jekyll build --destination /tmp/segeljakt-preview` från projektmappen och servera sedan den byggda mappen, till exempel med `python3 -m http.server 8000 --directory /tmp/segeljakt-preview`. Öppna `http://localhost:8000`.
