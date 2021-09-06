import PandaBridge from 'pandasuite-bridge';
import Atrament from 'atrament';

import './index.css';

let properties = null;

let sketchpad = null;
const strokes = [];

function myInit() {
  const canvas = document.querySelector('#sketchpad');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  sketchpad = new Atrament(canvas);
  sketchpad.recordStrokes = true;

  sketchpad.adaptiveStroke = properties.adaptiveStroke;
  sketchpad.smoothing = properties.smoothing;

  sketchpad.addEventListener('dirty', () => PandaBridge.send('dirty'));
  sketchpad.addEventListener('clean', () => PandaBridge.send('clean'));

  sketchpad.addEventListener('strokerecorded', (obj) => {
    if (!sketchpad.recordPaused) {
      strokes.push(obj.stroke);
    }
  });
}

PandaBridge.init(() => {
  PandaBridge.onLoad((pandaData) => {
    properties = pandaData.properties;

    if (document.readyState === 'complete') {
      myInit();
    } else {
      document.addEventListener('DOMContentLoaded', myInit, false);
    }
  });

  PandaBridge.onUpdate((pandaData) => {
    properties = pandaData.properties;
  });

  /* Actions */

  PandaBridge.listen('changeColor', ([params]) => {
    let { color } = params || {};
    let alpha = 1;

    // extract alpha color from hex color
    const m = color && color.match(/^(#[0-9a-f]{6})([0-9a-f]{2})$/i);
    if (m) {
      // eslint-disable-next-line prefer-destructuring
      color = m[1];
      if (m[2]) {
        alpha = parseInt(m[2], 16) / 255;
      }
    }
    sketchpad.context.globalAlpha = alpha;
    sketchpad.color = color;
  });

  PandaBridge.listen('changeWeight', ([params]) => {
    const { weight } = params || {};

    sketchpad.weight = weight;
  });

  PandaBridge.listen('changeMode', ([params]) => {
    const { mode } = params || {};

    sketchpad.mode = mode;
  });

  PandaBridge.listen('clear', () => {
    sketchpad.clear();
  });

  PandaBridge.listen('undo', () => {
    strokes.pop();
    sketchpad.clear();
    sketchpad.recordPaused = true;
    strokes.forEach((stroke) => {
      // set drawing options
      sketchpad.mode = stroke.mode;
      sketchpad.weight = stroke.weight;
      sketchpad.smoothing = stroke.smoothing;
      sketchpad.color = stroke.color;
      sketchpad.adaptiveStroke = stroke.adaptiveStroke;

      // don't want to modify original data
      const points = stroke.points.slice();

      const firstPoint = points.shift();
      // beginStroke moves the "pen" to the given position and starts the path
      sketchpad.beginStroke(firstPoint.x, firstPoint.y);

      let prevPoint = firstPoint;
      while (points.length > 0) {
        const point = points.shift();

        // the `draw` method accepts the current real coordinates
        // (i. e. actual cursor position), and the previous processed (filtered)
        // position. It returns an object with the current processed position.
        const { x, y } = sketchpad.draw(point.x, point.y, prevPoint.x, prevPoint.y);

        // the processed position is the one where the line is actually drawn to
        // so we have to store it and pass it to `draw` in the next step
        prevPoint = { x, y };
      }

      // endStroke closes the path
      sketchpad.endStroke(prevPoint.x, prevPoint.y);
    });
    sketchpad.recordPaused = false;
  });
});
