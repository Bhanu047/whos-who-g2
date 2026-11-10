import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCsvLine, parsePeople, nameLines, cueLines, step, toggleTalked, clamp, move,
  sampleState, newPerson, current, talkedCount,
} from '../dist-test/people.js'

test('CSV line parser handles quotes and commas', () => {
  assert.deepEqual(parseCsvLine('a, "b, c", "say ""hi"""'), ['a', 'b, c', 'say "hi"'])
  assert.deepEqual(parseCsvLine('x\ty', '\t'), ['x', 'y'])
})

test('import: one name per line', () => {
  const p = parsePeople('Maria Chen\n\nTom Becker\n')
  assert.deepEqual(p.map(x => x.name), ['Maria Chen', 'Tom Becker'])
})

test('import: CSV with a header in any order', () => {
  const p = parsePeople('Company,Name,Title,Notes\nAcme,Maria Chen,Product lead,"Kids: Leo"\n')
  assert.equal(p.length, 1)
  assert.equal(p[0].name, 'Maria Chen')
  assert.equal(p[0].role, 'Product lead')
  assert.equal(p[0].org, 'Acme')
  assert.equal(p[0].notes, 'Kids: Leo')
})

test('import: LinkedIn connections export (First/Last name columns)', () => {
  const csv = 'First Name,Last Name,URL,Email Address,Company,Position,Connected On\nMaria,Chen,x,,Acme,Product lead,01 Jan 2025'
  const p = parsePeople(csv)
  assert.equal(p[0].name, 'Maria Chen')
  assert.equal(p[0].org, 'Acme')
  assert.equal(p[0].role, 'Product lead')
})

test('import: headerless CSV and TSV use positional columns', () => {
  const p = parsePeople('Maria Chen, Product lead, Acme, her marathon')
  assert.equal(p[0].ask, 'her marathon')
  const t = parsePeople('Tom\tCFO\tAcme')
  assert.equal(t[0].role, 'CFO')
})

test('nameLines balances two lines', () => {
  assert.deepEqual(nameLines('Maria Chen'), ['Maria', 'Chen'])
  assert.deepEqual(nameLines('Priya'), ['Priya'])
  assert.deepEqual(nameLines('Mary Anne de la Cruz'), ['Mary Anne', 'de la Cruz'])
})

test('cueLines puts met/ask first and skips blanks', () => {
  const p = newPerson({ name: 'A', met: 'CES', ask: 'running', notes: 'one\n\n two ' })
  assert.deepEqual(cueLines(p), ['Met: CES', 'Ask about: running', 'one', 'two'])
  assert.deepEqual(cueLines(newPerson({ name: 'B' })), [])
})

test('swipe wraps around; talked toggles only the current person', () => {
  let s = sampleState()
  s = step(s, -1)
  assert.equal(s.person, 3)
  s = step(s, 1)
  assert.equal(s.person, 0)
  s = toggleTalked(s)
  assert.equal(current(s).person.talked, true)
  assert.equal(talkedCount(s.groups[0]), 1)
  assert.equal(s.groups[0].people[1].talked, false)
})

test('clamp keeps indexes valid after deletions', () => {
  const s = clamp({ groups: [{ id: 'g', name: 'G', people: [newPerson({ name: 'A' })] }], group: 3, person: 9 })
  assert.equal(s.group, 0)
  assert.equal(s.person, 0)
  assert.deepEqual(clamp({ groups: [], group: 2, person: 2 }), { groups: [], group: 0, person: 0 })
})

test('move reorders people', () => {
  const ppl = ['A', 'B', 'C'].map(name => newPerson({ name }))
  assert.deepEqual(move(ppl, 2, 0).map(p => p.name), ['C', 'A', 'B'])
  assert.equal(move(ppl, 5, 0), ppl)
})
