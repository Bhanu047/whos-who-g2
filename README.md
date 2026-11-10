# Who's Who for Even G2

Never blank on a name again. Before a dinner, meeting or reunion, put the people you'll see into a group on your phone. On the glasses you get one card per person: name, role, where you met, what to ask about, and a few notes. Swipe through them in seating order and tap to mark who you've talked to.

![screens](shots/contact-sheet.png)

- **Groups** for each occasion: "Saturday dinner", "Acme team", "Family reunion"
- **Person cards** with a big name, role and company, plus *Met*, *Ask about* and notes (pronunciation, kids' names, dietary needs)
- **Swipe** (touchpad or R1 ring) moves through people in the order you set: seating order, agenda order, or arrival order
- **Tap** marks someone ✓ talked; the status line keeps count
- **Import contacts**: a `.vcf` file from iPhone (Share Contact → Save to Files) or Android (Contacts → Export), a Google Contacts CSV, a LinkedIn connections export, any CSV with a header, or names one per line. Only name, company, title and notes are kept; phone numbers, emails and addresses are ignored
- **Import meeting invites**: save the `invite.ics` attached to a Google/Outlook/Apple invitation and import it. You get a group named after the meeting with every attendee, the organizer tagged, rooms skipped, and names and companies worked out from email addresses when needed
- **Sample groups** to see it working straight away
- **Private by design**: no account, no server, no internet access. Everything stays in the Even app on your phone. Files are read on the phone; nothing is uploaded.

> Even Hub gives plugins no direct calendar or contacts access, and no background notifications. That's why import works from files you export.

## Code

| File | Role |
|---|---|
| `src/people.ts` | Groups/people model; CSV, LinkedIn, Google Contacts, vCard (2.1–4.0) and .ics invite import; name line-breaking; sample data (pure, unit-tested) |
| `src/render.ts` | Canvas → PNG for the big name and role/company tiles (on/off pixels only) |
| `src/hud.ts` | 576×288 layout: 2 image + 2 text containers |
| `src/phone-ui.ts`, `index.html` | Phone editor: groups, people, reorder, import, mirror controls |
| `src/storage.ts` | Persists to the Even app's per-plugin storage |

## Develop

```bash
npm install
npm run dev                                   # vite :5173
npx evenhub-simulator "http://localhost:5173/?sample"   # dev-only: start with sample groups
npm test                                      # 14 unit tests
npm run build && npx evenhub pack app.json dist -o whos-who.ehpk --sdk-ver 0.0.10
```

The shipped bundle contains no URLs and the manifest requests no permissions.

## License

MIT
