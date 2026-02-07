# Quick Setup Guide

Get your Playwright automation framework up and running in 5 minutes!

## ⚡ Quick Start (5 Minutes)

### Step 1: Install Dependencies (2 min)

```bash
# Install Node.js dependencies
npm install

# Install Playwright browsers
# Basic: npx playwright install chromium --with-deps
# Recommended (for parallel execution): Install all browsers
npx playwright install chromium msedge firefox webkit --with-deps
```

**Note**: Installing all browsers enables parallel test execution across multiple browsers. See [Multi-Browser Setup](#multi-browser-setup) in README.md for details.

### Step 2: Configure Environment (1 min)

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your application details
# At minimum, update:
# - BASE_URL=https://your-app.com
# - TEST_USER_EMAIL=your-test-email@example.com
# - TEST_USER_PASSWORD=your-password
```

### Step 3: Update Configuration (1 min)

**File:** `playwright.config.ts`

Update these values:
- `baseURL` - Your application URL (or use `.env` file)
- `testIdAttribute` - Your app's test ID attribute (if used)
- `timezoneId` - Your application's timezone

### Step 4: Run Example Tests (1 min)

```bash
# Run example tests to verify setup
npm run test:smoke-chrome

# Or run in UI mode to see tests execute
npx playwright test --ui
```

## ✅ Setup Verification

After setup, you should be able to:

- ✅ Run tests: `npm run test:smoke-chrome`
- ✅ Generate Allure report: `npm run allure:generate`
- ✅ Open Allure report: `npm run allure:open`
- ✅ See Playwright HTML report: `npx playwright show-report`

## 🎯 Next Steps

1. **Review Example Files:**
   - `page-objects/example-login-page.ts` - See Page Object pattern
   - `tests/example-login.spec.ts` - See test structure

2. **Create Your First Page Object:**
   - Copy `example-login-page.ts` as a template
   - Update locators for your application
   - Add to `page-object-fixtures.ts`

3. **Write Your First Test:**
   - Copy `example-login.spec.ts` as a template
   - Update test steps for your scenarios
   - Add Allure metadata

4. **Read Documentation:**
   - [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) - Customization guide
   - [docs/README.md](docs/README.md) - Full documentation

## 🔧 Common Setup Issues

### Issue: "Cannot find module"
**Solution:** Run `npm install` again

### Issue: "Browser not found"
**Solution:** Run `npx playwright install`

### Issue: "Environment variable not found"
**Solution:** Ensure `.env` file exists and variables are set

### Issue: "Tests fail immediately"
**Solution:** 
- Check `BASE_URL` is correct
- Verify application is accessible
- Check network connectivity

## 📖 Need More Help?

- **Full Documentation:** See [docs/README.md](docs/README.md)
- **Customization Guide:** See [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md)
- **Example Code:** Review files in `page-objects/` and `tests/`

---

**Ready to start?** Follow the Quick Start steps above! 🚀
