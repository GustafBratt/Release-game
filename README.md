# Release Tycoon

Ett litet webbläsarspel för mobilen, med flygledarstress. Du är release manager i ett agilt mjukvaruprojekt: buggfixar, säkerhetsfixar, databasmigreringar och API-ändringar faller ner på en radar, och du ska få ut dem i produktion så fort som möjligt, utan att släppa något trasigt.

**Spela:** https://gustafbratt.github.io/Release-game/

## Så funkar det

- Dra eller tryck ändringarna till en av tre releaser innan de når botten. Det som når botten följer med ändå, oplanerat.
- Releaserna går ut i ordning, en i taget, när du trycker **Släpp**. Ju kortare tid från radar till prod, desto fler stjärnor.
- Nya sorters ändringar låses upp när du samlar stjärnor, med ett infokort varje gång.
- Var tredje sprint är det PI planning: en liten plattformsbana där varje godis blir en ny ändring att planera in i lugn och ro.
- Det finns ingen hälsomätare. Släpper du migreringar i fel ordning eller en halv API-ändring, eller missar en deadline, är det game over.

## Köra lokalt

Ingen byggprocess och inga beroenden, bara HTML, CSS och JavaScript:

```
python -m http.server 8765
```

Öppna sedan http://localhost:8765/. Testerna finns på http://localhost:8765/tests.html.
