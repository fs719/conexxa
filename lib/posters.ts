// The campus QR posters (approved by F on 2026-11-20). Each code opens its own school's page: gu1 to gu5 Georgetown,
// gw1 to gw5 GW. The headline is the line printed on that poster, so the page the student lands on says the same thing.
export type Poster = { code: string; domain: string; school: string; line: string }

const LINES = [
  'Does your crush like you back?',
  'Thinking about someone right now?',
  'Your crush is dating someone braver than you.',
  'Your crush is about to find out.',
  "The one you never told is the one you'll think about at 30.",
]
const SCHOOLS: Record<string, { domain: string; school: string; legal: string }> = {
  gu: { domain: 'georgetown.edu', school: 'Georgetown', legal: 'Georgetown University' },
  gw: { domain: 'gwu.edu', school: 'GW', legal: 'The George Washington University' },
}

// "gu3" -> Georgetown's third poster. Anything else -> null, so an unknown code just shows the normal page.
export function posterFor(raw?: string | string[] | null): (Poster & { legal: string }) | null {
  const code = String(Array.isArray(raw) ? raw[0] : raw || '').trim().toLowerCase()
  const m = /^(gu|gw)([1-5])$/.exec(code)
  if (!m) return null
  const s = SCHOOLS[m[1]]
  return { code, domain: s.domain, school: s.school, legal: s.legal, line: LINES[Number(m[2]) - 1] }
}

// The school name to show for a domain: the poster's own name where we have one ("GW", not "GWU").
export function schoolName(domain: string, fallback: string): string {
  const hit = Object.values(SCHOOLS).find(s => s.domain === domain)
  return hit ? hit.school : fallback
}
