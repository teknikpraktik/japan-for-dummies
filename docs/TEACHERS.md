# Lärarguide

Logga in på `/logga-in/` och välj **Lärare**: e-postadress (används bara som inloggningsnamn, inga e-postmeddelanden skickas), lösenord och engångskod från autentiseringsappen. Första gången registrerar du appen och sparar återställningskoderna; administration är spärrad tills det är gjort.

## Elever

- **Skapa elev** (Lärare → Elever): skriv förnamn eller alias. Systemet skapar ett slumpat användarnamn (inte baserat på namnet) och en engångskod. Koden visas **en enda gång**: skriv ut kortet eller kopiera den direkt. Den lagras inte i läsbar form och kan inte visas igen.
- **Ny kod:** gamla koden slutar gälla direkt och elevens sessioner avslutas. Kräver ditt lösenord.
- **Avaktivera / aktivera igen:** en avaktiverad elev kan inte logga in och befintliga sessioner avslutas.
- **Radera:** kräver att du skriver namnet och ditt lösenord. Exportera först uppgifterna om det behövs.
- **Exportera:** ger en JSON med de uppgifter som lagras om eleven.

Visningsnamn är inte unika; använd användarnamnet för att skilja elever åt.

## Översikt

Matrisen har en rad per elev och en kolumn per **publicerat** kapitel: Ej påbörjat / Påbörjat / Avklarat, antal avklarade av publicerade kapitel och när framsteg senast synkades. Kommande kapitel räknas inte. Avklarat betyder minst fyra av fem rätt; eleven kan göra om testet obegränsat.

Framsteg som sparats offline är inte manipulationssäkra; en elev kan med teknik påverka sin egen lokala status. Använd översikten som stöd, inte som betyg.

## Lärare

Under Lärare → Lärare bjuder du in en kollega: en engångslänk (giltig 72 timmar) där hen sätter eget lösenord och registrerar tvåfaktor. Du kan ändra roll och avaktivera lärare. Den sista användbara läraren (aktiv och med tvåfaktor) kan aldrig avaktiveras, raderas eller nedgraderas. Känsliga ändringar kräver ditt lösenord.

Lärare ser bara sin egen grupp.
