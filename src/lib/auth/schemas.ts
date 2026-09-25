import { z } from 'zod'

// Password rules the UI enforces — the issuer (better-auth) is being aligned to
// match these, so keep them in sync: min 8 + lower/upper/digit/special.
const passwordField = z
  .string()
  .min(1, 'auth.validation.passwordRequired')
  .min(8, 'auth.validation.passwordMinLength')
  .max(256, 'auth.validation.passwordMaxLength')
  .regex(/[a-z]/, 'auth.validation.passwordLowercase')
  .regex(/[A-Z]/, 'auth.validation.passwordUppercase')
  .regex(/[0-9]/, 'auth.validation.passwordDigit')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'auth.validation.passwordSpecial')

const emailField = z
  .string()
  .min(1, 'auth.validation.emailRequired')
  .email('auth.validation.emailInvalid')

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
})

export type LoginFormData = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'auth.validation.passwordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.validation.passwordsMustMatch',
    path: ['confirmPassword'],
  })

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'auth.validation.passwordRequired'),
  newPassword: passwordField,
})

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

// One-time code from an authenticator app or email (2FA — UI only for now).
export const twoFactorSchema = z.object({
  code: z
    .string()
    .min(1, 'auth.validation.codeRequired')
    .regex(/^\d{6}$/, 'auth.validation.codeInvalid'),
})

export type TwoFactorFormData = z.infer<typeof twoFactorSchema>
