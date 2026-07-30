import { useMemo, useState } from 'react'
import { PageHeader, Panel, PanelGrid, StatGrid, StatTile } from '../components'
import { useLanguage } from '../i18n.jsx'

// Mirrors data/08-loan-to-value-rate-table.md exactly. Only 5- and 10-year fixed
// periods are tabulated there — data/03-interest-rate-structure.md mentions a
// 7-year rate-lock option, but the corpus never quotes a rate for it, so this
// calculator only offers the two periods it can actually price.
// labelKey is a translation key, resolved with t() at render time.
const LTV_TIERS = [
  { maxLtv: 60, labelKey: 'calc.tier.60', rate5: 6.20, rate10: 6.80 },
  { maxLtv: 75, labelKey: 'calc.tier.75', rate5: 6.45, rate10: 7.05 },
  { maxLtv: 85, labelKey: 'calc.tier.85', rate5: 6.75, rate10: 7.35 },
  { maxLtv: 90, labelKey: 'calc.tier.90', rate5: 7.10, rate10: 7.70, ftbOnly: true },
]

const DSTI_LIMIT = 40          // data/02-eligibility-criteria.md
const GREEN_DISCOUNT = 0.15    // data/20-green-mortgage-discount.md
const FTB_MAX_VALUE = 150000   // data/15-first-time-buyer-program.md, in EUR

// The corpus itself is EUR-denominated ("500,000 EUR or the RON equivalent" —
// data/01-mortgage-overview.md), so amounts are kept in EUR as the canonical
// unit internally; a chosen currency only affects what's typed and displayed.
// This is a fixed reference rate for the calculator, not a live feed — the
// corpus's own non-resident document uses the same idea (an ECB reference
// rate) for converting foreign income, just not a specific number.
const EUR_TO_RON = 4.97
const CURRENCIES = ['EUR', 'RON']

function fromEur(amountEur, currency) {
  return currency === 'RON' ? amountEur * EUR_TO_RON : amountEur
}
function toEur(amountInCurrency, currency) {
  return currency === 'RON' ? amountInCurrency / EUR_TO_RON : amountInCurrency
}

