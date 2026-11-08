/**
 * Where the person lives drives the smart defaults: which banks and wallets we
 * suggest, the currency of their first account and the size of quick-amount chips.
 */

type Bank = { name: string; color: string }
export type Country = {
  code: string
  name: string
  flag: string
  currency: string
  /** Units of the local currency per US dollar (rough, only to size quick amounts). */
  perUsd: number
  banks: Bank[]
}

const C = (name: string, color: string): Bank => ({ name, color })

export const COUNTRIES: Country[] = [
  { code: "CL", name: "Chile", flag: "🇨🇱", currency: "CLP", perUsd: 950, banks: [
    C("BancoEstado", "#ff9500"), C("Santander", "#ff3b30"), C("Banco de Chile", "#007aff"), C("BCI", "#1d1d1f"),
    C("Scotiabank", "#e63946"), C("Itaú", "#ff9500"), C("Banco Falabella", "#34c759"), C("Mercado Pago", "#007aff"),
    C("Tenpo", "#bf5af2"), C("BICE", "#007aff")] },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", perUsd: 1300, banks: [
    C("Banco Nación", "#007aff"), C("Galicia", "#ff9500"), C("Santander", "#ff3b30"), C("BBVA", "#007aff"),
    C("Macro", "#007aff"), C("Banco Provincia", "#34c759"), C("Mercado Pago", "#007aff"), C("Ualá", "#ff3b30"),
    C("Brubank", "#bf5af2"), C("Naranja X", "#ff9500")] },
  { code: "MX", name: "México", flag: "🇲🇽", currency: "MXN", perUsd: 18, banks: [
    C("BBVA", "#007aff"), C("Banorte", "#ff3b30"), C("Santander", "#ff3b30"), C("Banamex", "#007aff"),
    C("HSBC", "#e63946"), C("Scotiabank", "#e63946"), C("Nu", "#bf5af2"), C("Mercado Pago", "#007aff"),
    C("Banco Azteca", "#34c759"), C("Hey Banco", "#1d1d1f")] },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", perUsd: 4000, banks: [
    C("Bancolombia", "#ff9500"), C("Davivienda", "#ff3b30"), C("Banco de Bogotá", "#007aff"), C("BBVA", "#007aff"),
    C("Banco de Occidente", "#007aff"), C("Scotiabank Colpatria", "#e63946"), C("Nequi", "#bf5af2"),
    C("Daviplata", "#ff3b30"), C("Nu", "#bf5af2"), C("Lulo Bank", "#34c759")] },
  { code: "PE", name: "Perú", flag: "🇵🇪", currency: "PEN", perUsd: 3.7, banks: [
    C("BCP", "#007aff"), C("Interbank", "#34c759"), C("BBVA", "#007aff"), C("Scotiabank", "#e63946"),
    C("Banco de la Nación", "#ff3b30"), C("BanBif", "#007aff"), C("Mibanco", "#34c759"), C("Banco Falabella", "#34c759"),
    C("Yape", "#bf5af2")] },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", currency: "UYU", perUsd: 40, banks: [
    C("BROU", "#007aff"), C("Santander", "#ff3b30"), C("Itaú", "#ff9500"), C("BBVA", "#007aff"),
    C("Scotiabank", "#e63946"), C("Prex", "#34c759"), C("Mercado Pago", "#007aff"), C("OCA", "#007aff")] },
  { code: "BR", name: "Brasil", flag: "🇧🇷", currency: "BRL", perUsd: 5.5, banks: [
    C("Nubank", "#bf5af2"), C("Itaú", "#ff9500"), C("Bradesco", "#ff3b30"), C("Banco do Brasil", "#ff9500"),
    C("Caixa", "#007aff"), C("Santander", "#ff3b30"), C("Inter", "#ff9500"), C("C6 Bank", "#1d1d1f"),
    C("Mercado Pago", "#007aff"), C("PicPay", "#34c759")] },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", currency: "USD", perUsd: 1, banks: [
    C("Banco de Venezuela", "#ff3b30"), C("Banesco", "#34c759"), C("Mercantil", "#007aff"), C("Provincial", "#007aff"),
    C("BNC", "#007aff"), C("Bancamiga", "#34c759"), C("Bancaribe", "#ff9500"), C("Zinli", "#bf5af2"), C("Binance", "#ff9500")] },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", currency: "USD", perUsd: 1, banks: [
    C("Banco Pichincha", "#ff9500"), C("Produbanco", "#34c759"), C("Banco Guayaquil", "#ff3b30"),
    C("Banco del Pacífico", "#007aff"), C("Banco Bolivariano", "#007aff"), C("Banco Internacional", "#ff3b30")] },
  { code: "ES", name: "España", flag: "🇪🇸", currency: "EUR", perUsd: 0.9, banks: [
    C("Santander", "#ff3b30"), C("BBVA", "#007aff"), C("CaixaBank", "#007aff"), C("Sabadell", "#007aff"),
    C("Bankinter", "#ff9500"), C("ING", "#ff9500"), C("Openbank", "#ff3b30"), C("Unicaja", "#34c759"),
    C("Revolut", "#1d1d1f"), C("N26", "#34c759")] },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸", currency: "USD", perUsd: 1, banks: [
    C("Chase", "#007aff"), C("Bank of America", "#e63946"), C("Wells Fargo", "#ff3b30"), C("Citi", "#007aff"),
    C("Capital One", "#007aff"), C("Apple Card", "#1d1d1f"), C("Discover", "#ff9500"), C("Chime", "#34c759"),
    C("PayPal", "#007aff")] },
  { code: "XX", name: "Otro país", flag: "🌎", currency: "USD", perUsd: 1, banks: [
    C("PayPal", "#007aff"), C("Wise", "#34c759"), C("Revolut", "#1d1d1f"), C("Mercado Pago", "#007aff")] },
]

