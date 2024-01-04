import { randomBytes, createCipheriv, createHash, createDecipheriv } from 'crypto'

export function encrypt(text: string, password: string): string {
  const IV = Buffer.from(randomBytes(16))
  const encryptor = createCipheriv('aes-128-cbc', createHash('md5').update(password).digest(), IV)
  encryptor.setAutoPadding(true)
  encryptor.write(text)
  encryptor.end()
  return Buffer.concat([IV, encryptor.read()]).toString('base64')
}

export function decrypt(cipher: string, password: string): string | null {
  try {
    const un_base64 = Buffer.from(cipher, 'base64')
    const IV = un_base64.subarray(0, 16)
    const cipher_text = un_base64.subarray(16)
    const decrypter = createDecipheriv('aes-128-cbc', createHash('md5').update(password).digest(), IV)
    decrypter.on('error', () => {})
    decrypter.write(cipher_text)
    decrypter.end()
    return decrypter.read().toString('utf8')
  } catch {
    return null
  }
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest().toString('hex')
}

export const DEFAULT_PASSWORD = 'BqWmsNK6sHxY2PlKDuVOpshTBv3rVkIZ'
