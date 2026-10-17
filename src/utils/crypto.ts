import { DecryptedQrPayload } from '../types/omr';

const PREFIX = 'MCORR:v1:';
// 100k PBKDF2 iterations with random 8-character passwords (~46 bits of entropy) is a deliberate
// fit for classroom use. Changing this parameter requires introducing a new MCORR:v2 prefix so
// already-printed answer sheets continue to work.
const PBKDF2_ITERATIONS = 100000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex inválido');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  return globalThis.crypto as Crypto;
};

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const cryptoObj = getCrypto();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Criptografa o gabarito oficial com a senha do professor usando AES-256-GCM.
 * Retorna uma string segura para ser codificada no QR Code.
 */
export async function encryptAnswerKey(
  payload: DecryptedQrPayload,
  password: string
): Promise<string> {
  const enc = new TextEncoder();
  const compact: Record<string, unknown> = {
    e: payload.examId,
    v: payload.version,
    k: payload.key,
    p: payload.points,
    t: payload.totalQuestions,
    s: payload.subjectiveQuestions,
    sp: payload.subjectivePoints,
    f: payload.examFingerprint,
  };
  const plaintext = enc.encode(JSON.stringify(compact));

  const cryptoObj = getCrypto();
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt);
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    plaintext as unknown as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  return `${PREFIX}${bytesToHex(salt)}:${bytesToHex(iv)}:${bytesToHex(ciphertext)}`;
}

/**
 * Descriptografa a string lida do QR Code usando a senha do professor.
 * Lança erro se a senha estiver incorreta ou os dados tiverem sido corrompidos.
 */
export async function decryptAnswerKey(
  qrString: string,
  password: string
): Promise<DecryptedQrPayload> {
  if (!qrString.startsWith(PREFIX)) {
    throw new Error('QR Code não reconhecido como gabarito protegido.');
  }

  const parts = qrString.substring(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Formato do QR Code criptografado inválido.');
  }

  const [saltHex, ivHex, ciphertextHex] = parts;
  const salt = hexToBytes(saltHex);
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ciphertextHex);

  const key = await deriveKey(password, salt);
  const cryptoObj = getCrypto();

  try {
    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      ciphertext as unknown as BufferSource
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (parsed && ('k' in parsed || 'v' in parsed)) {
      return {
        examId: (parsed.e as string) || (parsed.examId as string) || '',
        version: (parsed.v as string) || (parsed.version as string) || '',
        key: ((parsed.k || parsed.key) as Record<number, string>) || {},
        points: (parsed.p || parsed.points) as Record<number, number> | undefined,
        totalQuestions: (parsed.t || parsed.totalQuestions) as number | undefined,
        subjectiveQuestions: (parsed.s || parsed.subjectiveQuestions) as number[] | undefined,
        subjectivePoints: (parsed.sp || parsed.subjectivePoints) as Record<number, number> | undefined,
        examFingerprint: (parsed.f as string) || (parsed.examFingerprint as string) || undefined,
      };
    }

    return parsed as unknown as DecryptedQrPayload;
  } catch {
    throw new Error('Senha incorreta ou gabarito inválido.');
  }
}

/**
 * Alfabeto sem caracteres ambíguos (exclui 0, O, 1, I, l, o).
 */
export const UNAMBIGUOUS_PASSWORD_ALPHABET =
  '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

/**
 * Gera senha aleatória de 8 caracteres a partir de alfabeto sem ambiguidades
 * usando crypto.getRandomValues().
 */
export function generateExamPassword(length = 8): string {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += UNAMBIGUOUS_PASSWORD_ALPHABET[bytes[i] % UNAMBIGUOUS_PASSWORD_ALPHABET.length];
  }
  return res;
}

/**
 * Calcula o hash SHA-256 de um buffer ou string e retorna em hexadecimal minúsculo.
 */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const cryptoObj = getCrypto();
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export interface DecryptCandidatesResult {
  payload: DecryptedQrPayload;
  passwordUsed: string;
  attemptIndex: number;
}

/**
 * Tenta descriptografar um QR Code iterando sobre uma lista ordenada de senhas candidatas.
 * A ordem deve priorizar a prova ativa, seguida pelas demais provas do perfil (até maxAttempts, padrão 30).
 */
export async function decryptWithCandidatePasswords(
  qrString: string,
  passwords: string[],
  maxAttempts = 30
): Promise<DecryptCandidatesResult> {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const p of passwords) {
    const trimmed = p ? p.trim() : '';
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      candidates.push(trimmed);
      if (candidates.length >= maxAttempts) break;
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const pwd = candidates[i];
    try {
      const payload = await decryptAnswerKey(qrString, pwd);
      return { payload, passwordUsed: pwd, attemptIndex: i };
    } catch {
      // Tenta a próxima senha
    }
  }

  throw new Error('Não consegui abrir este QR com as senhas das provas deste perfil.');
}

