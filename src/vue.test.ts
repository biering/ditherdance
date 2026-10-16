import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { normalize } from './gradient/options.js'
import { DitherGradient } from './vue.js'

const render = (props: Record<string, unknown>, children?: () => unknown) =>
  renderToString(createSSRApp({ render: () => h(DitherGradient, props, children && { default: children }) }))

describe('DitherGradient (vue) on the server', () => {
  it('renders the slot over a flat placeholder in the average color', async () => {
    const html = await render({ name: 'ada', class: 'hero', 'data-testid': 'g' }, () => h('h1', 'Hello'))
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('class="hero"')
    expect(html).toContain('data-testid="g"')
    expect(html).toContain(`background-color:${normalize({ name: 'ada' }).fallback}`)
    // Options are props of the component, never attributes on the div.
    expect(html).not.toContain('name="ada"')
  })

  it('lets a passed style override the defaults', async () => {
    const html = await render({ name: 'ada', style: { position: 'absolute' } })
    expect(html).toContain('position:absolute')
    expect(html).not.toContain('position:relative')
  })

  it('skips the placeholder for colors only a browser can parse', async () => {
    const html = await render({ colors: ['oklch(0.7 0.1 200)', 'navy'] })
    expect(html).not.toContain('background-color')
  })
})
