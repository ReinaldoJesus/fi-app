import { z } from "zod"

export const SignupSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
    email: z.string().email("Email inválido").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[0-9]/, "Debe contener al menos un número"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

export type SignupInput = z.infer<typeof SignupSchema>

export type FormState<T = Record<string, string[]>> = {
  errors?: T
  message?: string
} | undefined
