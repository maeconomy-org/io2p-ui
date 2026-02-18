import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'auth.validation.emailRequired')
    .email('auth.validation.emailInvalid'),
  password: z
    .string()
    .min(1, 'auth.validation.passwordRequired')
    .min(8, 'auth.validation.passwordMinLength')
    .regex(/[a-z]/, 'auth.validation.passwordLowercase')
    .regex(/[A-Z]/, 'auth.validation.passwordUppercase')
    .regex(/[0-9]/, 'auth.validation.passwordDigit')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'auth.validation.passwordSpecial'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'auth.validation.emailRequired')
    .email('auth.validation.emailInvalid'),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
