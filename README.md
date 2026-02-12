# Tenfe 
_Nom provisional_

Projecte per provar l'API de Renfe Cercanias. Actualment l'API no té gaire, haig d'agafar dades de `.json` i `.txt`, ja que no acabo d'entendre com funciona.
El projecte és una mini web que et crea un mapa amb l'ubicació dels trens en temps real, de moment només de R1 i RG1 (els fitxers s'actualitzen cada 30 s).

## Estructura
El projecta està dins el framework [Astro](https://astro.build/), així doncs, l'estructura principal segueix el seu estàndard.

* `src/server`: Petit .js per poder cridar els `.json` de Renfe.
* `scripts`: Scripts per poder netejar els fitxers de viatges i rutes de les línies (els converteix en `.json`). Els fitxers originals són molt grans, doncs és millor agafar només les línies desitjades.
* `src/pages/index.html`: Vista actual principal.
* `src/pages/api`: Api de l'aplicació que obté i filtra les dades dels trens
* `public/files`: En `raw/` han de guardar-se els `.txt` amb totes les rutes i viatges de les línies per poder convertir-les a `.json` amb els `src/scripts`. _A RESOURCES.md explico d'on treure els fitxers._
* `public/files/output/estacions_cercanias.json`: Estacions de cercanias de Barcelona.

**RESOURCES.md**: Aquí trobaràs d'on trec tota la informació.

## Inicialització
Com he dit, tenim la part web i un petit proxy per poder cridar als fitxers de Renfe.

```pnpm run dev```
