import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

// Admin users can be identified by email domain or specific emails
// For now, we'll use a simple email check - you can modify this logic later
export const isAdminUser = (email: string): boolean => {
  // Add your admin email addresses here
  const adminEmails: string[] = [
    // Add admin emails here, e.g., "admin@yourdomain.com"
  ];

  // Check if user is in admin list or has admin domain
  return adminEmails.includes(email) || email.endsWith("@admin.local");
};

export const DUMMY_PASSWORD = generateDummyPassword();
