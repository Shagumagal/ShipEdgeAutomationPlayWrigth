import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://x5test.shipedge.com/users/sign_in');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('test@send.com');
  await page.getByRole('textbox', { name: 'Password I forgot password' }).click();
  await page.getByRole('textbox', { name: 'Password I forgot password' }).fill('test123');
  await page.getByRole('textbox', { name: 'Password I forgot password' }).press('Enter');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: ' Users' }).click();
  await page.getByRole('button', { name: ' Invite user' }).click();
  await page.getByRole('textbox', { name: 'Email *' }).click();
  await page.getByRole('textbox', { name: 'Email *' }).fill('userprueba1@yopmail.com');
  await page.getByRole('combobox', { name: 'Select an Option' }).click();
  await page.getByRole('option', { name: 'User' }).click();
  await page.getByRole('button', { name: 'Facility (Warehouse) *' }).click();
  await page.locator('label').filter({ hasText: /^qa20$/ }).click();
  await page.getByRole('button', { name: 'Save' }).click();
});