// tests/e2e/helpers/auth.js
// Shared login helper for all E2E tests

/**
 * Login as the test user and return the authenticated page
 */
export async function loginAs(page, email = 'ultra.boy7@gmail.com', password = '123456') {
  await page.goto('/');

  // We land on LandingPage when not authenticated
  // Click the hero Login button or nav Login
  const loginBtn = page.getByRole('button', { name: /login/i }).first();
  await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
  await loginBtn.click();

  // Fill the auth modal
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);

  // Click the submit button (Login) — inside the form to avoid strict-mode
  await page.locator('form').getByRole('button', { name: /login/i }).click();

  // Wait until we leave the landing page (authenticated redirect to /)
  await page.waitForURL(url => !url.toString().includes('landing'), { timeout: 20000 });

  // Wait for any post-login content to be ready (chat textarea or any main content)
  try {
    await page.waitForSelector('[data-tutor-tour="chat-input"], textarea, [data-testid="chat-input-container"], nav, header', { timeout: 15000 });
  } catch {
    // Some pages may not have chat input (e.g. tutor/skill-tree), that's ok
  }
}

/**
 * Send a chat message and wait for bot response
 */
export async function sendMessage(page, text, waitMs = 60000) {
  // The textarea has rotating placeholders; match broadly or fall back to textarea
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(text);

  // Press Enter or click Send
  const sendBtn = page.getByTitle(/send message/i).or(page.getByRole('button', { name: /send/i }));
  if (await sendBtn.isVisible()) {
    await sendBtn.click();
  } else {
    await input.press('Enter');
  }

  // Wait for bot response bubble to appear
  // Actual class is .message-bubble (not .bot-message), inside a .items-start wrapper for bot msgs
  await page.waitForSelector('.message-bubble, [class*="message-bubble"], [class*="items-start"] .message-bubble-wrapper', {
    timeout: waitMs,
  });

  // Wait for streaming to finish (cursor disappears)
  try {
    await page.waitForSelector('.streaming-cursor', { state: 'hidden', timeout: waitMs });
  } catch {
    // Cursor might have disappeared already
  }

  // Small settle time
  await page.waitForTimeout(1000);
}
