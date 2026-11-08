/**
 * Guess a category from the store name that Apple Pay / Google Pay / the bank
 * sends ("JUMBO LA REINA", "Copec", "UBER *TRIP"). Used only when the person has
 * never categorised that merchant before: their own choice always wins.
 *
 * Each rule lists category names to try in order, so it works both with the
 * default categories (Alimentación, Transporte…) and with ones people add
 * themselves (Supermercado, Restaurantes, Suscripciones…).
 */

type Rule = { re: RegExp; categories: string[] }

const RULES: Rule[] = [
  // Supermarkets
  { re: /\b(jumbo|lider|l[ií]der|unimarc|santa isabel|tottus|acuenta|alvi|mayorista ?10|ekono|oxxo|ok ?market|walmart|soriana|chedraui|carrefour|coto|disco\b|mercadona|eroski|wong|plaza vea|metro super|exito|[ée]xito|carulla|olimpica|ara\b|d1\b|pao de acucar|supermercado|minimarket|almacen|almac[ée]n|verduler|carnicer|panader)/,
    categories: ["Supermercado", "Alimentación"] },
  // Food & coffee
  { re: /\b(starbucks|juan valdez|dunkin|mcdonald|burger king|kfc|subway|domino|pizza|papa john|little caesars|telepizza|doggis|tarragona|melt|sushi|rappi|pedidos ?ya|uber ?eats|didi ?food|ifood|cafe|caf[ée]|cafeteria|restaurant|resto|bar\b|pub\b|taproom|cerveceria|helader|pasteler|empanad|food|comida)/,
    categories: ["Restaurantes", "Alimentación"] },
  // Transport & fuel
  { re: /\b(copec|shell|petrobras|aramco|enex|esso|texaco|ypf|pemex|primax|repsol|terpel|cepsa|bp\b|uber(?! ?eats)|cabify|didi(?! ?food)|indriver\b|metro\b|red movilidad|bip\b|tag\b|autopista|estacionamiento|parking|peaje|turbus|pullman|latam|sky airline|jetsmart|avianca|aerolineas|iberia)/,
    categories: ["Transporte"] },
  // Health
  { re: /\b(cruz verde|salcobrand|ahumada|farmacia|farmacias|dr\.? simi|similares|inkafarma|mifarma|guadalajara|clinica|cl[ií]nica|hospital|integramedica|redsalud|laboratorio|optica|[óo]ptica|dental|isapre|fonasa)/,
    categories: ["Salud"] },
  // Home & utilities
  { re: /\b(sodimac|easy\b|homecenter|home depot|leroy|ikea|construmart|enel|cge\b|chilquinta|aguas andinas|esval|essbio|metrogas|abastible|gasco|lipigas|vtr|movistar|entel|wom\b|claro|mundo pacifico|gtd\b|arriendo|condominio|gastos comunes)/,
    categories: ["Vivienda", "Servicios básicos"] },
  // Clothing & department stores
  { re: /\b(falabella|paris\b|ripley|h&m|h ?& ?m|zara|forever 21|adidas|nike|puma|skechers|bata\b|hush puppies|corona\b|tricot|la polar|hites|liverpool|el palacio|c&a|primark|mango|shein)/,
    categories: ["Ropa"] },
  // Entertainment & subscriptions
  { re: /\b(netflix|spotify|disney|hbo|max\b|prime video|amazon prime|apple\.com\/bill|itunes|youtube|playstation|xbox|nintendo|steam|cinemark|cinepolis|cineplanet|hoyts|ticketmaster|puntoticket|passline)/,
    categories: ["Suscripciones", "Entretenimiento"] },
  // Education
  { re: /\b(universidad|colegio|instituto|duoc|inacap|udemy|coursera|platzi|domestika|libreria|librer[ií]a|antartica|buscalibre)/,
    categories: ["Educación"] },
  // Pets
  { re: /\b(veterinari|pet ?shop|superzoo|club de perros|petco|mascota)/,
    categories: ["Mascotas", "Otros gastos"] },
]

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Category names to try for this merchant (most specific first), or [] if unknown. */
export function categoryHintsFor(merchant: string | null | undefined): string[] {
  if (!merchant) return []
  const m = norm(merchant).replace(/[*_]/g, " ")
  return RULES.find(r => r.re.test(m))?.categories ?? []
}

/** First of the hinted names that the person actually has. */
export function pickCategory<T extends { id: string; name: string }>(merchant: string | null | undefined, categories: T[]): T | null {
  const byName = new Map(categories.map(c => [norm(c.name), c]))
  for (const name of categoryHintsFor(merchant)) {
    const hit = byName.get(norm(name))
    if (hit) return hit
  }
  return null
}
