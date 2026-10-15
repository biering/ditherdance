import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalize } from './gradient/options.js'
import { DitherGradient } from './react.js'

describe('DitherGradient on the server', () => {
  it('renders children over a flat placeholder in the average color', () => {
    const html = renderToString(
      <DitherGradient name="ada" className="hero" data-testid="g">
        <h1>Hello</h1>
      </DitherGradient>,
    )
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('class="hero"')
    expect(html).toContain('data-testid="g"')
    expect(html).toContain(`background-color:${normalize({ name: 'ada' }).fallback}`)
    // Options are props of the component, never attributes on the div.
    expect(html).not.toContain('name="ada"')
  })

  it('skips the placeholder for colors only a browser can parse', () => {
    const html = renderToString(<DitherGradient colors={['oklch(0.7 0.1 200)', 'navy']} />)
    expect(html).not.toContain('background-color')
  })
})
