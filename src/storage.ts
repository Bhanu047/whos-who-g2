import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { clamp, emptyState, newGroup, newPerson, sampleState, type State } from './people'

const KEY = 'whoswho.state.v1'

/** Everything stays on the phone, in the Even app's storage for this plugin. */
export async function load(bridge: EvenAppBridge | null): Promise<State> {
  let raw = ''
  try {
    raw = bridge ? await bridge.getLocalStorage(KEY) : (localStorage.getItem(KEY) ?? '')
  } catch {
    raw = ''
  }
  try {
    const s = raw ? (JSON.parse(raw) as Partial<State>) : null
    if (!s || !Array.isArray(s.groups)) return devState() ?? emptyState()
    return clamp({
      groups: s.groups.map(g => ({ ...newGroup(g.name ?? ''), id: g.id ?? newGroup('').id, people: (g.people ?? []).map(p => newPerson(p)) })),
      group: s.group ?? 0,
      person: s.person ?? 0,
    })
  } catch {
    return emptyState()
  }
}

export async function save(bridge: EvenAppBridge | null, s: State): Promise<void> {
  const raw = JSON.stringify(s)
  try {
    if (bridge) await bridge.setLocalStorage(KEY, raw)
    else localStorage.setItem(KEY, raw)
  } catch (e) {
    console.warn('save failed', e)
  }
}

/**
 * Dev only: ?sample starts with the sample groups, &g=1&p=2 picks group and
 * person, &talked=1 marks them (for simulator screenshots).
 */
function devState(): State | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search)
  if (!q.has('sample')) return null
  const s = sampleState()
  s.group = Number(q.get('g')) || 0
  s.person = Number(q.get('p')) || 0
  const out = clamp(s)
  if (q.has('talked')) out.groups[out.group].people[out.person].talked = true
  if (q.has('talked2')) out.groups[out.group].people[(out.person + 1) % out.groups[out.group].people.length].talked = true
  return out
}
