import { expect, test, type Page } from '@playwright/test'

const adminTabs = ['Kalender', 'Anträge', 'Benutzer', 'Gruppen', 'Freie Tage', 'Einstellungen']
const smokeEmail = 'browser-smoke@example.com'
const smokeTemporaryPassword = 'UseAUnique!Temporary2026'
const smokePassword = 'UseAUnique!Changed2026'

async function visibleLayoutProblems(page: Page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth
    const selectors = [
      '.topbar',
      '.clock-panel',
      '.clock-log-panel',
      '.time-export-panel',
      '.summary-panel',
      '.calendar-panel',
      '.calendar-legend',
      '.sharing-panel',
      '.request-form-panel',
      '.requests-list-panel',
      '.admin-users-panel',
      '.approved-actions-panel',
      '.group-admin-panel',
      '.holiday-admin-panel',
      '.holiday-template-form',
      '.license-panel',
      '.mail-server-panel',
      '.backup-panel',
      '.mail-server-actions',
      '.sharing-panel > .primary-button',
      '.clock-actions button',
    ]

    return selectors
      .flatMap((selector) =>
        [...document.querySelectorAll(selector)].map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            selector,
            text: (element.textContent ?? '').trim().slice(0, 48),
            x: rect.x,
            right: rect.right,
            width: rect.width,
            problem: rect.width > 0 && (rect.x < -1 || rect.right > viewport + 1),
          }
        }),
      )
      .filter((item) => item.problem)
  })
}

async function signIn(page: Page, password: string) {
  await page.getByLabel('E-Mail').fill(smokeEmail)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Einloggen' }).click()
}

async function waitForLoginResult(page: Page) {
  const clockPanel = page.locator('.clock-panel')
  const forcedPasswordChange = page.getByRole('heading', { name: 'Passwort ändern' })
  const loginError = page.locator('.form-error').filter({ hasText: 'Invalid email or password' })

  return Promise.race([
    clockPanel.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'ready' as const),
    forcedPasswordChange.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'forced-password' as const),
    loginError.waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'login-error' as const),
  ])
}

test('admin workflow screens render without browser errors or mobile overflow', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('status of 401')) browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.addInitScript(() => localStorage.setItem('time-tracker-language', 'de'))
  await page.goto('/')
  await signIn(page, smokeTemporaryPassword)

  let loginResult = await waitForLoginResult(page)
  if (loginResult === 'login-error') {
    await signIn(page, smokePassword)
    loginResult = await waitForLoginResult(page)
  }

  if (loginResult === 'forced-password') {
    await page.getByLabel('Aktuelles Passwort').fill(smokeTemporaryPassword)
    await page.getByLabel('Neues Passwort').fill(smokePassword)
    await page.getByLabel('Passwort bestätigen').fill(smokePassword)
    await page.getByRole('button', { name: 'Neues Passwort speichern' }).click()
    await page.locator('.clock-panel').waitFor({ state: 'visible', timeout: 5_000 })
  }

  await expect(page.locator('.clock-panel')).toBeVisible()
  await expect(page.getByText('Zeitkonto')).toBeVisible()

  const nav = page.locator('nav.tabs')
  for (const tabName of adminTabs) {
    const tabButton = nav.getByRole('button', { exact: true, name: tabName })
    await tabButton.click()
    await expect(tabButton).toBeVisible()
    await expect(await visibleLayoutProblems(page)).toEqual([])
  }

  await expect(browserErrors).toEqual([])
})
