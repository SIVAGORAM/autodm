export const PASSWORD_POLICY_MESSAGE = 'Use 8–128 characters with an uppercase letter, a number, and a symbol.';

export function passwordRequirements(password: string) {
  return [
    { label: '8–128 characters', met: password.length >= 8 && password.length <= 128 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function meetsPasswordPolicy(password: string) {
  return passwordRequirements(password).every((requirement) => requirement.met);
}
