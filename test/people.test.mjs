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

test('vCard: iPhone export (3.0) with folded lines, escapes, item-prefixed ORG', async () => {
  const { parseVcf, importText } = await import('../dist-test/people.js')
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Chen;Maria;;;', 'FN:Maria Chen',
    'item1.ORG:Acme Robotics;Product', 'TITLE:Product lead',
    'NOTE:Kids: Leo (7)\\nRan Chicago marath', ' on 2025', 'TEL;type=CELL:+1 555 0100',
    'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Becker;Tom;;;', 'ORG:Acme\\, Inc.', 'END:VCARD',
  ].join('\r\n')
  const p = parseVcf(vcf)
  assert.equal(p.length, 2)
  assert.equal(p[0].name, 'Maria Chen')
  assert.equal(p[0].org, 'Acme Robotics, Product')
  assert.equal(p[0].role, 'Product lead')
  assert.equal(p[0].notes, 'Kids: Leo (7)\nRan Chicago marathon 2025')
  assert.equal(p[1].name, 'Tom Becker') // built from N when FN missing
  assert.equal(p[1].org, 'Acme, Inc.')
  assert.equal(JSON.stringify(p).includes('555'), false) // phone numbers ignored
  assert.equal(importText(vcf).length, 2)
  assert.equal(importText('Ana\nBen').length, 2) // non-vCard falls back to text/CSV
})

test('vCard 2.1 quoted-printable and 4.0', async () => {
  const { parseVcf } = await import('../dist-test/people.js')
  const v21 = 'BEGIN:VCARD\nVERSION:2.1\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Garc=C3=ADa\nEND:VCARD'
  assert.equal(parseVcf(v21)[0].name, 'José García')
  const v4 = 'BEGIN:VCARD\nVERSION:4.0\nFN:Priya Nair\nROLE:Neighbor\nEND:VCARD'
  assert.equal(parseVcf(v4)[0].role, 'Neighbor')
  assert.deepEqual(parseVcf('BEGIN:VCARD\nTEL:1\nEND:VCARD'), []) // no name → skipped
})

test('Google Contacts CSV exports (new and old formats)', () => {
  const newer = 'First Name,Middle Name,Last Name,Phonetic First Name,Nickname,Organization Name,Organization Title,Notes,Phone 1 - Value\n' +
    'Maria,,Chen,,,Acme Robotics,Product lead,Met at CES,+1 555'
  const a = parsePeople(newer)[0]
  assert.equal(a.name, 'Maria Chen')
  assert.equal(a.org, 'Acme Robotics')
  assert.equal(a.role, 'Product lead')
  assert.equal(a.notes, 'Met at CES')
  const older = 'Name,Given Name,Family Name,Notes,Organization 1 - Name,Organization 1 - Title\n' +
    'Tom Becker,Tom,Becker,Prefers email,Acme,CFO'
  const b = parsePeople(older)[0]
  assert.equal(b.name, 'Tom Becker')
  assert.equal(b.org, 'Acme')
  assert.equal(b.role, 'CFO')
})

test('calendar invite (.ics): one group per event, organizer tagged, rooms skipped, names from email', async () => {
  const { parseIcs, importAny, personFromEmail } = await import('../dist-test/people.js')
  const ics = [
    'BEGIN:VCALENDAR', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    'SUMMARY:Q1 planning\\, Acme',
    'DTSTART;TZID=America/Chicago:20261112T150000',
    'ORGANIZER;CN="Maria Chen":mailto:maria.chen@acme.com',
    'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;CN=Maria Chen:mailto:maria.chen@acme.com',
    'ATTENDEE;CN=tom.becker@acme.com;PARTSTAT=NEEDS-ACTION:mailto:tom.becker@acme.com',
    'ATTENDEE;ROLE=OPT-PARTICIPANT;CN=Priya Nair:mailto:pri',
    ' ya.nair@gmail.com',
    'ATTENDEE;CUTYPE=ROOM;CN=Room 4B:mailto:room4b@acme.com',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const g = parseIcs(ics)
  assert.equal(g.length, 1)
  assert.equal(g[0].name, 'Q1 planning, Acme · Nov 12')
  assert.deepEqual(g[0].people.map(p => p.name), ['Maria Chen', 'Tom Becker', 'Priya Nair'])
  assert.equal(g[0].people[0].role, 'Organizer')
  assert.equal(g[0].people[1].org, 'Acme')
  assert.equal(g[0].people[2].org, '') // gmail → no company
  assert.equal(g[0].people[1].met, '') // meeting name lives in the group name
  assert.equal(new Set(g[0].people.map(p => p.id)).size, 3)
  assert.equal(importAny(ics).kind, 'groups')
  assert.equal(importAny('Ana').kind, 'people')
  assert.deepEqual(personFromEmail('j.smith+work@sub.contoso.co.uk'), { name: 'J Smith', org: 'Contoso' })
  assert.deepEqual(personFromEmail('ana_lopez2@mail.acme.com'), { name: 'Ana Lopez', org: 'Acme' })
  assert.deepEqual(personFromEmail('bob@icloud.com'), { name: 'Bob', org: '' })
})
