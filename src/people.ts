/**
 * Who's Who data model. Pure functions only (unit-tested in Node).
 *
 * A Group is one occasion or circle: "Saturday dinner", "Acme team",
 * "Family reunion". Each Person has a name plus a few short cues you'd want
 * in your eyeline the moment you meet them.
 */

export interface Person {
  id: string
  name: string
  /** role or relationship: "Product lead", "Anna's husband" */
  role: string
  /** company / where they belong: "Acme Robotics" */
  org: string
  /** where/when you met: "CES 2025" */
  met: string
  /** the one thing to bring up: "her first marathon" */
  ask: string
  /** free notes, one per line */
  notes: string
  /** marked on the glasses once you've talked */
  talked: boolean
}

export interface Group {
  id: string
  name: string
  people: Person[]
}

export interface State {
  groups: Group[]
  /** index into groups */
  group: number
  /** index into the active group's people */
  person: number
}

export const newId = () => Math.random().toString(36).slice(2, 10)

export function newPerson(p: Partial<Person> = {}): Person {
  return {
    id: p.id ?? newId(),
    name: (p.name ?? '').trim(),
    role: (p.role ?? '').trim(),
    org: (p.org ?? '').trim(),
    met: (p.met ?? '').trim(),
    ask: (p.ask ?? '').trim(),
    notes: (p.notes ?? '').trim(),
    talked: p.talked ?? false,
  }
}

export function newGroup(name: string, people: Person[] = []): Group {
  return { id: newId(), name: name.trim() || 'Untitled', people }
}

export function emptyState(): State {
  return { groups: [], group: 0, person: 0 }
}

/** Keeps indexes in range after edits. */
export function clamp(s: State): State {
  const group = s.groups.length === 0 ? 0 : Math.min(Math.max(0, s.group), s.groups.length - 1)
  const n = s.groups[group]?.people.length ?? 0
  const person = n === 0 ? 0 : Math.min(Math.max(0, s.person), n - 1)
  return { ...s, group, person }
}

export function current(s: State): { group: Group | null; person: Person | null } {
  const group = s.groups[s.group] ?? null
  return { group, person: group?.people[s.person] ?? null }
}

/** Swipe on the glasses: wraps around the group. */
export function step(s: State, delta: number): State {
  const n = s.groups[s.group]?.people.length ?? 0
  if (n < 2) return s
  return { ...s, person: (((s.person + delta) % n) + n) % n }
}

export function toggleTalked(s: State): State {
  const { group, person } = current(s)
  if (!group || !person) return s
  const groups = s.groups.map((g, gi) =>
    gi !== s.group ? g : { ...g, people: g.people.map((p, pi) => (pi === s.person ? { ...p, talked: !p.talked } : p)) },
  )
  return { ...s, groups }
}

export function talkedCount(g: Group): number {
  return g.people.filter(p => p.talked).length
}

/** Moves a person within their group (phone reordering = seating order). */
export function move(people: Person[], from: number, to: number): Person[] {
  if (from < 0 || from >= people.length || to < 0 || to >= people.length) return people
  const out = [...people]
  const [x] = out.splice(from, 1)
  out.splice(to, 0, x)
  return out
}

/* ------------------------------- Import -------------------------------- */

/** Minimal RFC-4180-ish CSV line parser: commas, quotes, doubled quotes. */
export function parseCsvLine(line: string, sep = ','): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map(x => x.trim())
}

const HEADER_ALIASES: Record<keyof Omit<Person, 'id' | 'talked'>, RegExp> = {
  name: /^(full ?name|name|first name|person|attendee)$/i,
  role: /^(role|title|job ?title|position|relation(ship)?)$/i,
  org: /^(company|org(anization|anisation)?|employer|team|school)$/i,
  met: /^(met|where met|how met|context|event)$/i,
  ask: /^(ask|ask about|topic|talking point|talk about|icebreaker)$/i,
  notes: /^(notes?|details?|info|remember)$/i,
}

