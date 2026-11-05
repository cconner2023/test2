import { it, vi } from 'vitest'
import { appendFileSync } from 'fs'
import { render, act } from '@testing-library/react'
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({}) }))
const LOG = 'C:/Users/cconn/AppData/Local/Temp/claude/06d2b8476360e404/27f1120d-64a3-47d9-8a47-a903781157e9/scratchpad/p2.log'
const log = (...a: unknown[]) => appendFileSync(LOG, a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + String.fromCharCode(10))
vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
;(Element.prototype as any).animate = function () { return { cancel() {}, finished: Promise.resolve(), onfinish: null } }
;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

it('hidden → visible', async () => {
  const root = document.createElement('div'); root.id = 'app-drawer-root'; document.body.appendChild(root)
  const { ProviderDrawer } = await import('../Components/ProviderDrawer')
  const { PropertyDrawer } = await import('../Components/PropertyDrawer')
  const { useDrawerPushStore } = await import('../stores/useDrawerPushStore')
  const errs: string[] = []
  const orig = console.error
  console.error = (...a: unknown[]) => { errs.push(a.map(String).join(' ').slice(0, 400)) }
  const Host = ({ v }: { v: boolean }) => <><PropertyDrawer isVisible={false} onClose={() => {}} /><ProviderDrawer isVisible={v} onClose={() => {}} /></>
  let r: ReturnType<typeof render>
  try {
    await act(async () => { r = render(<Host v={false} />, { container: root }) })
    await act(async () => { await new Promise(res => setTimeout(res, 300)) })
    await act(async () => { r.rerender(<Host v />) })
    await act(async () => { await new Promise(res => setTimeout(res, 1500)) })
  } catch (e) { log('THREW', String((e as Error).stack).slice(0, 1500)) }
  console.error = orig
  log('STACK', useDrawerPushStore.getState().stack)
  document.querySelectorAll('[role=dialog]').forEach(d => log('DLG', d.getAttribute('aria-label'), (d as HTMLElement).style.cssText, d.className.slice(0, 90)))
  log('ERRS', errs.filter(e => !e.includes('act(')).slice(0, 6))
}, 60000)
