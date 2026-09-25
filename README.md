# Segeljakt art — Andreas Segeljakt

Webbplatsen publiceras från `main` med GitHub Pages. Museet skapas automatiskt av bildfilerna i `assets/`, så nya bilder behöver inte läggas in i `index.html`.

## Hantera målningar på Mac och Windows

Installera [Git](https://git-scm.com/downloads) och [Python 3](https://www.python.org/downloads/) en gång. Klona webbplatsen med `git clone https://github.com/Segeljakt-Art/segeljakt-art.github.io.git`. Git använder din vanliga GitHub-inloggning när du publicerar; kontot behöver skrivrätt till projektet.

Öppna den klonade projektmappen och dubbelklicka på **Hantera galleri.command** på Mac eller **Hantera galleri.cmd** på Windows. En lokal sida öppnas i webbläsaren. På Mac öppnas även ett Terminal-fönster som ska vara öppet medan du arbetar. Programmet använder bara Python-standardbiblioteket; inga extra Python-paket behövs.

På sidan ser du alla målningar med miniatyrbilder. Släpp en JPG-, PNG-, WebP- eller GIF-bild på sidan, eller klicka **välj en bild**. Klicka på målningen, fyll i titel, år, upphovsrätt, pris, medium och dimensioner och klicka **Spara uppgifter**. Dra korten för att ändra ordning. **Ta bort målning** markerar den för borttagning; du kan ångra innan publicering. Klicka **Publicera ändringar** när allt är klart. Då skickas bilder, uppgifter, ordning och borttagningar till GitHub. Webbplatsen uppdateras efter att GitHub Pages har byggt den.

Nya målningar får automatiskt nästa målningsnummer efter det högsta befintliga numret. Numret visas i formuläret men kan inte ändras. Befintliga målningars nummer ändras inte.

Ändringar stannar lokalt i programmet tills du publicerar. Om någon annan har uppdaterat projektet under tiden får du starta om programmet och göra om dina opublicerade ändringar. Om Git skapar en commit men uppladdningen misslyckas kan du försöka publicera igen i samma program.

Välj webbplatsens **Färgtema** och bakgrund för **Förstorad bild** i gallerihanteraren. Klicka **Förhandsvisa webbplatsen** för att öppna en lokal version med dina opublicerade målningar, ordning och färgval. Förhandsvisningsfliken behöver uppdateras för att visa ändringar som du gör medan den redan är öppen. Färgvalen går live först när du klickar **Publicera ändringar**.

I gallerihanteraren kan du även välja **Ordna efter** pris, storlek, år, titel, medium eller målningsnummer och klicka **Använd ordning**. Den ordningen sparas på webbplatsen när du publicerar. Besökare kan sortera Museum tillfälligt med menyn **Sortera**; det ändrar inte den sparade ordningen. Storlek jämförs som yta i cm² när måtten kan läsas som bredd × höjd i mm, cm eller m. Mått i pixlar och okända värden hamnar sist.

Bildordningen ligger i `_order` i `_data/artworks.json` och används både i Museum och i startsidans bildspel. Bilder som läggs direkt i `assets/` utan att finnas i `_order` visas sist. En bild utan JSON-post visas som ”Utan titel” med standardvärdena från `_defaults`.

## Byt färgtema

Öppna `index.html` och ändra de två attributen på `<html>` högst upp:

```html
<html lang="sv" data-theme="sand" data-artwork-view="light">
```

`data-theme` kan vara `sand` (nuvarande ljusa tema), `sage` (grönt) eller `charcoal` (mörkt). `data-artwork-view` styr bakgrunden och texten **när en museibild är förstorad**: välj `light` eller `dark`. Inställningarna är oberoende, så till exempel `data-theme="sand"` kan kombineras med `data-artwork-view="dark"`. Färgerna för varje tema finns samlade högst upp i `styles.css`; där kan du ändra exakta färgkoder.

## Förhandsvisa lokalt

Sidan använder Jekyll för att läsa bildmappen och JSON-filen. Kör `jekyll build --destination /tmp/segeljakt-preview` från projektmappen och servera sedan den byggda mappen, till exempel med `python3 -m http.server 8000 --directory /tmp/segeljakt-preview`. Öppna `http://localhost:8000`.
