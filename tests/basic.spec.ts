import { test, expect } from '@playwright/test';

// Basic smoke test that the web UI loads without the backend running
// (App.tsx tolerates backend fetch failures and still renders the shell)

test('loads home page and shows chat UI', async ({ page }) => {
  await page.goto('/');

  // Chat assistant greeting
  await expect(page.getByText("I'm Elideable, your AI app builder", { exact: false })).toBeVisible();

  // Input placeholder exists
  await expect(page.getByPlaceholder('Describe your app...')).toBeVisible();

  // Tabs exist (Preview / Code)
  await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Code' })).toBeVisible();
});

