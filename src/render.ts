/**
 * Canvas tiles for the G2 image containers (max 288x144). On/off pixels only:
 * the display's grey handling isn't reliable, so contrast comes from size and
 * weight, never from grey levels.
 */
const FONT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'

export const NAME_W = 288
export const NAME_H = 136
export const SUB_W = 288
export const SUB_H = 96

function ctx(w: number, h: number) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  c.fillStyle = '#000'
  c.fillRect(0, 0, w, h)
  c.fillStyle = '#fff'
  c.strokeStyle = '#fff'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  return c
}

const png = (c: CanvasRenderingContext2D) => c.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')

/** Largest bold size (<= max) at which every line fits in width. */
function fit(c: CanvasRenderingContext2D, lines: string[], width: number, max: number, min: number): number {
  let size = max
  for (; size > min; size -= 2) {
    c.font = `bold ${size}px ${FONT}`
    if (lines.every(l => c.measureText(l).width <= width)) break
  }
  c.font = `bold ${size}px ${FONT}`
  return size
}

/** Big name, one or two lines. A check mark in the corner once talked. */
export function renderName(lines: string[], talked: boolean): string {
  const c = ctx(NAME_W, NAME_H)
  const two = lines.length > 1
  const size = fit(c, lines, NAME_W - (talked ? 44 : 16), two ? 60 : 72, 26)
  if (two) {
    c.fillText(lines[0], NAME_W / 2 - (talked ? 14 : 0), NAME_H / 2 - size * 0.52)
    c.fillText(lines[1], NAME_W / 2 - (talked ? 14 : 0), NAME_H / 2 + size * 0.52)
  } else {
    c.fillText(lines[0], NAME_W / 2 - (talked ? 14 : 0), NAME_H / 2)
  }
  if (talked) {
    c.lineWidth = 5
    c.beginPath()
    c.moveTo(NAME_W - 34, 22)
    c.lineTo(NAME_W - 24, 34)
    c.lineTo(NAME_W - 6, 10)
    c.stroke()
  }
  return png(c)
}

/** Role and organisation under the name. */
export function renderSub(role: string, org: string): string {
  const c = ctx(SUB_W, SUB_H)
  const lines = [role, org].filter(Boolean)
  if (lines.length === 0) return png(c)
  fit(c, lines, SUB_W - 12, 24, 14)
  if (lines.length === 1) c.fillText(lines[0], SUB_W / 2, SUB_H / 2)
  else {
    c.fillText(lines[0], SUB_W / 2, SUB_H / 2 - 18)
    // Organisation in regular weight so the two lines read differently.
    c.font = c.font.replace('bold ', '')
    c.fillText(lines[1], SUB_W / 2, SUB_H / 2 + 18)
  }
  return png(c)
}

export function renderMessage(title: string, sub = ''): string {
  const c = ctx(NAME_W, NAME_H)
  c.font = `bold 34px ${FONT}`
  c.fillText(title, NAME_W / 2, sub ? NAME_H / 2 - 18 : NAME_H / 2)
  if (sub) {
    c.font = `22px ${FONT}`
    c.fillText(sub, NAME_W / 2, NAME_H / 2 + 24)
  }
  return png(c)
}

export const blank = (w = SUB_W, h = SUB_H) => png(ctx(w, h))
