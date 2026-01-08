export interface RequestPasswordResetDto {
  cpf: string
}

export interface ConfirmPasswordResetDto {
  cpf: string
  code: string
  newPassword: string
}
