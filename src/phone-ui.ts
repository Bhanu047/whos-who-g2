import {
  clamp, current, move, newGroup, newPerson, parsePeople, sampleState, step, talkedCount, toggleTalked,
  type Person, type State,
} from './people'

export interface PhoneProps {
  initial: State
  hasGlasses: boolean
  onChange: (s: State) => Promise<void> | void
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const copy = (s: State): State => JSON.parse(JSON.stringify(s))

export function mountPhoneUi(props: PhoneProps) {
  let s = copy(props.initial)
  let editing: { person: Person; isNew: boolean } | null = null

  $('glasses-note').textContent = props.hasGlasses
    ? 'Connected. Swipe on the glasses or ring to move between people; tap to mark ✓ talked.'
    : 'Running in a browser without the Even app.'

  const change = async (next: State) => {
    s = clamp(next)
    render()
    await props.onChange(copy(s))
  }

  /* ---------- groups ---------- */
  const groupSel = $<HTMLSelectElement>('group')
  groupSel.addEventListener('change', () => change({ ...s, group: Number(groupSel.value), person: 0 }))
  $('new-group').addEventListener('click', () => {
    const name = prompt('Group name (e.g. "Saturday dinner")')
    if (!name?.trim()) return
    void change({ ...s, groups: [...s.groups, newGroup(name)], group: s.groups.length, person: 0 })
  })
  $('rename-group').addEventListener('click', () => {
    const g = s.groups[s.group]
    if (!g) return
    const name = prompt('Rename group', g.name)
    if (!name?.trim()) return
    const groups = s.groups.map((x, i) => (i === s.group ? { ...x, name: name.trim() } : x))
    void change({ ...s, groups })
  })
  $('delete-group').addEventListener('click', () => {
    const g = s.groups[s.group]
    if (!g || !confirm(`Delete "${g.name}" and its ${g.people.length} people from this phone?`)) return
    void change({ ...s, groups: s.groups.filter((_, i) => i !== s.group), group: 0, person: 0 })
  })
  $('reset-talked').addEventListener('click', () => {
    const groups = s.groups.map((g, i) => (i === s.group ? { ...g, people: g.people.map(p => ({ ...p, talked: false })) } : g))
    void change({ ...s, groups })
  })

  /* ---------- glasses mirror controls ---------- */
  $('prev').addEventListener('click', () => change(step(s, -1)))
  $('next').addEventListener('click', () => change(step(s, 1)))
  $('talked').addEventListener('click', () => change(toggleTalked(s)))

  /* ---------- people list ---------- */
  const list = $('people')
  list.addEventListener('click', ev => {
    const btn = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (!btn) return
    const i = Number(btn.dataset.i)
    const g = s.groups[s.group]
    if (!g) return
    if (btn.dataset.act === 'show') void change({ ...s, person: i })
    if (btn.dataset.act === 'up' || btn.dataset.act === 'down') {
      const to = btn.dataset.act === 'up' ? i - 1 : i + 1
      const people = move(g.people, i, to)
      if (people === g.people) return
      const groups = s.groups.map((x, gi) => (gi === s.group ? { ...x, people } : x))
      // Keep the glasses on the same person after reordering.
      const showing = g.people[s.person]?.id
      void change({ ...s, groups, person: Math.max(0, people.findIndex(p => p.id === showing)) })
    }
    if (btn.dataset.act === 'edit') openEditor(g.people[i], false)
  })

  $('add-person').addEventListener('click', () => {
    if (!s.groups[s.group]) {
      void change({ ...s, groups: [newGroup('My people')], group: 0, person: 0 }).then(() => openEditor(newPerson(), true))
    } else openEditor(newPerson(), true)
  })

  /* ---------- editor ---------- */
  const f = {
    card: $('editor'), title: $('editor-title'), del: $<HTMLButtonElement>('e-delete'),
    name: $<HTMLInputElement>('e-name'), role: $<HTMLInputElement>('e-role'), org: $<HTMLInputElement>('e-org'),
    met: $<HTMLInputElement>('e-met'), ask: $<HTMLInputElement>('e-ask'), notes: $<HTMLTextAreaElement>('e-notes'),
  }
  function openEditor(p: Person, isNew: boolean) {
    editing = { person: p, isNew }
    f.title.textContent = isNew ? 'Add person' : `Edit ${p.name}`
    f.name.value = p.name
    f.role.value = p.role
    f.org.value = p.org
    f.met.value = p.met
    f.ask.value = p.ask
    f.notes.value = p.notes
    f.del.classList.toggle('hidden', isNew)
    f.card.classList.remove('hidden')
    f.card.scrollIntoView({ behavior: 'smooth', block: 'start' })
    f.name.focus()
  }
  const closeEditor = () => {
    editing = null
    f.card.classList.add('hidden')
  }
  $('e-cancel').addEventListener('click', closeEditor)
  $('e-save').addEventListener('click', () => {
    if (!editing) return
    if (!f.name.value.trim()) {
      f.name.focus()
      return
    }
    const p = newPerson({
      ...editing.person,
      name: f.name.value, role: f.role.value, org: f.org.value, met: f.met.value, ask: f.ask.value, notes: f.notes.value,
    })
    const g = s.groups[s.group]
    const people = editing.isNew ? [...g.people, p] : g.people.map(x => (x.id === p.id ? p : x))
    const groups = s.groups.map((x, i) => (i === s.group ? { ...x, people } : x))
    const person = editing.isNew ? people.length - 1 : s.person
    closeEditor()
    void change({ ...s, groups, person })
  })
  $('e-delete').addEventListener('click', () => {
    if (!editing || !confirm(`Remove ${editing.person.name}?`)) return
    const id = editing.person.id
    const groups = s.groups.map((x, i) => (i === s.group ? { ...x, people: x.people.filter(p => p.id !== id) } : x))
    closeEditor()
    void change({ ...s, groups })
  })

  /* ---------- import ---------- */
  $('import-btn').addEventListener('click', () => {
    const box = $<HTMLTextAreaElement>('import')
    const msg = $('import-msg')
    const people = parsePeople(box.value)
    if (people.length === 0) {
      msg.textContent = 'Nothing to import: paste names or a CSV first.'
      msg.className = 'msg err'
      return
    }
    const base = s.groups[s.group] ? s : { ...s, groups: [newGroup('Imported')], group: 0, person: 0 }
    const groups = base.groups.map((x, i) => (i === base.group ? { ...x, people: [...x.people, ...people] } : x))
    box.value = ''
    msg.textContent = `Added ${people.length} ${people.length === 1 ? 'person' : 'people'}.`
    msg.className = 'msg ok'
    void change({ ...base, groups })
  })

  $('sample').addEventListener('click', () => {
    const sample = sampleState()
    void change({ groups: [...s.groups, ...sample.groups], group: s.groups.length, person: 0 })
  })

  /* ---------- render ---------- */
  function render() {
    const { group, person } = current(s)
    groupSel.innerHTML = s.groups.length
      ? s.groups.map((g, i) => `<option value="${i}" ${i === s.group ? 'selected' : ''}>${esc(g.name)} (${g.people.length})</option>`).join('')
      : '<option>No groups yet</option>'
    groupSel.disabled = s.groups.length === 0

    $('now').innerHTML = person
      ? `<div class="name">${esc(person.name)}${person.talked ? ' ✓' : ''}</div>
         <div class="sub">${esc([person.role, person.org].filter(Boolean).join(' · ') || ' ')}</div>
         <div class="sub">${s.person + 1} of ${group!.people.length} · ${talkedCount(group!)} talked</div>`
      : `<div class="sub">${group ? 'No one in this group yet.' : 'Add a group, or load the sample.'}</div>`

    list.innerHTML = group?.people.length
      ? group.people
          .map(
            (p, i) => `<div class="person ${i === s.person ? 'on' : ''}">
            <span class="tick">${p.talked ? '✓' : ''}</span>
            <div class="meta" data-act="show" data-i="${i}"><b>${esc(p.name)}</b><span>${esc([p.role, p.org].filter(Boolean).join(' · '))}</span></div>
            <button class="small" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="small" data-act="down" data-i="${i}" ${i === group.people.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="small" data-act="edit" data-i="${i}">Edit</button>
          </div>`,
          )
          .join('')
      : '<p class="empty">No one here yet. Add people or paste a list below.</p>'
  }

  render()
  return {
    render(next: State) {
      s = copy(next)
      render()
    },
  }
}
