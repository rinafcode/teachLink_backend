import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

const APP_NAME = 'TeachLink';

/**
 * Generates a new TOTP secret for a user.
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Returns the otpauth:// URI used to populate an authenticator app.
 */
export function getTotpUri(secret: string, email: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/**
 * Generates a QR code data URL from a TOTP URI.
 */
export async function generateQrCode(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

/**
 * Verifies a TOTP token against a secret.
 * Allows a ±1 step window to account for clock drift.
 */
export function verifyTotp(token: string, secret: string): boolean {
  authenticator.options = { window: 1 };
  return authenticator.verify({ token, secret });
}
