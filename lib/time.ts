// Supabase may return timestamps without a timezone suffix; they are UTC.
export const parseTs = (s: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s + 'Z')
