/**
 * Glasses layout, 576x288:
 *
 *  ┌──────────────────────────────┬───────────────────────┐
 *  │ [name 288x136]   Maria       │ Met: CES 2025         │
 *  │                  Chen    ✓   │ Ask about: her first  │
 *  │                              │ marathon              │
 *  ├──────────────────────────────┤ Kids: Leo (7)         │
 *  │ [sub 288x96]  Product lead   │ Wants a demo in Dec   │
 *  │               Acme Robotics  │                       │
 *  ├──────────────────────────────┴───────────────────────┤
 *  │ Saturday dinner · 2/4 · 1 talked      swipe ↕ tap ✓  │
 *  └───────────────────────────────────────────────────────┘
 */
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { cueLines, current, nameLines, talkedCount, type State } from './people'
import { NAME_H, NAME_W, SUB_H, SUB_W, blank, renderMessage, renderName, renderSub } from './render'

const ID = { name: 1, sub: 2, cues: 3, status: 4 } as const
const NM = { name: 'name', sub: 'sub', cues: 'cues', status: 'status' } as const

export interface Model {
  name: string
  sub: string
  cues: string
  status: string
}

export function buildModel(s: State): Model {
  const { group, person } = current(s)
  if (!group) {
    return {
      name: renderMessage("Who's Who", 'add people on your phone'),
      sub: blank(),
      cues: 'Open this plugin on\nyour phone: add a\ngroup of people, or\ntap "Load sample\ngroups".',
      status: 'No groups yet',
    }
  }
  if (!person) {
    return { name: renderMessage(group.name), sub: blank(), cues: 'No one in this\ngroup yet.', status: group.name }
  }
  const n = group.people.length
  const talked = talkedCount(group)
  const cues = cueLines(person)
  return {
    name: renderName(nameLines(person.name), person.talked),
    sub: renderSub(person.role, person.org),
    cues: cues.length ? cues.join('\n') : '—',
    status: `${group.name} · ${s.person + 1}/${n}${talked ? ` · ${talked} talked` : ''}      ${n > 1 ? 'swipe ↕   ' : ''}tap: talked`,
  }
}

function text(id: number, name: string, x: number, y: number, w: number, h: number, capture = 0) {
  return new TextContainerProperty({
    xPosition: x, yPosition: y, width: w, height: h, borderWidth: 0, borderColor: 5,
    paddingLength: 4, containerID: id, containerName: name, content: '', isEventCapture: capture,
  })
}

function layout(m: Model) {
  const cues = text(ID.cues, NM.cues, 304, 8, 268, 236)
  const status = text(ID.status, NM.status, 8, 250, 564, 38, 1)
  cues.content = m.cues
  status.content = m.status
  return {
    containerTotalNum: 4,
    imageObject: [
      new ImageContainerProperty({ xPosition: 8, yPosition: 2, width: NAME_W, height: NAME_H, containerID: ID.name, containerName: NM.name }),
      new ImageContainerProperty({ xPosition: 8, yPosition: 146, width: SUB_W, height: SUB_H, containerID: ID.sub, containerName: NM.sub }),
    ],
    textObject: [cues, status],
  }
}

export class Hud {
  private last: Model | null = null
  private busy = false
  private queue: Array<{ id: number; name: string; data: string }> = []

  constructor(private bridge: EvenAppBridge) {}

  async create(m: Model): Promise<boolean> {
    const ok = (await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer(layout(m)))) === 0
    if (ok) {
      this.last = m
      await this.img(ID.name, NM.name, m.name)
      await this.img(ID.sub, NM.sub, m.sub)
    }
    return ok
  }

  async rebuild(m: Model) {
    await this.bridge.rebuildPageContainer(new RebuildPageContainer(layout(m)))
    this.last = m
    await this.img(ID.name, NM.name, m.name)
    await this.img(ID.sub, NM.sub, m.sub)
  }

  async update(m: Model) {
    const p = this.last
    this.last = m
    const jobs: Promise<unknown>[] = []
    if (p?.cues !== m.cues)
      jobs.push(this.bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: ID.cues, containerName: NM.cues, content: m.cues })))
    if (p?.status !== m.status)
      jobs.push(this.bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: ID.status, containerName: NM.status, content: m.status })))
    await Promise.all(jobs)
    if (p?.name !== m.name) await this.img(ID.name, NM.name, m.name)
    if (p?.sub !== m.sub) await this.img(ID.sub, NM.sub, m.sub)
  }

  /** Image sends must not overlap; keep only the newest frame per container. */
  private async img(id: number, name: string, data: string): Promise<void> {
    if (this.busy) {
      this.queue = this.queue.filter(q => q.id !== id)
      this.queue.push({ id, name, data })
      return
    }
    this.busy = true
    try {
      await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: id, containerName: name, imageData: data }))
    } catch (e) {
      console.warn('image send failed', e)
    } finally {
      this.busy = false
    }
    const next = this.queue.shift()
    if (next) await this.img(next.id, next.name, next.data)
  }
}
