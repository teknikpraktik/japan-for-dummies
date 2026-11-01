import { expect, type Page } from "@playwright/test";
import { totp } from "./totp";

/** Syntetiska konton som skapas av scripts/seed-synthetic (samma värden som src/server/services/synthetic.ts). */
export const SYN = {
  teacherEmail: "larare.syntetisk@example.test",
  teacherPassword: "Syntetiskt-losenord-1",
  teacherTotpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  username: (n: number) => `syn_elev_${String(n).padStart(2, "0")}`,
  code: (n: number) => `SYNTETISKELEV${String(n).padStart(2, "0")}`,
};

export async function loginStudent(page: Page, n: number, opts: { code?: string } = {}) {
  await page.goto("/logga-in/");
  await page.getByTestId("identity").fill(SYN.username(n));
  await page.getByTestId("secret").fill(opts.code ?? SYN.code(n));
  await page.getByTestId("login-submit").click();
}

export async function loginStudentOk(page: Page, n: number) {
  await loginStudent(page, n);
  await expect(page).toHaveURL(/\/min-utbildning\/$/);
  await expect(page.getByTestId("account-name")).toBeVisible();
}

export async function loginTeacher(page: Page) {
  await page.goto("/logga-in/");
  await page.getByLabel("Lärare").check({ force: true });
  await page.getByTestId("identity").fill(SYN.teacherEmail);
  await page.getByTestId("secret").fill(SYN.teacherPassword);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("otp").fill(totp(SYN.teacherTotpSecret));
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/lararen\/$/);
}
