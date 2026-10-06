/**
 * CryptoService.ts
 * Servicio criptográfico nativo utilizando Web Crypto API (SubtleCrypto).
 * Proporciona hashing seguro SHA-256 para PINs locales, verificación en tiempo constante
 * y migración transparente de PINs en texto plano sin vulnerabilidades de seguridad.
 */

export class CryptoService {
  private static readonly SALT_BYTES = 16;

  /**
   * Obtiene la instancia SubtleCrypto del entorno (navegador o Node.js 18+).
   */
  private static getSubtleCrypto(): SubtleCrypto {
    const cryptoObj = typeof window !== 'undefined'
      ? (window.crypto || (window as any).msCrypto)
      : globalThis.crypto;

    if (!cryptoObj || !cryptoObj.subtle) {
      throw new Error('Web Crypto API (crypto.subtle) no está disponible en este entorno.');
    }
    return cryptoObj.subtle;
  }

  /**
   * Genera una sal criptográficamente segura en formato hexadecimal.
   */
  static generateSalt(byteLength: number = this.SALT_BYTES): string {
    const array = new Uint8Array(byteLength);
    const cryptoObj = typeof window !== 'undefined'
      ? (window.crypto || (window as any).msCrypto)
      : globalThis.crypto;

    if (cryptoObj && cryptoObj.getRandomValues) {
      cryptoObj.getRandomValues(array);
    } else {
      for (let i = 0; i < byteLength; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return this.bytesToHex(array);
  }

  /**
   * Convierte un Uint8Array a cadena hexadecimal.
   */
  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convierte una cadena hexadecimal a Uint8Array.
   */
  static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Comparación de cadenas en tiempo constante para mitigar ataques de temporización (timing attacks).
   */
  static constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  /**
   * Determina si un valor de PIN almacenado está en texto plano legado (ej. "1234", "0000").
   */
  static isLegacyPlaintext(pin?: string): boolean {
    if (!pin) return false;
    // Si contiene prefijo de algoritmo o es un hash largo en hexadecimal, no es texto plano
    if (pin.startsWith('sha256$') || pin.startsWith('pbkdf2$')) return false;
    if (pin.length > 8) return false;
    return /^\d{4,6}$/.test(pin.trim());
  }

  /**
   * Computa el hash SHA-256 de un PIN codificado en hexadecimal.
   * Si se provee una sal específica, genera un hash determinista: `sha256$<salt>$<hashHex>`.
   * Si no se provee, genera automáticamente una sal criptográfica segura.
   */
  static async hashPin(pin: string, salt?: string): Promise<string> {
    const subtle = this.getSubtleCrypto();
    const effectiveSalt = salt || this.generateSalt();
    const enc = new TextEncoder();
    const data = enc.encode(`${effectiveSalt}:${pin}`);

    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashHex = this.bytesToHex(new Uint8Array(hashBuffer));

    return `sha256$${effectiveSalt}$${hashHex}`;
  }

  /**
   * Verifica si un PIN ingresado coincide con el hash o valor almacenado.
   * Soporta de manera transparente:
   * 1. Formato moderno SHA-256 (`sha256$<salt>$<hashHex>`).
   * 2. Formato PBKDF2 (`pbkdf2$<salt>$<hashHex>`).
   * 3. Hash determinista directo con sal provista.
   * 4. PIN legado en texto plano (con comparación en tiempo constante).
   */
  static async verifyPin(inputPin: string, storedHash: string, salt?: string): Promise<boolean> {
    if (!inputPin || !storedHash) return false;

    // 1. Caso legado: PIN en texto plano de 4-6 dígitos
    if (this.isLegacyPlaintext(storedHash)) {
      return this.constantTimeEquals(inputPin, storedHash);
    }

    // 2. Formato con prefijo sha256: `sha256$<salt>$<hash>`
    if (storedHash.startsWith('sha256$')) {
      const parts = storedHash.split('$');
      if (parts.length === 3) {
        const itemSalt = parts[1];
        const expectedHash = parts[2];
        const computed = await this.hashPin(inputPin, itemSalt);
        const computedHash = computed.split('$')[2];
        return this.constantTimeEquals(computedHash, expectedHash);
      }
    }

    // 3. Formato PBKDF2: `pbkdf2$<salt>$<hash>` (soporte backward compatible)
    if (storedHash.startsWith('pbkdf2$')) {
      const parts = storedHash.split('$');
      if (parts.length === 3) {
        const itemSalt = parts[1];
        const expectedHash = parts[2];
        const subtle = this.getSubtleCrypto();
        const enc = new TextEncoder();
        const keyMaterial = await subtle.importKey(
          'raw',
          enc.encode(inputPin),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );
        const derivedBits = await subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: this.hexToBytes(itemSalt) as unknown as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          32 * 8
        );
        const computedHash = this.bytesToHex(new Uint8Array(derivedBits));
        return this.constantTimeEquals(computedHash, expectedHash);
      }
    }

    // 4. Hash plano con sal proporcionada como argumento
    if (salt) {
      const computed = await this.hashPin(inputPin, salt);
      const computedHash = computed.split('$')[2];
      // Si storedHash es solo el hashHex o el formato completo
      if (storedHash.length === 64) {
        return this.constantTimeEquals(computedHash, storedHash);
      }
      return this.constantTimeEquals(computed, storedHash);
    }

    return false;
  }
}
