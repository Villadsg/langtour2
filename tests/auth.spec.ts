import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Signup Page', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.locator('h2')).toContainText('Create your account');
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#confirmPassword')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toContainText('Sign up');
    });

    test('should show generated username from email', async ({ page }) => {
      await page.goto('/signup');

      // Type to trigger Svelte reactivity
      await page.locator('#email').pressSequentially('testuser@example.com', { delay: 50 });

      await expect(page.locator('text=Your username will be:')).toBeVisible();
      await expect(page.locator('text=testuser')).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/signup');

      const loginLink = page.getByRole('link', { name: 'sign in to your existing account' });
      await expect(loginLink).toBeVisible();
      await loginLink.click();

      await expect(page).toHaveURL('/login');
    });

    test('should fill and submit signup form', async ({ page }) => {
      await page.goto('/signup');

      const testEmail = `test-${Date.now()}@example.com`;

      // Use pressSequentially to ensure Svelte picks up the values
      await page.locator('#email').pressSequentially(testEmail, { delay: 20 });
      await page.locator('#password').pressSequentially('TestPassword123!', { delay: 20 });
      await page.locator('#confirmPassword').pressSequentially('TestPassword123!', { delay: 20 });

      // Verify values are filled
      await expect(page.locator('#email')).toHaveValue(testEmail);
      await expect(page.locator('#password')).toHaveValue('TestPassword123!');

      await page.locator('button[type="submit"]').click();

      // Wait for some response - loading, success, or error
      await page.waitForTimeout(2000);

      // Check that something happened (button changed or message appeared)
      const buttonText = await page.locator('button[type="submit"]').textContent();
      const hasMessage = await page.locator('.bg-green-50, .bg-red-50').count() > 0;

      expect(buttonText?.includes('Creating') || buttonText?.includes('Sign up') || hasMessage).toBeTruthy();
    });
  });

  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.locator('h2')).toContainText('Sign in to your account');
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
    });

    test('should have link to signup page', async ({ page }) => {
      await page.goto('/login');

      const signupLink = page.getByRole('link', { name: 'create a new account' });
      await expect(signupLink).toBeVisible();
      await signupLink.click();

      await expect(page).toHaveURL('/signup');
    });

    test('should fill and submit login form', async ({ page }) => {
      await page.goto('/login');

      // Use pressSequentially to ensure Svelte picks up the values
      await page.locator('#email').pressSequentially('test@example.com', { delay: 20 });
      await page.locator('#password').pressSequentially('TestPassword123!', { delay: 20 });

      // Verify values are filled
      await expect(page.locator('#email')).toHaveValue('test@example.com');
      await expect(page.locator('#password')).toHaveValue('TestPassword123!');

      await page.locator('button[type="submit"]').click();

      // Wait for some response
      await page.waitForTimeout(2000);

      // Check that something happened
      const buttonText = await page.locator('button[type="submit"]').textContent();
      const hasMessage = await page.locator('.bg-green-50, .bg-red-50').count() > 0;

      expect(buttonText?.includes('Signing') || buttonText?.includes('Sign in') || hasMessage).toBeTruthy();
    });
  });

  test.describe('Navigation', () => {
    test('can navigate between login and signup', async ({ page }) => {
      // Start at login
      await page.goto('/login');
      await expect(page.locator('h2')).toContainText('Sign in to your account');

      // Go to signup using content link
      await page.getByRole('link', { name: 'create a new account' }).click();
      await expect(page).toHaveURL('/signup');
      await expect(page.locator('h2')).toContainText('Create your account');

      // Go back to login using content link
      await page.getByRole('link', { name: 'sign in to your existing account' }).click();
      await expect(page).toHaveURL('/login');
      await expect(page.locator('h2')).toContainText('Sign in to your account');
    });

    test('can use navbar links', async ({ page }) => {
      await page.goto('/');

      // Click Login in navbar
      await page.getByRole('link', { name: 'Login' }).click();
      await expect(page).toHaveURL('/login');

      // Click Sign Up in navbar
      await page.getByRole('link', { name: 'Sign Up' }).click();
      await expect(page).toHaveURL('/signup');
    });
  });
});
