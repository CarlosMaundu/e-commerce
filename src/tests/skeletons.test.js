// src/tests/skeletons.test.js — every page that loads data shows a skeleton
// shaped like the page while it waits (see src/components/skeletons), and no
// page falls back to one big grey block. New pages are checked too.
const fs = require('fs');
const path = require('path');

const PAGES = path.join(__dirname, '..', 'pages');
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(dir, e.name))
        : e.name.endsWith('.js')
          ? [path.join(dir, e.name)]
          : []
    );
const files = walk(PAGES).map((f) => ({
  name: path.relative(PAGES, f),
  source: fs.readFileSync(f, 'utf8'),
}));

// Loads data when it first shows: an effect that calls the API.
const loadsOnShow = (s) =>
  /from '(\.\.\/)+api'/.test(s) &&
  /useEffect\(\s*\(\)\s*=>\s*\{?[\s\S]{0,600}?(\.then\(|await |load\(\))/.test(
    s
  );
const showsSkeleton = (s) =>
  /components\/skeletons'|LoadingRows|AccountTable|PageSkeleton|\bSkeleton\b/.test(
    s
  );
// Dialogs and action helpers load on demand; a page can opt out with a reason.
const exempt = (name, s) =>
  /(Dialogs?|Actions)\.js$/.test(name) || /skeleton-exempt: \S+/.test(s);

test('pages that load data show a skeleton while they wait', () => {
  const missing = files
    .filter((f) => !exempt(f.name, f.source))
    .filter((f) => loadsOnShow(f.source) && !showsSkeleton(f.source))
    .map((f) => f.name);
  expect(missing).toEqual([]);
});

test('no page waits behind one big grey block instead of its layout', () => {
  const blocks = files.flatMap((f) =>
    [
      ...f.source.matchAll(
        /<Skeleton[^>]*variant="rounded"[^>]*height=\{(\d+)\}[^>]*\/>/g
      ),
    ]
      .filter((m) => Number(m[1]) >= 200)
      .map((m) => `${f.name}: ${m[0]}`)
  );
  expect(blocks).toEqual([]);
});
