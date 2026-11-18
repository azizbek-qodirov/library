// Requires Playwright and a running stack. Uses mock book pages; no records are created.
// STAFF_USERNAME=... STAFF_PASSWORD=... node deploy/books_pagination_smoke.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.SMOKE_URL || 'http://127.0.0.1:8080';
const { STAFF_USERNAME: username, STAFF_PASSWORD: password } = process.env;
assert(username && password, 'Set STAFF_USERNAME and STAFF_PASSWORD');

const languages = {
  en: { books: 'Books', users: 'Users', pages: 'Book pages', next: 'Next »', previous: '« Prev' },
  uz: { books: 'Kitoblar', users: 'Foydalanuvchilar', pages: 'Kitob sahifalari', next: 'Keyingi »', previous: '« Oldingi' },
  ru: { books: 'Книги', users: 'Читатели', pages: 'Страницы книг', next: 'Далее »', previous: '« Назад' },
};
const fixtures = Array.from({ length: 45 }, (_, index) => ({
  id: `pagination-${index + 1}`,
  title: `Pagination fixture ${String(index + 1).padStart(2, '0')}`,
  page_count: 120, total_copies: 1, available_copies: 1,
}));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox'],
  });
  try {
    for (const [locale, labels] of Object.entries(languages)) {
      const context = await browser.newContext();
      try {
        await context.addInitScript(language => localStorage.setItem('oxus-library-language', language), locale);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/books?*', route => {
          const params = new URL(route.request().url()).searchParams;
          const search = (params.get('search') || '').toLowerCase();
          const filtered = fixtures.filter(book => book.title.toLowerCase().includes(search));
          const offset = Number(params.get('offset') || 0);
          const limit = Number(params.get('limit'));
          assert.equal(limit, 20, 'Book pages should request 20 rows');
          return route.fulfill({ json: { books: filtered.slice(offset, offset + limit), total_count: filtered.length } });
        });
        await page.goto(`${base}/librarian/`);
        await page.locator('#staff-username').fill(username);
        await page.locator('#staff-password').fill(password);
        await page.locator('form button').click();
        await page.getByRole('button', { name: labels.books, exact: true }).click();
        const pagination = page.getByRole('navigation', { name: labels.pages });
        const checkPage = async (first, count, number) => {
          await page.getByText(`Pagination fixture ${String(first).padStart(2, '0')}`, { exact: true }).waitFor();
          assert.equal(await page.locator('tbody tr').count(), count);
          assert.equal(await pagination.locator('[aria-current="page"]').innerText(), String(number));
        };
        await checkPage(1, 20, 1);
        assert(await pagination.getByRole('button', { name: labels.previous, exact: true }).isDisabled());
        await pagination.getByRole('button', { name: labels.next, exact: true }).click();
        await checkPage(21, 20, 2);
        await pagination.getByRole('button', { name: labels.next, exact: true }).click();
        await checkPage(41, 5, 3);
        assert(await pagination.getByRole('button', { name: labels.next, exact: true }).isDisabled());
        await pagination.getByRole('button', { name: labels.previous, exact: true }).click();
        await checkPage(21, 20, 2);
        await pagination.getByRole('button', { name: '3', exact: true }).click();
        await checkPage(41, 5, 3);
        const search = page.locator('.content-wrapper input.form-control').first();
        await search.fill('Pagination fixture 04');
        await checkPage(4, 1, 1);
        assert(await pagination.getByRole('button', { name: labels.next, exact: true }).isDisabled());
        await search.fill('');
        await checkPage(1, 20, 1);
        const usersResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/users'));
        await page.getByRole('button', { name: labels.users, exact: true }).click();
        const users = await (await usersResponse).json();
        await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('.card-header.bg-white strong').innerText(), String(users.total || 0));
        assert.deepEqual(errors, []);
        console.log(`${locale}: book rows, page buttons, last page, search reset, and user totals verified`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
