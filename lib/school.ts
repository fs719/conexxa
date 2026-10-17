// School name from a .edu email. "fs719@georgetown.edu" -> "Georgetown", "x@nyu.edu" -> "NYU".
export function schoolFrom(email?: string | null): string | null {
  const d = (email || '').split('@')[1]?.toLowerCase()
  if (!d || !d.endsWith('.edu')) return null
  const label = d.split('.').slice(-2, -1)[0]
  if (!label) return null
  return label.length <= 4 ? label.toUpperCase() : label[0].toUpperCase() + label.slice(1)
}
