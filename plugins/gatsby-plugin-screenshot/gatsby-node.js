"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.onPostBuild = onPostBuild;

var _path = _interopRequireDefault(require("path"));

var _crossSpawn = _interopRequireDefault(require("cross-spawn"));

var _mkdirp = _interopRequireDefault(require("mkdirp"));

var _puppeteer = _interopRequireDefault(require("puppeteer"));

var _lodash = _interopRequireDefault(require("lodash.kebabcase"));

/* eslint-disable no-await-in-loop */
function waitFor(fn) {
  return new Promise((resolve, reject) => {
    const timeoutID = setTimeout(() => reject(new Error('Timeout')), 10e3);

    function check() {
      if (!fn()) {
        setTimeout(check, 1e3);
      } else {
        clearTimeout(timeoutID);
        resolve();
      }
    }

    check();
  });
}

async function screenshotPages(browser, paths, options = {}) {
  const {
    output = _path.default.join('.', _path.default.sep, 'screenshots'),
    server: {
      port = 8000
    } = {},
    withText = true
  } = options;

  _mkdirp.default.sync(output);

  const page = await browser.newPage();

  for (let i = 0; i < paths.length; i += 1) {
    await page.goto(`http://localhost:${port}${[paths[i]]}`, {waitUntil: 'networkidle0'});

    if (!withText) {
      page.addStyleTag({
        content: `
        * {
          color: transparent !important;
        }
      `
      });
    }

    await page.screenshot({
      path: _path.default.join(output, `${(0, _lodash.default)(paths[i]) || 'home'}.png`)
    });
  }
}

async function runBrowser(fn, options = {}) {
  const {
    browser: browserOptions = {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-fullscreen']
    }
  } = options;
  const browser = await _puppeteer.default.launch(browserOptions);

  try {
    await fn(browser);
  } finally {
    await browser.close();
  }
}

async function runServer(fn, options = {}) {
  const {
    server: {
      port = 8000
    } = {}
  } = options;
  const child = (0, _crossSpawn.default)('gatsby', ['serve', '-p', port], {
    shell: true
  });
  let running = false;
  child.stdout.on('data', data => {
    if (String(data).includes('gatsby serve running')) {
      running = true;
    }
  });

  try {
    await waitFor(() => running);
    await fn(child);
  } finally {
    await new Promise(resolve => {
      child.on('exit', resolve);
      child.kill();
    });
  }
}

async function onPostBuild({
  graphql
}, options = {}) {
  const {
    data,
    errors
  } = await graphql(`
    {
      allSitePage {
        edges {
          node {
            path
          }
        }
      }
    }
  `);

  if (errors) {
    throw new Error(errors.join(`, `));
  }

  const {
    allSitePage: {
      edges: pages
    }
  } = data;
  await runServer(() => runBrowser(async browser => screenshotPages(browser, pages.map(({
    node
  }) => node.path), options), options), options);
}