/**
 * Turns pasted text into people. Accepts:
 *  - CSV or TSV with a header row (Name, Title, Company, Notes, …) — e.g. an
 *    event attendee export or a LinkedIn connections CSV
 *  - CSV/TSV without a header: Name, Role, Company, Ask about, Notes
 *  - one name per line
 */
export function parsePeople(text: string): Person[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const rows = lines.map(l => parseCsvLine(l, sep))

  // LinkedIn's export has separate First/Last name columns.
  const head = rows[0].map(h => h.toLowerCase())
  const first = head.indexOf('first name')
  const last = head.indexOf('last name')
  const map: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {}
  rows[0].forEach((h, i) => {
    for (const [k, re] of Object.entries(HEADER_ALIASES)) {
      if (re.test(h) && map[k as keyof typeof HEADER_ALIASES] === undefined) map[k as keyof typeof HEADER_ALIASES] = i
    }
  })
  const hasHeader = map.name !== undefined || (first >= 0 && last >= 0)
  const body = hasHeader ? rows.slice(1) : rows
  const col = (r: string[], k: keyof typeof HEADER_ALIASES, fallback: number) =>
    (hasHeader ? (map[k] !== undefined ? r[map[k]!] : '') : r[fallback]) ?? ''

  return body
    .map(r => {
      const name = hasHeader && first >= 0 && last >= 0 ? `${r[first] ?? ''} ${r[last] ?? ''}` : col(r, 'name', 0)
      return newPerson({
        name,
        role: col(r, 'role', 1),
        org: col(r, 'org', 2),
        ask: col(r, 'ask', 3),
        notes: col(r, 'notes', 4),
        met: col(r, 'met', 5),
      })
    })
    .filter(p => p.name.length > 0)
}

/* ------------------------------- Display -------------------------------- */

/** Lines for the right-hand cue panel, most useful first, skipping blanks. */
export function cueLines(p: Person): string[] {
  const out: string[] = []
  if (p.met) out.push(`Met: ${p.met}`)
  if (p.ask) out.push(`Ask about: ${p.ask}`)
  for (const n of p.notes.split('\n').map(x => x.trim()).filter(Boolean)) out.push(n)
  return out
}

/** Splits a display name into at most two balanced lines for the big tile. */
export function nameLines(name: string): [string] | [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [words[0] ?? '']
  // Find the split that best balances line length.
  let best = 1
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length
    const b = words.slice(i).join(' ').length
    const d = Math.abs(a - b)
    if (d < bestDiff) {
      bestDiff = d
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

/* -------------------------------- Sample -------------------------------- */

/** Shown by "Load sample": lets new users (and reviewers) see it working. */
export function sampleState(): State {
  return {
    groups: [
      newGroup('Saturday dinner', [
        newPerson({ name: 'Maria Chen', role: 'Product lead', org: 'Acme Robotics', met: 'CES 2025', ask: 'her first marathon', notes: 'Kids: Leo (7)\nWants a demo in Dec' }),
        newPerson({ name: 'David Okafor', role: "Maria's husband", org: 'Architect', met: 'Last summer BBQ', ask: 'the lake house build', notes: 'Vegetarian\nBig Arsenal fan' }),
        newPerson({ name: 'Priya Nair', role: 'Neighbor', org: 'Teaches 3rd grade', met: 'Moved in May', ask: 'her new puppy, Biscuit', notes: 'Pronounced PREE-ya' }),
        newPerson({ name: 'Tom Becker', role: 'CFO', org: 'Acme Robotics', met: "Maria's intro", ask: 'Q1 budget timing', notes: 'Prefers email follow-ups' }),
      ]),
      newGroup('Family reunion', [
        newPerson({ name: 'Aunt Rosa', role: "Mom's sister", org: 'Lives in Tucson', ask: 'her garden', notes: 'Hip surgery in spring' }),
        newPerson({ name: 'Ken Ito', role: "Cousin Amy's husband", org: 'Nurse', ask: 'their trip to Japan', notes: 'Twins: Mei & Sora (4)' }),
      ]),
    ],
    group: 0,
    person: 0,
  }
}
