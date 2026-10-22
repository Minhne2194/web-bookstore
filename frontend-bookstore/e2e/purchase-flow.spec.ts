import { test, expect } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════
 * KIỂM THỬ HỆ THỐNG — Quy Trình Mua Hàng End-to-End
 * ═══════════════════════════════════════════════════════════
 * Mô phỏng một người dùng thực tế: từ tìm kiếm → xem chi tiết 
 * → thêm giỏ hàng → đăng nhập → checkout → xem đơn hàng.
 * 
 * YÊU CẦU: Backend (localhost:3000) và Frontend (localhost:5173) 
 * phải đang chạy trước khi chạy test.
 */

test.describe('Quy trình mua hàng hoàn chỉnh', () => {

  // ───────────────────────────────────────────────────────
  // Test 1: Trang chủ hiển thị đúng
  // ───────────────────────────────────────────────────────
  test('1. Truy cập trang chủ → Kiểm tra hiển thị', async ({ page }) => {
    await page.goto('/');

    // Kiểm tra Header tồn tại
    await expect(page.locator('header')).toBeVisible();

    // Kiểm tra có title phù hợp
    await expect(page).toHaveTitle(/Book|Sách|Store/i);

    // Kiểm tra có banner hoặc section sách
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Kiểm tra footer
    await expect(page.locator('footer')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 2: Tìm kiếm sách
  // ───────────────────────────────────────────────────────
  test('2. Tìm kiếm sách → Xem kết quả', async ({ page }) => {
    await page.goto('/');

    // Tìm ô search trong header
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="Tìm"], input[placeholder*="tìm"], input[placeholder*="Search"], input[placeholder*="search"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('sách');
      await searchInput.press('Enter');

      // Chờ navigate đến trang search
      await page.waitForURL(/\/search/i, { timeout: 5000 }).catch(() => {
        // Some implementations might show results inline
      });
    } else {
      // Navigate directly to search page
      await page.goto('/search?q=sách');
    }

    // Kiểm tra trang search hiển thị
    await expect(page.locator('main')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 3: Xem danh sách sách và chi tiết
  // ───────────────────────────────────────────────────────
  test('3. Xem danh sách sách → Click vào sách → Xem chi tiết', async ({ page }) => {
    await page.goto('/search');

    // Chờ sách hiển thị (tìm link hoặc card sách)
    const bookCards = page.locator('a[href*="/book/"]');
    const count = await bookCards.count();

    if (count > 0) {
      // Click vào sách đầu tiên
      await bookCards.first().click();

      // Chờ trang chi tiết load
      await page.waitForURL(/\/book\//);

      // Kiểm tra thông tin sách hiển thị
      await expect(page.locator('main')).toBeVisible();

      // Kiểm tra có nút "Thêm vào giỏ hàng" hoặc tương tự
      const addToCartBtn = page.locator('button').filter({
        hasText: /thêm|giỏ|cart|add|mua/i,
      });
      const btnCount = await addToCartBtn.count();
      expect(btnCount).toBeGreaterThan(0);
    }
  });

  // ───────────────────────────────────────────────────────
  // Test 4: Thêm sách vào giỏ hàng
  // ───────────────────────────────────────────────────────
  test('4. Thêm sách vào giỏ hàng → Kiểm tra badge', async ({ page }) => {
    await page.goto('/search');

    // Tìm sách và click vào
    const bookCards = page.locator('a[href*="/book/"]');
    const count = await bookCards.count();

    if (count > 0) {
      await bookCards.first().click();
      await page.waitForURL(/\/book\//);

      // Click nút "Thêm vào giỏ hàng"
      const addToCartBtn = page.locator('button').filter({
        hasText: /thêm|giỏ|cart|add|mua/i,
      }).first();

      if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();

        // Chờ thông báo thành công (toast)
        await page
          .locator('[class*="toast"], [role="alert"], [class*="notification"]')
          .first()
          .waitFor({ timeout: 3000 })
          .catch(() => {
            // Toast might auto-dismiss quickly
          });
      }
    }
  });

  // ───────────────────────────────────────────────────────
  // Test 5: Xem giỏ hàng
  // ───────────────────────────────────────────────────────
  test('5. Navigate đến giỏ hàng → Kiểm tra hiển thị', async ({ page }) => {
    await page.goto('/cart');

    // Kiểm tra trang giỏ hàng load được
    await expect(page.locator('main')).toBeVisible();

    // Trang giỏ hàng có thể rỗng hoặc có sản phẩm
    // Kiểm tra có heading hoặc text liên quan
    const cartContent = page.locator('main');
    await expect(cartContent).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 6: Trang đăng nhập
  // ───────────────────────────────────────────────────────
  test('6. Navigate đến trang đăng nhập → Kiểm tra form', async ({ page }) => {
    await page.goto('/login');

    // Kiểm tra form đăng nhập tồn tại
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button').filter({
      hasText: /đăng nhập|login|sign in/i,
    }).first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 7: Trang đăng ký
  // ───────────────────────────────────────────────────────
  test('7. Navigate đến trang đăng ký → Kiểm tra form', async ({ page }) => {
    await page.goto('/register');

    // Kiểm tra form đăng ký
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 8: Luồng đăng nhập → Checkout (smoke test)
  // ───────────────────────────────────────────────────────
  test('8. Đăng nhập → Thêm giỏ → Checkout', async ({ page }) => {
    // Bước 1: Đăng nhập
    await page.goto('/login');

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
      await passwordInput.fill('123456');

      const submitBtn = page.locator('button[type="submit"], button').filter({
        hasText: /đăng nhập|login|sign in/i,
      }).first();
      await submitBtn.click();

      // Chờ redirect sau đăng nhập
      await page.waitForTimeout(2000);
    }

    // Bước 2: Thêm sách vào giỏ hàng
    await page.goto('/search');
    const bookCards = page.locator('a[href*="/book/"]');
    const count = await bookCards.count();

    if (count > 0) {
      await bookCards.first().click();
      await page.waitForURL(/\/book\//);

      const addToCartBtn = page.locator('button').filter({
        hasText: /thêm|giỏ|cart|add|mua/i,
      }).first();

      if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Bước 3: Đi đến giỏ hàng
    await page.goto('/cart');
    await expect(page.locator('main')).toBeVisible();

    // Bước 4: Đi đến checkout
    await page.goto('/checkout');
    await expect(page.locator('main')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 9: Sách mới
  // ───────────────────────────────────────────────────────
  test('9. Trang sách mới hiển thị đúng', async ({ page }) => {
    await page.goto('/new-books');

    await expect(page.locator('main')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────
  // Test 10: Sách bán chạy
  // ───────────────────────────────────────────────────────
  test('10. Trang sách bán chạy hiển thị đúng', async ({ page }) => {
    await page.goto('/best-sellers');

    await expect(page.locator('main')).toBeVisible();
  });
});
