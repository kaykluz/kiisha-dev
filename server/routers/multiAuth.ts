import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// OAuth provider configurations
const OAUTH_PROVIDERS = {
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET"
  },
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    emailUrl: "https://api.github.com/user/emails",
    scopes: ["read:user", "user:email"],
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET"
  },
  microsoft: {
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: ["openid", "email", "profile", "User.Read"],
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET"
  }
};

type OAuthProvider = "google" | "github" | "microsoft";

// Helper to get OAuth config from environment
function getOAuthConfig(provider: OAuthProvider) {
  const config = OAUTH_PROVIDERS[provider];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  
  return {
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    isConfigured: Boolean(clientId && clientSecret),
    ...config
  };
}

// Helper to exchange code for tokens
async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  tokenUrl: string
) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded"
  };

  // GitHub requires Accept header for JSON response
  if (provider === "github") {
    headers["Accept"] = "application/json";
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token exchange failed for ${provider}:`, errorText);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange code for tokens: ${response.status}`
    });
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in
  };
}

// Helper to get user info from provider
async function getUserInfoFromProvider(
  provider: OAuthProvider,
  accessToken: string,
  userInfoUrl: string
): Promise<{ id: string; email: string; name: string; picture?: string }> {
  const response = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get user info from provider"
    });
  }

  const data = await response.json();

  // Normalize user info across providers
  switch (provider) {
    case "google":
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    case "github":
      // GitHub may not return email in user info, need to fetch separately
      let email = data.email;
      if (!email) {
        const emailResponse = await fetch(OAUTH_PROVIDERS.github.emailUrl!, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
          }
        });
        if (emailResponse.ok) {
          const emails = await emailResponse.json();
          const primaryEmail = emails.find((e: { primary: boolean }) => e.primary);
          email = primaryEmail?.email || emails[0]?.email;
        }
      }
      return {
        id: String(data.id),
        email: email || "",
        name: data.name || data.login,
        picture: data.avatar_url
      };
    case "microsoft":
      return {
        id: data.id,
        email: data.mail || data.userPrincipalName,
        name: data.displayName,
        picture: undefined // Microsoft requires separate call for photo
      };
    default:
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unknown provider"
      });
  }
}

