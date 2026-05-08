// SVG visualization of the simulator state. Pure DOM; the controller
// calls `render(state)` whenever something changes.

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 220;
const NODE_RADIUS = 28;

/**
 * @param {SVGSVGElement} svg
 */
export const makeViz = svg => {
  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('id', 'viz-layer');
  svg.appendChild(layer);

  /** @type {Map<string, { dot: SVGCircleElement, label: SVGTextElement, x: number, y: number }>} */
  const nodes = new Map();
  /** @type {Map<string, SVGLineElement>} */
  const edges = new Map();
  /** @type {SVGGElement} */
  const flowLayer = document.createElementNS(SVG_NS, 'g');
  flowLayer.setAttribute('id', 'flow-layer');
  layer.appendChild(flowLayer);

  const layout = designators => {
    nodes.clear();
    edges.clear();
    layer.innerHTML = '';
    layer.appendChild(flowLayer);
    flowLayer.innerHTML = '';
    const n = designators.length;
    designators.forEach((designator, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * RADIUS;
      const y = Math.sin(angle) * RADIUS;
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', String(NODE_RADIUS));
      dot.setAttribute('class', 'node-circle');
      layer.appendChild(dot);
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(y));
      label.setAttribute('class', 'node-label');
      label.textContent = designator.slice(0, 4);
      layer.appendChild(label);
      nodes.set(designator, { dot, label, x, y });
    });
  };

  /**
   * @param {string} a
   * @param {string} b
   * @returns {string}
   */
  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  /**
   * @param {{
   *   designators: string[],
   *   sessions: Set<string>,   // edgeKey of active sessions
   *   active: Set<string>,     // edgeKey of "have non-bootstrap exports" or recent activity
   *   busyDesignators: Set<string>,
   * }} state
   */
  const render = state => {
    // (Re)layout if the node set changed.
    const currentDesignators = Array.from(nodes.keys());
    const desiredDesignators = state.designators;
    const sameSet =
      currentDesignators.length === desiredDesignators.length &&
      currentDesignators.every(d => desiredDesignators.includes(d));
    if (!sameSet) {
      layout(desiredDesignators);
    }
    // Edges
    const wantKeys = new Set();
    for (const key of state.sessions) {
      wantKeys.add(key);
      let line = edges.get(key);
      if (!line) {
        const [a, b] = key.split('|');
        const na = nodes.get(a);
        const nb = nodes.get(b);
        if (!na || !nb) continue;
        line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(na.x));
        line.setAttribute('y1', String(na.y));
        line.setAttribute('x2', String(nb.x));
        line.setAttribute('y2', String(nb.y));
        line.setAttribute('class', 'session-edge');
        // Insert below dots.
        layer.insertBefore(line, layer.firstChild);
        edges.set(key, line);
      }
      if (state.active.has(key)) {
        line.classList.add('active');
      } else {
        line.classList.remove('active');
      }
    }
    for (const [key, line] of edges) {
      if (!wantKeys.has(key)) {
        line.remove();
        edges.delete(key);
      }
    }
    // Busy ring on nodes
    for (const [designator, n] of nodes) {
      if (state.busyDesignators.has(designator)) {
        n.dot.classList.add('busy');
      } else {
        n.dot.classList.remove('busy');
      }
    }
  };

  /**
   * Animate a small dot from one node to another. Used to show
   * forward(N) traffic.
   * @param {string} fromDesignator
   * @param {string} toDesignator
   * @param {number} durationMs
   */
  const pulse = (fromDesignator, toDesignator, durationMs) => {
    const from = nodes.get(fromDesignator);
    const to = nodes.get(toDesignator);
    if (!from || !to) return;
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '5');
    dot.setAttribute('class', 'flow-pulse');
    flowLayer.appendChild(dot);
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / durationMs);
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        dot.remove();
      }
    };
    requestAnimationFrame(tick);
  };

  return { render, pulse, edgeKey };
};