function monthlyPayment(principal, annualRatePct, years) {
  const r = annualRatePct / 100 / 12
  const n = years * 12
  if (n <= 0) return 0
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

function fmtMoney(amountEur, currency) {
  return fromEur(amountEur || 0, currency)
    .toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
}

export default function Calculator() {
  const { t } = useLanguage()
  // Canonical amounts stay in EUR regardless of the chosen display currency —
  // only the input fields and the results convert, via fromEur/toEur.
  const [currency, setCurrency] = useState('EUR')
  const [propertyValue, setPropertyValue] = useState(120000)
  const [downPayment, setDownPayment] = useState(18000)
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(false)
  const [greenProperty, setGreenProperty] = useState(false)
  const [fixedPeriod, setFixedPeriod] = useState(5)
  const [termYears, setTermYears] = useState(25)
  const [salary, setSalary] = useState(1800)

  const loanAmount = Math.max(0, propertyValue - downPayment)
  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0
  const downPaymentPct = propertyValue > 0 ? (downPayment / propertyValue) * 100 : 0
  const ftbValueOk = propertyValue <= FTB_MAX_VALUE

  // The first tier (in ascending LTV order) that this loan actually qualifies
  // for — the >90% LTV case (or an over-value First-Time Buyer case) matches
  // no tier at all, same as the bank declining to price it.
  const tier = useMemo(() => {
    if (loanAmount <= 0) return null
    return LTV_TIERS.find((t) => (!t.ftbOnly || (firstTimeBuyer && ftbValueOk)) && ltv <= t.maxLtv) || null
  }, [ltv, firstTimeBuyer, ftbValueOk, loanAmount])

  const baseRate = tier ? (fixedPeriod === 10 ? tier.rate10 : tier.rate5) : null
  const rate = baseRate != null ? baseRate - (greenProperty ? GREEN_DISCOUNT : 0) : null
  const payment = rate != null ? monthlyPayment(loanAmount, rate, termYears) : null
  const dsti = payment != null && salary > 0 ? (payment / salary) * 100 : null
  const totalInterest = payment != null ? payment * termYears * 12 - loanAmount : null

  return (
    <>
      <PageHeader title={t('calc.title')}>
        {t('calc.description')}
      </PageHeader>

      <PanelGrid>
        <Panel title={t('calc.yourLoan')}>
          <label>{t('calc.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {currency === 'RON' && (
            <p className="faint" style={{ margin: '.3rem 0 0' }}>
              {t('calc.ronNote', { rate: EUR_TO_RON })}
            </p>
          )}

          <label style={{ marginTop: '.7rem' }}>{t('calc.propertyValue', { currency })}</label>
          <input type="number" min="0" step={currency === 'RON' ? 5000 : 1000}
                 value={Math.round(fromEur(propertyValue, currency))}
                 onChange={(e) => setPropertyValue(Math.max(0, toEur(Number(e.target.value), currency)))} />

          <label style={{ marginTop: '.7rem' }}>{t('calc.downPayment', { currency })}</label>
          <input type="number" min="0" step={currency === 'RON' ? 2500 : 500}
                 value={Math.round(fromEur(downPayment, currency))}
                 onChange={(e) => setDownPayment(Math.max(0, toEur(Number(e.target.value), currency)))} />
          <p className="faint" style={{ margin: '.3rem 0 0' }}>
            {t('calc.downPaymentSummary', {
              pct: downPaymentPct.toFixed(1), ltv: ltv.toFixed(1), amount: fmtMoney(loanAmount, currency),
            })}
          </p>

          <label className="check" style={{ marginTop: '.8rem' }}>
            <input type="checkbox" checked={firstTimeBuyer}
                   onChange={(e) => setFirstTimeBuyer(e.target.checked)} />
            {t('calc.firstTimeBuyer')}
          </label>
          {firstTimeBuyer && !ftbValueOk && (
            <p className="faint" style={{ color: 'var(--c-crimson)', margin: '.3rem 0 0' }}>
              {t('calc.ftbWarning', { amount: fmtMoney(FTB_MAX_VALUE, currency) })}
            </p>
          )}

          <label className="check" title={t('calc.greenPropertyTitle')}>
            <input type="checkbox" checked={greenProperty}
                   onChange={(e) => setGreenProperty(e.target.checked)} />
            {t('calc.greenProperty', { pp: GREEN_DISCOUNT })}
          </label>

          <div className="row" style={{ marginTop: '.7rem' }}>
            <div>
              <label>{t('calc.fixedPeriod')}</label>
              <select value={fixedPeriod} onChange={(e) => setFixedPeriod(Number(e.target.value))}>
                <option value={5}>{t('calc.years5')}</option>
                <option value={10}>{t('calc.years10')}</option>
              </select>
            </div>
            <div>
              <label>{t('calc.loanTerm')}</label>
              <input type="number" min="5" max="30" value={termYears}
                     onChange={(e) => setTermYears(Math.min(30, Math.max(5, Number(e.target.value))))} />
            </div>
          </div>

          <label style={{ marginTop: '.7rem' }}>{t('calc.salary', { currency })}</label>
          <input type="number" min="0" step={currency === 'RON' ? 250 : 50}
                 value={Math.round(fromEur(salary, currency))}
                 onChange={(e) => setSalary(Math.max(0, toEur(Number(e.target.value), currency)))} />
          <p className="faint" style={{ margin: '.3rem 0 0' }}>
            {t('calc.salaryNote')}
          </p>
        </Panel>

        <Panel title={t('calc.result')}>
          {!tier ? (
            <p className="muted">
              {loanAmount <= 0
                ? t('calc.enterValue')
                : t('calc.exceedsFinancing', {
                    ltv: ltv.toFixed(1),
                    ftbHint: firstTimeBuyer ? '' : t('calc.ftbHint'),
                  })}
            </p>
          ) : (
            <>
              <StatGrid>
                <StatTile label={t('calc.monthlyPayment')} value={fmtMoney(payment, currency)} />
                <StatTile label={t('calc.startingRate', { years: fixedPeriod })} value={`${rate.toFixed(2)}%`} />
              </StatGrid>

              <p className="faint">
                {t('calc.rateTierLine', { tier: t(tier.labelKey) })}
                {greenProperty && t('calc.greenIncluded', { pp: GREEN_DISCOUNT })}
                {t('calc.fixedPeriodNote', { years: fixedPeriod })}
              </p>

              {salary > 0 && (
                <p style={{ marginTop: '.6rem' }}>
                  <span className={`badge ${dsti > DSTI_LIMIT ? 'crimson' : 'gold'}`}>
                    {t('calc.dstiOfSalary', { dsti: dsti.toFixed(1) })}
                    {dsti > DSTI_LIMIT
                      ? t('calc.dstiAbove', { limit: DSTI_LIMIT })
                      : t('calc.dstiWithin', { limit: DSTI_LIMIT })}
                  </span>
                </p>
              )}

              <p className="faint" style={{ marginTop: '.6rem' }}>
                {t('calc.totalInterest', { years: termYears, amount: fmtMoney(totalInterest, currency) })}
              </p>
            </>
          )}
        </Panel>
      </PanelGrid>
    </>
  )
}
