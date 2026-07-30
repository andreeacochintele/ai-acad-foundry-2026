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

**D2.** Ce condiții trebuie îndeplinite ca să pot cere un top-up pe un credit
ipotecar existent?
- **Așteptat:** minim 12 luni consecutive cu plăți la timp (fără eveniment de
  întârziere), plus LTV combinat (credit original + top-up) ≤ 80% din
  valoarea reevaluată a proprietății (necesită o reevaluare nouă, pe costul
  clientului).
- **Sursă:** `18-mortgage-top-up.md`

**D3.** Care e reducerea de dobândă pentru un credit ipotecar verde (green
mortgage), și ce certificat energetic e necesar?
- **Așteptat:** 0.15 puncte procentuale, pentru un imobil cu certificat de
  performanță energetică clasa A sau B, emis în ultimii 5 ani; reducerea se
  aplică doar perioadei fixe, nu marjei perioadei variabile.
- **Sursă:** `20-green-mortgage-discount.md`

**D4.** Ce avans minim se cere pentru un credit buy-to-let, față de o
locuință proprie?
- **Așteptat:** 25% pentru buy-to-let, față de 15% pentru locuința proprie.
- **Sursă:** `21-buy-to-let-mortgage.md` (+ `02-eligibility-criteria.md`)

**D5.** Ca aplicant nerezident, ce avans minim mi se cere?
- **Așteptat:** 30% din valoarea evaluată, indiferent dacă e prima
  locuință, a doua locuință sau proprietate de închiriat — nivelurile
  diferențiate din criteriile de eligibilitate standard nu se aplică
  nerezidenților.
- **Sursă:** `22-non-resident-borrower-eligibility.md`

**D6.** În câte zile lucrătoare confirmă banca primirea unei reclamații, și
în câte zile calendaristice răspunde?
- **Așteptat:** confirmare în 2 zile lucrătoare; răspuns complet în 15 zile
  calendaristice pentru o reclamație simplă, respectiv 30 de zile pentru una
  care necesită investigarea unei decizii de creditare sau un caz de
  dificultate financiară (hardship).
- **Sursă:** `23-complaints-and-escalation.md`

**D7.** La un credit pentru o locuință în construcție (new-build), plătesc
dobândă la toată suma aprobată de la început?
- **Așteptat:** Nu — dobânda se plătește doar la suma efectiv trasă până în
  acel moment, până la ultima tranșă (la predare), moment în care creditul
  devine un credit ipotecar standard cu amortizare.
- **Sursă:** `24-new-build-staged-drawdown.md`

**D8.** De câte ori pot cere o schimbare a tipului de dobândă (fix ↔
variabil) pe durata unui credit, și ce taxă implică?
- **Așteptat:** O singură dată pe durata creditului, cu o taxă de
  administrare de 150 EUR; cererea trebuie depusă cu cel puțin 30 de zile
  înainte de data aniversară a creditului, iar schimbarea intră în vigoare
  doar la acea dată aniversară.
- **Sursă:** `25-rate-type-switch-mid-term.md`

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

**E3.** Am folosit deja o schimbare de tip de dobândă acum doi ani. Vreau să
mai fac una acum, ca să trec iar pe fix. Se poate?
- **Așteptat:** Nu — o singură schimbare permisă pe durata creditului;
  pentru o a doua schimbare, clientul trebuie să folosească refinanțarea sau
  portabilitatea.
- **Sursă:** `25-rate-type-switch-mid-term.md`

**E4.** Dezvoltatorul de la proiectul meu new-build a dat faliment după ce
mi s-au eliberat 2 din 5 tranșe. Mai datorez banii aceia băncii?
- **Așteptat:** Da — răspunderea clientului pentru tranșele deja eliberate
  rămâne neschimbată; expunerea băncii se limitează la tranșele eliberate,
  iar orice dispută cu dezvoltatorul e între client și dezvoltator, nu bancă.
- **Sursă:** `24-new-build-staged-drawdown.md`

**E5.** Care e diferența dintre portabilitate și refinanțare — dacă îmi mut
creditul pe o casă nouă, e același lucru?
- **Așteptat:** Nu. Refinanțarea schimbă cine deține creditul (sau
  restructurează termenii), păstrând aceeași proprietate; portabilitatea
  păstrează același credit și aceeași bancă, dar schimbă proprietatea care
  garantează creditul. Sunt independente — un credit portat poate fi ulterior
  refinanțat, și invers.
- **Sursă:** `19-mortgage-portability.md`

---

### Grup F — trebuie refuzat / informație absentă din corpus

**F1.** Pot folosi portabilitatea ca să mut creditul pe o proprietate din
altă țară?
- **Așteptat:** Refuz sau „nespecificat" — documentul de portabilitate nu
  menționează restricții de țară explicit, dar `01-mortgage-overview.md`
  afirmă că împrumuturile sunt acordate „within Romania"; agentul ar trebui
  să folosească acea excludere explicită, nu să presupună.
- **Surse:** `19-mortgage-portability.md` + `01-mortgage-overview.md`

**F2.** Ca aplicant nerezident, pot obține și reducerea green mortgage dacă
proprietatea are certificat energetic clasa A?
- **Așteptat:** Nu — `22-non-resident-borrower-eligibility.md` exclude
  explicit reducerea green mortgage pentru nerezidenți, indiferent de
  certificatul energetic.
- **Sursă:** `22-non-resident-borrower-eligibility.md`

**F3.** Dacă nu sunt mulțumit de nivelul dobânzii aplicate, corect calculate
conform tabelului LTV, pot depune o reclamație formală ca să mi se
reducă?
- **Așteptat:** Nu ca reclamație — nemulțumirea față de nivelul dobânzii
  calculate corect nu e un motiv valid de reclamație; soluția indicată e
  refinanțarea sau schimbarea tipului de dobândă (rate-type switch), nu
  procesul de reclamații/escaladare.
- **Sursă:** `23-complaints-and-escalation.md`

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
