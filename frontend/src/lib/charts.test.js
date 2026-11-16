import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h, version } from 'react';
import { BarChart, Bar, XAxis } from 'recharts';

// recharts 2.x finds its <Bar>/<XAxis> children with react-is. With React 19
// and the react-is 18 that recharts ships, it finds none and the chart is
// empty — vite.config.js aliases react-is to the React-19 copy. This guards it.
describe('charts on React 19', () => {
  it('a bar chart actually draws its bars', () => {
    expect(version.startsWith('19.')).toBe(true);
    const html = renderToStaticMarkup(
      h(BarChart, { width: 300, height: 200, data: [{ m: 'A', v: 10 }, { m: 'B', v: 20 }] },
        h(XAxis, { dataKey: 'm' }),
        h(Bar, { dataKey: 'v', isAnimationActive: false })),
    );
    expect(html).toContain('recharts-bar-rectangle');
    expect(html).toContain('recharts-xAxis');
  });
});
