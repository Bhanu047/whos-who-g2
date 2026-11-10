import { OsEventTypeList, waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { Hud, buildModel } from './hud'
import { clamp, step, toggleTalked, type State } from './people'
import { load, save } from './storage'
import { mountPhoneUi } from './phone-ui'

async function getBridge(timeoutMs = 1500): Promise<EvenAppBridge | null> {
  return Promise.race<EvenAppBridge | null>([
    waitForEvenAppBridge(),
    new Promise(resolve => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  // CLICK_EVENT is 0 and protobuf drops zero-valued fields.
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

async function main() {
  const bridge = await getBridge()
  let state: State = await load(bridge)
  const hud = bridge ? new Hud(bridge) : null

  const commit = async (next: State, from: 'glasses' | 'phone') => {
    state = clamp(next)
    void save(bridge, state)
    if (hud) await hud.update(buildModel(state)).catch(e => console.warn(e))
    if (from === 'glasses') phone.render(state)
  }

  const phone = mountPhoneUi({
    initial: state,
    hasGlasses: !!bridge,
    onChange: next => commit(next, 'phone'),
  })

  if (!bridge || !hud) {
    console.info('No Even bridge — phone UI only.')
    return
  }

  await hud.create(buildModel(state))

  const off = bridge.onEvenHubEvent(event => {
    const sys = eventTypeOf(event.sysEvent)
    const txt = eventTypeOf(event.textEvent)
    const is = (t: OsEventTypeList) => sys === t || txt === t
    if (is(OsEventTypeList.DOUBLE_CLICK_EVENT)) {
      off()
      void save(bridge, state)
      bridge.shutDownPageContainer(1)
    } else if (is(OsEventTypeList.SCROLL_BOTTOM_EVENT)) void commit(step(state, 1), 'glasses')
    else if (is(OsEventTypeList.SCROLL_TOP_EVENT)) void commit(step(state, -1), 'glasses')
    else if (is(OsEventTypeList.CLICK_EVENT)) void commit(toggleTalked(state), 'glasses')
    else if (sys === OsEventTypeList.FOREGROUND_ENTER_EVENT) void hud.rebuild(buildModel(state))
    else if (sys === OsEventTypeList.SYSTEM_EXIT_EVENT || sys === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      off()
      void save(bridge, state)
    }
  })
}

main().catch(e => console.error('fatal', e))
