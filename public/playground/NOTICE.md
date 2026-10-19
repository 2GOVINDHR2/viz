# TensorFlow Playground — vendored copy

This directory contains a build of **TensorFlow Playground**, Copyright 2016 Google Inc., licensed under the Apache License, Version 2.0 (`LICENSE` in this directory). It is served with DL-VizLab so that study condition C2 runs offline and on a fixed version.

- Upstream: https://github.com/tensorflow/playground, commit `02469bd3751764b20486015d4202b792af5362a6`
- Built with the upstream `npm run build` (browserify + tsify + uglify) by `scripts/vendor-playground.sh`.

## Modifications (Apache 2.0 §4(b))

1. `analytics.js` is replaced by a stub defining a no-op `ga()`. The original loaded Google Analytics from google-analytics.com.
2. `index.html` loads `fonts.css` instead of the Roboto and Material Icons stylesheet on fonts.googleapis.com. `fonts/` holds the font files from the Fontsource packages `@fontsource/roboto@5.1.0` and `@fontsource/material-icons@5.1.0` (Apache License 2.0; `fonts/LICENSE-*`).

No other file is changed. With these two changes, the page makes no network request.
