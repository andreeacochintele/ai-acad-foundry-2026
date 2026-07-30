# Set de testare — runda 2

Două lucruri diferite de testat, așa că documentul are două părți:

- **Partea 1** — răspunsurile agentului „Andreea Cochintele Credit Specialist"
  pe documentele adăugate recent în corpus (`17`–`25`), care nu erau acoperite
  de `data/questions.md`. Se testează prin chat (sau `POST /ask`), la fel ca
  runda 1: notează răspunsul, dacă e corect, și ce document(e) a citat.
- **Partea 2** — verificare manuală în UI că un cont cu rol `user` nu vede
  informațiile tehnice/admin (modelul, autentificarea Azure, scorurile de
  recuperare, promptul exact etc.), după fix-ul din `App.jsx` și `Chat.jsx`.

---

## Partea 1 — Întrebări noi (documentele 17–25)

### Grup D — retrieval simplu / un singur document

**D1.** Cât este taxa de originare (origination fee) a unui credit ipotecar,
și există un plafon minim și maxim?
- **Așteptat:** 0.5% din suma aprobată, minim 200 EUR, maxim 1.500 EUR;
  scăzută din suma virată la pasul 9 (disbursement), nu plătită în avans.
- **Sursă:** `17-closing-costs-and-fees.md`
- **Rezultat efectiv:** ✅ Corect — 0,5%, min 200 EUR, max 1.500 EUR, dedusă la
  disbursare. Notă: fragmentul cu răspunsul a avut cel mai mic scor (0.49) din
  cele 4 recuperate — a intrat totuși în top-4.

**D2.** Ce condiții trebuie îndeplinite ca să pot cere un top-up pe un credit
ipotecar existent?
- **Așteptat:** minim 12 luni consecutive cu plăți la timp (fără eveniment de
  întârziere), plus LTV combinat (credit original + top-up) ≤ 80% din
  valoarea reevaluată a proprietății (necesită o reevaluare nouă, pe costul
  clientului).
- **Sursă:** `18-mortgage-top-up.md`
- **Rezultat efectiv:** ✅ Corect și complet — 12 luni fără întârziere, LTV
  combinat ≤ 80% cu reevaluare pe costul clientului; a adăugat corect și
  suma minimă/maximă și limita DTI, necerute explicit.

**D3.** Care e reducerea de dobândă pentru un credit ipotecar verde (green
mortgage), și ce certificat energetic e necesar?
- **Așteptat:** 0.15 puncte procentuale, pentru un imobil cu certificat de
  performanță energetică clasa A sau B, emis în ultimii 5 ani; reducerea se
  aplică doar perioadei fixe, nu marjei perioadei variabile.
- **Sursă:** `20-green-mortgage-discount.md`
- **Rezultat efectiv:** ✅ Corect — 0,15 pp, doar pe perioada(ele) fixă(e),
  certificat clasa A/B emis în ultimii 5 ani.

**D4.** Ce avans minim se cere pentru un credit buy-to-let, față de o
locuință proprie?
- **Așteptat:** 25% pentru buy-to-let, față de 15% pentru locuința proprie.
- **Sursă:** `21-buy-to-let-mortgage.md` (+ `02-eligibility-criteria.md`)
- **Rezultat efectiv:** ✅ Corect — 25% buy-to-let vs. 15% locuință proprie.

**D5.** Ca aplicant nerezident, ce avans minim mi se cere?
- **Așteptat:** 30% din valoarea evaluată, indiferent dacă e prima
  locuință, a doua locuință sau proprietate de închiriat — nivelurile
  diferențiate din criteriile de eligibilitate standard nu se aplică
  nerezidenților.