export const multiAuthRouter = router({
  // Get available auth providers (always show all, indicate which are configured)
  getProviders: publicProcedure.query(async () => {
    const providers = [
      { provider: "manus", name: "Manus", enabled: true, configured: true },
      { provider: "email", name: "Email", enabled: true, configured: true },
      { 
        provider: "google", 
        name: "Google", 
        enabled: true, 
        configured: getOAuthConfig("google").isConfigured 
      },
      { 
        provider: "github", 
        name: "GitHub", 
        enabled: true, 
        configured: getOAuthConfig("github").isConfigured 
      },
      { 
        provider: "microsoft", 
        name: "Microsoft", 
        enabled: true, 
        configured: getOAuthConfig("microsoft").isConfigured 
      }
    ];
    
    return providers;
  }),

  // Get OAuth authorization URL
  getAuthUrl: publicProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"]),
      redirectUri: z.string().url(),
      state: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const config = getOAuthConfig(input.provider);
      
      if (!config.isConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${input.provider.charAt(0).toUpperCase() + input.provider.slice(1)} OAuth is not configured. Please add ${config.clientIdEnv} and ${config.clientSecretEnv} to your environment.`
        });
      }
      
      const state = input.state || crypto.randomBytes(16).toString("hex");
      
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: input.redirectUri,
        response_type: "code",
        scope: config.scopes.join(" "),
        state
      });
      
      // Provider-specific params
      if (input.provider === "google") {
        params.set("access_type", "offline");
        params.set("prompt", "consent");
      }
      
      return {
        url: `${config.authorizationUrl}?${params.toString()}`,
        state
      };
    }),

  // Exchange OAuth code for tokens and authenticate
  handleCallback: publicProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"]),
      code: z.string(),
      redirectUri: z.string().url(),
      state: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const config = getOAuthConfig(input.provider);
      
      if (!config.isConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${input.provider} OAuth is not configured`
        });
      }
      
      // Exchange code for tokens
      const tokenResponse = await exchangeCodeForTokens(
        input.provider,
        input.code,
        input.redirectUri,
        config.clientId,
        config.clientSecret,
        config.tokenUrl
      );
      
      // Get user info from provider
      const userInfo = await getUserInfoFromProvider(
        input.provider,
        tokenResponse.access_token,
        config.userInfoUrl
      );
      
      if (!userInfo.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not retrieve email from OAuth provider. Please ensure your account has a verified email."
        });
      }
      
      // Check if this OAuth account is already linked to a user
      const existingOAuthAccount = await db.getOAuthAccountByProvider(
        input.provider,
        userInfo.id
      );
      
      let userId: number;
      let userOpenId: string;
      let userName: string;
      let isNewUser = false;

      if (existingOAuthAccount) {
        // Update tokens and login
        await db.updateOAuthAccountTokens(
          existingOAuthAccount.id,
          tokenResponse.access_token,
          tokenResponse.refresh_token,
          tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined
        );
        userId = existingOAuthAccount.userId;

        // Get the user's openId for session
        const user = await db.getUserById(userId);
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "User not found after OAuth link"
          });
        }
        userOpenId = user.openId;
        userName = user.name || userInfo.name;
        
        // Sync profile if picture changed
        if (userInfo.picture) {
          await db.updateUserProfile(userId, {
            avatarUrl: userInfo.picture
          });
        }
      } else {
        // Check if user exists with this email
        const existingUser = await db.getUserByEmail(userInfo.email);
        
        if (existingUser) {
          userId = existingUser.id;
          userOpenId = existingUser.openId;
          userName = existingUser.name || userInfo.name;
          // Link this OAuth account to existing user
          await db.createOAuthAccount({
            userId,
            oauthProvider: input.provider,
            providerAccountId: userInfo.id,
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined,
            providerEmail: userInfo.email,
            providerName: userInfo.name
          });

          // Sync profile picture if not set
          if (userInfo.picture && !existingUser.avatarUrl) {
            await db.updateUserProfile(userId, {
              avatarUrl: userInfo.picture
            });
          }
        } else {
          // Create new user via OAuth
          const newUser = await db.createUserWithOAuth({
            email: userInfo.email,
            name: userInfo.name,
            avatarUrl: userInfo.picture,
            provider: input.provider
          });

          userId = newUser.id;
          userOpenId = newUser.openId;
          userName = userInfo.name;
          isNewUser = true;
          
          // Create OAuth account link
          await db.createOAuthAccount({
            userId,
            oauthProvider: input.provider,
            providerAccountId: userInfo.id,
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined,
            providerEmail: userInfo.email,
            providerName: userInfo.name,
            providerAvatarUrl: userInfo.picture
          });
        }
      }
      
      // Create JWT session token using SDK (this is what the auth system expects)
      const sessionToken = await sdk.createSessionToken(userOpenId, { name: userName });
      
      // Log login activity
      try {
        await db.createLoginActivity({
          userId,
          provider: input.provider,
          ipAddress: ctx.req?.ip || ctx.req?.headers?.["x-forwarded-for"]?.toString() || null,
          userAgent: ctx.req?.headers?.["user-agent"] || null,
          success: true
        });
      } catch (e) {
        // Don't fail login if activity logging fails
        console.error("Failed to log login activity:", e);
      }
      
      return {
        success: true,
        sessionToken,
        isNewUser,
        user: {
          id: userId,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        }
      };
    }),

  // Register with email/password
  registerWithEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      // Check if user exists
      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists"
        });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 12);
      
      // Create user using createLocalUser which handles openId generation
      const user = await db.createLocalUser({
        email: input.email,
        name: input.name || input.email.split("@")[0],
        passwordHash
      });
      
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user account"
        });
      }
      
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await db.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        email: input.email,
        expiresAt
      });
      
      // Send verification email using notification system
      try {
        const verifyUrl = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
        
        // Use the notification provider to send email
        const { getNotifyAdapter } = await import('../providers/factory');
        // Use org 0 for system-level notifications
        const notifyProvider = await getNotifyAdapter(0);
        
        if (notifyProvider) {
          await notifyProvider.sendEmail({
            to: input.email,
            subject: 'Verify your KIISHA account',
            html: `
              <h2>Welcome to KIISHA!</h2>
              <p>Please verify your email address by clicking the link below:</p>
              <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
              <p>Or copy and paste this link: ${verifyUrl}</p>
              <p>This link expires in 24 hours.</p>
              <p>If you didn't create this account, you can safely ignore this email.</p>
            `,
            text: `Welcome to KIISHA! Please verify your email by visiting: ${verifyUrl}. This link expires in 24 hours.`
          });
        }
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }
      
      return {
        success: true,
        message: "Account created successfully. Please check your email to verify your account."
      };
    }),

  // Login with email/password
  loginWithEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
      rememberMe: z.boolean().optional().default(false)
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByEmail(input.email);
      
      if (!user || !user.passwordHash) {
        // Log failed attempt
        try {
          await db.createLoginActivity({
            userId: user?.id || null,
            provider: "email",
            ipAddress: ctx.req?.ip || ctx.req?.headers?.["x-forwarded-for"]?.toString() || null,
            userAgent: ctx.req?.headers?.["user-agent"] || null,
            success: false,
            failureReason: "Invalid credentials"
          });
        } catch (e) {
          console.error("Failed to log login activity:", e);
        }
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      }
      
      const validPassword = await bcrypt.compare(input.password, user.passwordHash);
      
      if (!validPassword) {
        // Log failed attempt
        try {
          await db.createLoginActivity({
            userId: user.id,
            provider: "email",
            ipAddress: ctx.req?.ip || ctx.req?.headers?.["x-forwarded-for"]?.toString() || null,
            userAgent: ctx.req?.headers?.["user-agent"] || null,
            success: false,
            failureReason: "Invalid password"
          });
        } catch (e) {
          console.error("Failed to log login activity:", e);
        }
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      }
      
      // Create JWT session token using SDK (this is what the auth system expects)
      const sessionDuration = input.rememberMe
        ? 30 * 24 * 60 * 60 * 1000  // 30 days
        : 24 * 60 * 60 * 1000;       // 1 day
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: sessionDuration
      });
      
      // Log successful login
      const ipAddress = ctx.req?.ip || ctx.req?.headers?.["x-forwarded-for"]?.toString() || null;
      const userAgent = ctx.req?.headers?.["user-agent"] || null;
      
      try {
        await db.createLoginActivity({
          userId: user.id,
          provider: "email",
          ipAddress,
          userAgent,
          success: true
        });
      } catch (e) {
        console.error("Failed to log login activity:", e);
      }
      
      // Check for suspicious login (new IP or device)
      let isSuspicious = false;
      let suspiciousReason = "";
      
      try {
        if (ipAddress) {
          const isNewIp = await db.isNewIpAddress(user.id, ipAddress);
          if (isNewIp) {
            isSuspicious = true;
            suspiciousReason = "new_ip";
          }
        }
        
        if (userAgent) {
          const isNewDevice = await db.isNewUserAgent(user.id, userAgent);
          if (isNewDevice && !isSuspicious) {
            isSuspicious = true;
            suspiciousReason = "new_device";
          }
        }
        
        // Send alert for suspicious login
        if (isSuspicious && user.email) {
          try {
            const { getNotifyAdapter } = await import('../providers/factory');
            const notifyProvider = await getNotifyAdapter(0);
            
            if (notifyProvider) {
              await notifyProvider.sendEmail({
                to: user.email,
                subject: 'New login detected on your KIISHA account',
                html: `
                  <h2>Security Alert</h2>
                  <p>We detected a login to your KIISHA account from a ${suspiciousReason === 'new_ip' ? 'new location' : 'new device'}.</p>
                  <p><strong>Details:</strong></p>
                  <ul>
                    <li>Time: ${new Date().toLocaleString()}</li>
                    ${ipAddress ? `<li>IP Address: ${ipAddress}</li>` : ''}
                    ${userAgent ? `<li>Device: ${userAgent.substring(0, 100)}</li>` : ''}
                  </ul>
                  <p>If this was you, you can ignore this email. If you didn't log in, please secure your account immediately by changing your password.</p>
                `,
                text: `Security Alert: New login detected on your KIISHA account from a ${suspiciousReason === 'new_ip' ? 'new location' : 'new device'}. Time: ${new Date().toLocaleString()}. If this wasn't you, please secure your account.`
              });
            }
          } catch (alertError) {
            console.error('Failed to send suspicious login alert:', alertError);
          }
        }
      } catch (e) {
        console.error("Failed to check suspicious login:", e);
      }
      
      return {
        success: true,
        sessionToken,
        isSuspicious,
        suspiciousReason: isSuspicious ? suspiciousReason : undefined,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      };
    }),

  // Verify email address
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string()
    }))
    .mutation(async ({ input }) => {
      const tokenRecord = await db.getEmailVerificationToken(input.token);
      
      if (!tokenRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired verification link"
        });
      }
      
      // Mark token as used
      await db.markEmailVerificationTokenUsed(input.token);
      
      // Update user's email verification status
      await db.updateUserProfile(tokenRecord.userId, {
        emailVerified: true,
        emailVerifiedAt: new Date()
      });
      
      return {
        success: true,
        message: "Email verified successfully. You can now log in."
      };
    }),

  // Resend verification email
  resendVerification: publicProcedure
    .input(z.object({
      email: z.string().email()
    }))
    .mutation(async ({ input }) => {
      const user = await db.getUserByEmail(input.email);
      
      if (!user) {
        // Don't reveal if user exists
        return {
          success: true,
          message: "If an account exists with this email, a verification link has been sent."
        };
      }
      
      if (user.emailVerified) {
        return {
          success: true,
          message: "Your email is already verified."
        };
      }
      
      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await db.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        email: input.email,
        expiresAt
      });
      
      // Send verification email
      try {
        const verifyUrl = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
        
        const { getNotifyAdapter } = await import('../providers/factory');
        const notifyProvider = await getNotifyAdapter(0);
        
        if (notifyProvider) {
          await notifyProvider.sendEmail({
            to: input.email,
            subject: 'Verify your KIISHA account',
            html: `
              <h2>Email Verification</h2>
              <p>Please verify your email address by clicking the link below:</p>
              <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
              <p>Or copy and paste this link: ${verifyUrl}</p>
              <p>This link expires in 24 hours.</p>
            `,
            text: `Please verify your email by visiting: ${verifyUrl}. This link expires in 24 hours.`
          });
        }
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
      
      return {
        success: true,
        message: "If an account exists with this email, a verification link has been sent."
      };
    }),

  // Get linked OAuth accounts for current user
  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.getOAuthAccountsByUser(ctx.user.id);
    return accounts.map((a: { id: number; provider: string; providerAccountId: string; createdAt: Date | null }) => ({
      id: a.id,
      provider: a.provider,
      providerAccountId: a.providerAccountId,
      linkedAt: a.createdAt
    }));
  }),

  // Link a new OAuth account to current user
  linkAccount: protectedProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"]),
      code: z.string(),
      redirectUri: z.string().url()
    }))
    .mutation(async ({ input, ctx }) => {
      const config = getOAuthConfig(input.provider);
      
      if (!config.isConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${input.provider} OAuth is not configured`
        });
      }
      
      // Exchange code for tokens
      const tokenResponse = await exchangeCodeForTokens(
        input.provider,
        input.code,
        input.redirectUri,
        config.clientId,
        config.clientSecret,
        config.tokenUrl
      );
      
      // Get user info
      const userInfo = await getUserInfoFromProvider(
        input.provider,
        tokenResponse.access_token,
        config.userInfoUrl
      );
      
      // Check if this OAuth account is already linked to another user
      const existingAccount = await db.getOAuthAccountByProvider(
        input.provider,
        userInfo.id
      );
      
      if (existingAccount && existingAccount.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This account is already linked to another user"
        });
      }
      
      if (existingAccount) {
        // Update tokens
        await db.updateOAuthAccountTokens(
          existingAccount.id,
          tokenResponse.access_token,
          tokenResponse.refresh_token,
          tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined
        );
      } else {
        // Create new link
        await db.createOAuthAccount({
          userId: ctx.user.id,
          oauthProvider: input.provider,
          providerAccountId: userInfo.id,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined,
          providerEmail: userInfo.email,
          providerName: userInfo.name,
          providerAvatarUrl: userInfo.picture
        });
      }
      
      // Sync profile picture if user doesn't have one
      const user = await db.getUserById(ctx.user.id);
      if (userInfo.picture && !user?.avatarUrl) {
        await db.updateUserProfile(ctx.user.id, {
          avatarUrl: userInfo.picture
        });
      }
      
      return { success: true };
    }),

  // Unlink an OAuth account
  unlinkAccount: protectedProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"])
    }))
    .mutation(async ({ input, ctx }) => {
      // Get all linked accounts
      const accounts = await db.getOAuthAccountsByUser(ctx.user.id);
      const user = await db.getUserById(ctx.user.id);
      
      // Ensure user has another way to login
      const hasPassword = user?.passwordHash;
      const otherOAuthAccounts = accounts.filter((a: { provider: string }) => a.provider !== input.provider);
      
      if (!hasPassword && otherOAuthAccounts.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot unlink the only login method. Please set a password or link another account first."
        });
      }
      
      await db.deleteOAuthAccount(ctx.user.id, input.provider);
      
      return { success: true };
    }),

  // Get login activity for current user
  getLoginActivity: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20)
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 20;
      const activities = await db.getLoginActivityByUserId(ctx.user.id, limit);
      return activities;
    }),

  // Sync profile from linked OAuth provider
  syncProfileFromProvider: protectedProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"])
    }))
    .mutation(async ({ input, ctx }) => {
      // Get the linked account
      const account = await db.getOAuthAccountByProvider(input.provider, ctx.user.openId);
      
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No ${input.provider} account linked`
        });
      }
      
      // Check if token is expired and needs refresh
      let accessToken = account.accessToken;
      
      if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date() && account.refreshToken) {
        // Try to refresh the token
        try {
          const config = getOAuthConfig(input.provider);
          const tokenResponse = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: account.refreshToken,
              client_id: config.clientId,
              client_secret: config.clientSecret
            })
          });
          
          if (tokenResponse.ok) {
            const tokens = await tokenResponse.json();
            accessToken = tokens.access_token;
            
            // Update stored tokens
            await db.updateOAuthAccountTokens(
              account.id,
              tokens.access_token,
              tokens.refresh_token || account.refreshToken,
              tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined
            );
          }
        } catch (e) {
          console.error("Failed to refresh token:", e);
        }
      }
      
      // Get fresh user info from provider
      const config = getOAuthConfig(input.provider);
      const userInfo = await getUserInfoFromProvider(input.provider, accessToken, config.userInfoUrl);
      
      // Update user profile
      const updates: { name?: string; avatarUrl?: string } = {};
      
      if (userInfo.name) {
        updates.name = userInfo.name;
      }
      if (userInfo.picture) {
        updates.avatarUrl = userInfo.picture;
      }
      
      if (Object.keys(updates).length > 0) {
        await db.updateUserProfile(ctx.user.id, updates);
      }
      
      // Update OAuth account info
      await db.updateOAuthAccountInfo(account.id, {
        providerName: userInfo.name,
        providerEmail: userInfo.email,
        providerAvatarUrl: userInfo.picture
      });
      
      return {
        success: true,
        synced: {
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture
        }
      };
    }),

  // ============ OAuth Configuration (Admin Only) ============
  
  // Get all OAuth provider configurations (admin only)
  getOAuthConfigs: protectedProcedure
    .query(async ({ ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      
      const configs = await db.getOAuthProviderConfigs();
      return configs.map(c => ({
        provider: c.provider,
        clientId: c.clientId,
        tenantId: null, // Not in schema, would need migration
        enabled: c.isEnabled,
        lastTestSuccess: null, // Not in schema, would need migration
        lastTestAt: null, // Not in schema, would need migration
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    }),
  
  // Save OAuth provider configuration (admin only)
  saveOAuthConfig: protectedProcedure
    .input(z.object({
      provider: z.enum(['google', 'github', 'microsoft']),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      tenantId: z.string().optional(), // For Microsoft Azure AD
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      
      await db.upsertOAuthProviderConfig({
        oauthProvider: input.provider,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        isEnabled: true,
      });
      
      return { success: true };
    }),
  
  // Test OAuth provider configuration (admin only)
  testOAuthConfig: protectedProcedure
    .input(z.object({
      provider: z.enum(['google', 'github', 'microsoft']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      
      const config = await db.getOAuthProviderConfig(input.provider);
      if (!config) {
        return { success: false, error: 'Provider not configured' };
      }
      
      // Just verify the format is correct
      const isValidClientId = config.clientId.length > 10;
      const isValidSecret = config.clientSecret.length > 10;
      
      if (!isValidClientId || !isValidSecret) {
        return { success: false, error: 'Invalid client ID or secret format' };
      }
      
      return { success: true };
    }),
  
  // Toggle OAuth provider enabled status (admin only)
  toggleOAuthProvider: protectedProcedure
    .input(z.object({
      provider: z.enum(['google', 'github', 'microsoft']),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      
      // Update using upsert - get existing config first
      const existing = await db.getOAuthProviderConfig(input.provider);
      if (existing) {
        await db.upsertOAuthProviderConfig({
          oauthProvider: input.provider as any,
          clientId: existing.clientId,
          clientSecret: existing.clientSecret,
          isEnabled: input.enabled,
        });
      }
      return { success: true };
    }),
});
