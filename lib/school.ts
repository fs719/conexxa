// School name from a .edu email. "fs719@georgetown.edu" -> "Georgetown", "x@nyu.edu" -> "NYU".
export function schoolFrom(email?: string | null): string | null {
  const e = (email || '').toLowerCase()
  const d = e.includes('@') ? e.split('@')[1] : e
  if (!d || !d.endsWith('.edu')) return null
  const label = d.split('.').slice(-2, -1)[0]
  if (!label) return null
  return label.length <= 4 ? label.toUpperCase() : label[0].toUpperCase() + label.slice(1)
}

// The school a person belongs to, from their email or domain. "a@mail.psu.edu" -> "psu.edu". Subdomains collapse to one school.
export function schoolDomain(emailOrDomain?: string | null): string {
  const e = (emailOrDomain || '').trim().toLowerCase()
  const d = e.includes('@') ? e.split('@')[1] : e
  const parts = d.split('.').filter(Boolean)
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.')
}

// People needed before a school opens. A school's own number in the schools table wins over this.
export const DEFAULT_GOAL = 70