- **Sursă:** `22-non-resident-borrower-eligibility.md`
- **Rezultat efectiv:** ❌ Greșit — cele 4 fragmente recuperate (checklist
  documente, două din `02-eligibility-criteria`, unul din
  `22-non-resident-borrower-eligibility`) NU au inclus paragraful "Down
  payment" al documentului 22 (30% fix, indiferent de tipul proprietății).
  Modelul, corect, nu a inventat un răspuns — a spus că nu are politica
  exactă pentru nerezidenți și a oferit greșit cifra de 25% (a doua
  locuință) din documentul general ca "ce reiese din context". Comportament
  sigur (nu halucinează), dar răspunsul e incomplet/înșelător pentru
  întrebare. **Retestat în engleză** ("As a non-resident applicant, what
  minimum down payment is required?"): documentul 22 e recuperat ca prim
  rezultat (scor 0.71) — deci acesta e un efect de limbă (RO→EN), nu un bug
  de chunking în acest document.

**D6.** În câte zile lucrătoare confirmă banca primirea unei reclamații, și
în câte zile calendaristice răspunde?
- **Așteptat:** confirmare în 2 zile lucrătoare; răspuns complet în 15 zile
  calendaristice pentru o reclamație simplă, respectiv 30 de zile pentru una
  care necesită investigarea unei decizii de creditare sau un caz de
  dificultate financiară (hardship).
- **Sursă:** `23-complaints-and-escalation.md`
- **Rezultat efectiv:** ✅ Corect — 2 zile lucrătoare confirmare, 15/30 zile
  calendaristice răspuns.

**D7.** La un credit pentru o locuință în construcție (new-build), plătesc
dobândă la toată suma aprobată de la început?
- **Așteptat:** Nu — dobânda se plătește doar la suma efectiv trasă până în
  acel moment, până la ultima tranșă (la predare), moment în care creditul
  devine un credit ipotecar standard cu amortizare.
- **Sursă:** `24-new-build-staged-drawdown.md`
- **Rezultat efectiv:** ✅ Corect și complet — dobândă doar pe suma trasă,
  tranziție la ipotecă standard la ultima tranșă, plus termenul maxim de
  finalizare de 24 luni, necerut explicit.

**D8.** De câte ori pot cere o schimbare a tipului de dobândă (fix ↔
variabil) pe durata unui credit, și ce taxă implică?
- **Așteptat:** O singură dată pe durata creditului, cu o taxă de
  administrare de 150 EUR; cererea trebuie depusă cu cel puțin 30 de zile
  înainte de data aniversară a creditului, iar schimbarea intră în vigoare
  doar la acea dată aniversară.
- **Sursă:** `25-rate-type-switch-mid-term.md`
- **Rezultat efectiv:** ✅ Corect și complet — o singură schimbare, taxă 150
  EUR, cerere cu 30 de zile înainte de aniversare.

---

### Grup E — multi-pas / trebuie combinate documente sau reguli existente

**E1.** Sunt cetățean străin nerezident și e prima mea casă — pot aplica prin
programul First-Time Buyer, ca să am avansul de 10%?
- **Așteptat:** Nu. Programul First-Time Buyer nu este disponibil pentru
  aplicanți nerezidenți; se aplică regula nerezidenților (avans 30%), nu
  regula standard sau cea de first-time buyer.
- **De ce e greu:** testează dacă agentul aplică regula generală de
  first-time buyer sau observă excluderea explicită dintr-un document
  diferit.
- **Surse:** `22-non-resident-borrower-eligibility.md` (exclude FTB) +
  `15-first-time-buyer-program.md`
- **Rezultat efectiv:** ❌ Greșit — sursele recuperate au fost doar
  `15-first-time-buyer-program` (×3) + `01-mortgage-overview`; documentul
  22, care conține excluderea explicită FTB pentru nerezidenți, nu a fost
  recuperat deloc. Modelul a răspuns, corect din punct de vedere al
  siguranței, că nu poate confirma eligibilitatea (nu a inventat un "da"),
  dar a ratat răspunsul corect și hotărât ("nu") pe care documentul chiar
  îl conține. **Retestat în engleză:** recuperă atât documentul 22, cât și
  `15-first-time-buyer-program` — efect de limbă, nu bug de chunking.

**E2.** Vreau să cumpăr o proprietate ca să o închiriez, dar are și
certificat energetic clasa A. Pot obține și reducerea green mortgage, și
avansul redus de first-time buyer, în același timp?
- **Așteptat:** Reducerea green mortgage se aplică pe Standard/First-Time
  Buyer/Refinancing; buy-to-let e o variantă a creditului Standard, deci
  reducerea de dobândă ar trebui să rămână aplicabilă — dar avansul redus de
  first-time buyer NU, pentru că buy-to-let e explicit interzis sub
  programul First-Time Buyer, indiferent de istoricul de cumpărare al
  aplicantului. Un răspuns bun distinge cele două beneficii și nu le
  amestecă.
- **De ce e greu:** corpusul nu leagă explicit toate cele trei documente
  între ele — agentul trebuie să nu presupună compatibilitate totală.
- **Surse:** `20-green-mortgage-discount.md` + `21-buy-to-let-mortgage.md` +
  `15-first-time-buyer-program.md`
- **Rezultat efectiv:** ❌ Greșit — sursele recuperate au fost doar
  `20-green-mortgage-discount` (×3) + `07-required-documents-checklist`;
  nici `21-buy-to-let-mortgage` (excluderea FTB), nici
  `15-first-time-buyer-program` nu au fost recuperate. Răspunsul a amestecat
  cele două beneficii exact cum era de așteptat să nu o facă, și a întrebat
  dacă FTB poate fi folosit pentru închiriere în loc să răspundă din
  documentul 21 că buy-to-let e explicit exclus din FTB. **Retestat în
  engleză:** tot doar `20-green-mortgage-discount` (×4) — spre deosebire de
  D5/E1, aici NU e efect de limbă, e un bug real: subiectul dominant al
  întrebării (green mortgage) ocupă tot top-k și exclude complet documentele
  cu mențiunile secundare (21, 15).

**E3.** Am folosit deja o schimbare de tip de dobândă acum doi ani. Vreau să
mai fac una acum, ca să trec iar pe fix. Se poate?
- **Așteptat:** Nu — o singură schimbare permisă pe durata creditului;
  pentru o a doua schimbare, clientul trebuie să folosească refinanțarea sau
  portabilitatea.
- **Sursă:** `25-rate-type-switch-mid-term.md`
- **Rezultat efectiv:** ✅ Corect — o singură schimbare mid-term permisă;
  pentru a doua, trebuie refinanțare sau portabilitate.

**E4.** Dezvoltatorul de la proiectul meu new-build a dat faliment după ce
mi s-au eliberat 2 din 5 tranșe. Mai datorez banii aceia băncii?
- **Așteptat:** Da — răspunderea clientului pentru tranșele deja eliberate
  rămâne neschimbată; expunerea băncii se limitează la tranșele eliberate,
  iar orice dispută cu dezvoltatorul e între client și dezvoltator, nu bancă.
- **Sursă:** `24-new-build-staged-drawdown.md`
- **Rezultat efectiv:** ✅ Corect și complet — răspunderea pentru tranșele
  eliberate rămâne a clientului, expunerea băncii limitată la ce a eliberat,
  disputa e client-dezvoltator.

**E5.** Care e diferența dintre portabilitate și refinanțare — dacă îmi mut
creditul pe o casă nouă, e același lucru?
- **Așteptat:** Nu. Refinanțarea schimbă cine deține creditul (sau
  restructurează termenii), păstrând aceeași proprietate; portabilitatea
  păstrează același credit și aceeași bancă, dar schimbă proprietatea care
  garantează creditul. Sunt independente — un credit portat poate fi ulterior
  refinanțat, și invers.
- **Sursă:** `19-mortgage-portability.md`
- **Rezultat efectiv:** ✅ Corect și complet — distincția corectă
  (portabilitate = aceeași bancă/credit, altă proprietate; refinanțare =
  alt creditor/condiții, aceeași proprietate), plus detalii corecte
  neserute (fereastra de 90 de zile, taxa de 250 EUR, tratamentul
  diferenței de preț ca top-up).

---

### Grup F — trebuie refuzat / informație absentă din corpus

**F1.** Pot folosi portabilitatea ca să mut creditul pe o proprietate din
altă țară?
- **Așteptat:** Refuz sau „nespecificat" — documentul de portabilitate nu
  menționează restricții de țară explicit, dar `01-mortgage-overview.md`
  afirmă că împrumuturile sunt acordate „within Romania"; agentul ar trebui
  să folosească acea excludere explicită, nu să presupună.
- **Surse:** `19-mortgage-portability.md` + `01-mortgage-overview.md`
- **Rezultat efectiv:** ⚠️ Parțial — a refuzat corect (nu a inventat un
  "da"), dar toate cele 4 fragmente recuperate au fost din
  `19-mortgage-portability`; `01-mortgage-overview` (cu excluderea explicită
  "within Romania") nu a fost recuperat deloc. Modelul a spus "nu e
  specificat" în loc de refuzul mai puternic, fundamentat pe restricția
  explicită — exact tiparul opus găsit la C3 din runda 1 (acolo excluderea
  explicită a fost găsită din întâmplare; aici, deși există, nu a fost
  recuperată).

**F2.** Ca aplicant nerezident, pot obține și reducerea green mortgage dacă
proprietatea are certificat energetic clasa A?
- **Așteptat:** Nu — `22-non-resident-borrower-eligibility.md` exclude
  explicit reducerea green mortgage pentru nerezidenți, indiferent de
  certificatul energetic.
- **Sursă:** `22-non-resident-borrower-eligibility.md`
- **Rezultat efectiv:** ❌ Greșit — toate cele 4 fragmente recuperate au fost
  din `20-green-mortgage-discount`; documentul 22 (care exclude explicit
  reducerea green mortgage pentru nerezidenți) nu a fost recuperat.
  Răspunsul a fost un non-răspuns ("nu e specificat, trimite-mi
  eligibilitatea produsului") în loc de "nu" — a treia întrebare din acest
  set ratată din cauza documentului 22 nefiind recuperat pentru propriile
  lui reguli cele mai specifice. **Retestat în engleză:** tot doar
  `20-green-mortgage-discount` (×4), documentul 22 tot absent — la fel ca E2,
  un bug real de recuperare (subiect dominant vs. mențiune secundară),
  neexplicat de limbă.

**F3.** Dacă nu sunt mulțumit de nivelul dobânzii aplicate, corect calculate
conform tabelului LTV, pot depune o reclamație formală ca să mi se
reducă?
- **Așteptat:** Nu ca reclamație — nemulțumirea față de nivelul dobânzii
  calculate corect nu e un motiv valid de reclamație; soluția indicată e
  refinanțarea sau schimbarea tipului de dobândă (rate-type switch), nu
  procesul de reclamații/escaladare.
- **Sursă:** `23-complaints-and-escalation.md`
- **Rezultat efectiv:** ✅ Corect — nemulțumirea față de o dobândă calculată
  corect nu e motiv de reclamație; a indicat corect refinanțarea/rate-type
  switch ca soluție, plus opțiuni corecte neserute (reducere hardship,
  escaladare CSALB).

---

## Rezumat (16 întrebări, Partea 1)

| # | Grup | Corect? | Notă |
|---|---|---|---|
| D1 | Simplu | ✅ | Fragmentul corect a avut cel mai mic scor din top-4 |
| D2 | Simplu | ✅ | |
| D3 | Simplu | ✅ | |
| D4 | Simplu | ✅ | |
| D5 | Simplu | ❌ | Doc. 22 nerecuperat — efect de limbă (retestat EN: recuperat corect) |
| D6 | Simplu | ✅ | |
| D7 | Simplu | ✅ | |
| D8 | Simplu | ✅ | |
| E1 | Multi-pas | ❌ | Doc. 22 nerecuperat — efect de limbă (retestat EN: recuperat corect) |
| E2 | Multi-pas | ❌ | Doc. 21/15 nerecuperate — bug real, confirmat și în engleză |
| E3 | Multi-pas | ✅ | |
| E4 | Multi-pas | ✅ | |
| E5 | Multi-pas | ✅ | |
| F1 | Trebuie refuzat | ⚠️ | Refuz corect, dar negrefundamentat (01 nerecuperat) |
| F2 | Trebuie refuzat | ❌ | Doc. 22 nerecuperat — bug real, confirmat și în engleză |
| F3 | Trebuie refuzat | ✅ | |

**Scor onest: 11/16 corect, 1 parțial (F1), 4 greșite (D5, E1, E2, F2).**
Comparativ cu runda 1 (14/15 corect, 1 parțial) — un scor vizibil mai slab.

**Observație principală:** toate cele 4 rateuri (D5, E1, E2, F2) au un
numitor comun aparent — documentul `22-non-resident-borrower-eligibility.md`
nu a fost recuperat nici măcar o dată din cele 4 întrebări care depindeau de
el. Am reluat aceleași 4 întrebări traduse în engleză ca să izolez cauza, iar
rezultatele se împart clar în două:

- **D5 și E1 au fost un efect de limbă, nu un bug de chunking.** În engleză,
  D5 recuperează `22-non-resident-borrower-eligibility` ca prim rezultat
  (scor 0.71, față de zero apariții în varianta română), iar E1 recuperează
  ambele documente necesare (`22` și `15-first-time-buyer-program`). Același
  corpus, aceleași fragmente — s-a schimbat doar limba întrebării. Recuperarea
  semantică încrucișată (întrebare RO → corpus EN) e vizibil mai slabă decât
  recuperarea pe aceeași limbă, cu `text-embedding-3-small`.
- **E2 și F2 sunt un bug real de recuperare, independent de limbă.** Reluate
  în engleză, ambele *tot* recuperează 4 fragmente doar din
  `20-green-mortgage-discount` — `21-buy-to-let-mortgage` și excluderea
  nerezidenților din documentul 22 nu apar nici acum. Ambele întrebări combină
  un subiect dominant, cu potrivire puternică (green mortgage discount), cu o
  referință secundară aflată într-un alt document (o clauză de excludere) —
  subiectul dominant ocupă toate sloturile de `top_k` și exclude complet
  mențiunea mai specifică, indiferent de limbă.

Modelul, în toate cele 4 cazuri, s-a comportat sigur (nu a inventat un
răspuns), dar a produs un non-răspuns în loc de refuzul/răspunsul ferm și
corect pe care corpusul chiar îl conține — o distincție importantă față de o
halucinație, dar tot un eșec de utilitate. Pas următor: pentru întrebări de
tipul E2/F2, recuperarea câte un fragment din fiecare din primele N surse
distincte (în loc de top-k pur după scor) ar rezolva probabil acest caz fără
să atingă problema de limbă.

---

## Partea 2 — Verificare vizibilitate UI pe rol (user vs admin)

Context: consola arăta câteva informații tehnice/admin oricărui rol —
modelul folosit, tipul de autentificare Azure, și — în fiecare răspuns din
chat — numele agentului, statusul „fundamentat", modul de rulare, modelul,
consumul de tokeni, verdictul de fact-check, pasajele recuperate și promptul
exact trimis către model. Toate acestea au fost ascunse acum pentru rolul
`user` (rămân vizibile doar pentru `admin`).

**Cum testezi:** loghează-te o dată cu un cont de rol `user` și o dată cu
unul de rol `admin` (sau schimbă rolul sesiunii, după cum e configurat
autentificarea), și compară ce se vede.

**Neverificat prin browser real** — Partea 1 de mai sus a fost testată direct
prin `/ask` (fără interfață), dar acest tabel cere click-uri reale în consolă,
iar mediul în care s-a rulat testarea nu a avut un instrument de automatizare
de browser disponibil (fără `chromium-cli`, fără Node/Playwright accesibil).
Am verificat doar static, în cod, că `clientMode` din `Chat.jsx` și `isUserRole`
din `App.jsx` condiționează exact aceste elemente — rândurile de mai jos NU
sunt rezultate dintr-un test real și nu trebuie citite ca atare.

| # | Verificare | Așteptat pentru `user` | Așteptat pentru `admin` |
|---|---|---|---|
| G1 | Bara de sus — pastila „provider · model" (ex. `azure · gpt-5-mini`) | Ascunsă | Vizibilă |
| G2 | Bara de sus — badge-ul de autentificare (`identitate Entra` / cheie) | Ascuns | Vizibil |
| G3 | Bara de sus — butonul de comutare consolă/client | Ascuns (deja era) | Vizibil |
| G4 | Chat — bara de setări (agent, unde rulează, RAG, fact-check, top-k, temperatură, export) | Ascunsă (deja era) | Vizibilă |
| G5 | Chat — sub fiecare răspuns: badge nume agent, „fundamentat"/„fără recuperare", mod, model, tokeni ↑↓ | Ascunse | Vizibile |
| G6 | Chat — blocul de fact-check (verdict, încredere, surse citate) | Ascuns | Vizibil (dacă fact-check e activat) |
| G7 | Chat — „N pasaje recuperate" (detalii RAG cu scoruri) | Ascuns | Vizibil |
| G8 | Chat — „promptul exact care a fost trimis" (system + user prompt) | Ascuns | Vizibil |
| G9 | Chat — răspunsul propriu-zis al asistentului și butonul de ascultare (text-to-speech) | Vizibile (rămân) | Vizibile |

Notează pentru fiecare rând: ✅ (corect) / ❌ (tot vizibil pentru user,
regresie) / ⚠️ (parțial).
