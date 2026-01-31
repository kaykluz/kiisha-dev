export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  
  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? "noreply@kiisha.io",
  
  // Grafana
  grafanaUrl: process.env.GRAFANA_URL ?? "",
  grafanaAdminToken: process.env.GRAFANA_ADMIN_TOKEN ?? "",
};