export const COUNTRY_CODES = COUNTRIES.map(c => c.code) as [string, ...string[]]
export const DEFAULT_COUNTRY = "CL"

export function countryOf(code?: string | null): Country {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0]
}

const TZ: [RegExp, string][] = [
  [/^America\/(Santiago|Punta_Arenas)|^Pacific\/Easter/, "CL"],
  [/^America\/(Argentina\/|Buenos_Aires|Cordoba|Mendoza)/, "AR"],
  [/^America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana)/, "MX"],
  [/^America\/Bogota/, "CO"],
  [/^America\/Lima/, "PE"],
  [/^America\/Montevideo/, "UY"],
  [/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha|Eirunepe)/, "BR"],
  [/^America\/Caracas/, "VE"],
  [/^America\/Guayaquil|^Pacific\/Galapagos/, "EC"],
  [/^Europe\/Madrid|^Atlantic\/Canary|^Africa\/Ceuta/, "ES"],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana\/|Kentucky\/|Boise)|^Pacific\/Honolulu/, "US"],
]

/** Best guess from the browser (time zone first, then language region). Client-only. */
export function guessCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
    const hit = TZ.find(([re]) => re.test(tz))
    if (hit) return hit[1]
    for (const lang of navigator.languages ?? []) {
      const region = lang.split("-")[1]?.toUpperCase()
      if (region && COUNTRIES.some(c => c.code === region)) return region
    }
  } catch { /* not in a browser */ }
  return DEFAULT_COUNTRY
}

/** Round to a "nice" number: 1, 2, 2.5 or 5 × 10^k. */
function nice(n: number) {
  if (n <= 0) return 0
  const p = 10 ** Math.floor(Math.log10(n))
  const m = n / p
  return (m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p
}

/** A quick amount written in CLP, translated to a similar round amount in this country's currency. */
export function localAmount(clp: number, country: Country) {
  return nice((clp / 950) * country.perUsd)
}

/** Round a monthly figure up to a tidy step for this currency ($1.000 in Chile, $1 in the US). */
export function roundUp(n: number, country: Country) {
  const step = Math.max(1, nice(country.perUsd))
  return Math.ceil(n / step) * step
}

export function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find(p => p.type === "currency")?.value ?? "$"
  } catch { return "$" }
}

/** Compact amount for chips: $150 mil, $1,5 M, €250. */
export function fmtShortIn(n: number, currency: string) {
  const s = currencySymbol(currency)
  if (n >= 1_000_000) return `${s}${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`
  if (n >= 10_000) return `${s}${Math.round(n / 1_000)} mil`
  return `${s}${n.toLocaleString("es-CL")}`
}
