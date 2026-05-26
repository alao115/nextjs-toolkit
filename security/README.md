# `@alaska115/nextjs-toolkit/security`

Low-level cryptographic helpers. Three things live here:

- `crypto.util` — Argon2 password hashing helpers.
- `encryption.util` — AES-256-GCM encrypt/decrypt with a packed format.
- `kms-manager.interface` — `KmsManager` contract for KMS-backed data-key envelopes. Implement this for AWS KMS, GCP KMS, or Vault Transit.

## Hash a password

```ts
import { hashPassword, verifyPassword } from "@alaska115/nextjs-toolkit/security";

const hash = await hashPassword(plain);                // stored
const ok = await verifyPassword(plain, hash);          // login check
```

Uses Argon2id with sane defaults (`memoryCost: 19_456`, `timeCost: 2`, `parallelism: 1`). Tune for your hardware: the goal is ~500ms per hash on a single core. Faster than that and you're underpaying; slower and you're vulnerable to DoS through login attempts.

## Encrypt a small payload (AES-256-GCM)

```ts
import { encrypt, decrypt } from "@alaska115/nextjs-toolkit/security";

const dataKey = randomBytes(32); // 256-bit key
const ciphertext = encrypt("secret value", dataKey);
const plaintext = decrypt(ciphertext, dataKey);
```

`encrypt` returns a packed `"iv|ciphertext|authTag"` base64 string. Format is opinionated — the helper assumes you'll re-encrypt rather than negotiate algorithms.

## Envelope encryption with KMS

Implement `KmsManager` against your provider:

```ts
import { KmsManager } from "@alaska115/nextjs-toolkit/security";

class AwsKmsManager implements KmsManager {
  async generateDataKey(keyId: string) {
    const res = await kms.generateDataKey({ KeyId: keyId, KeySpec: "AES_256" });
    return {
      plainTextKey: Buffer.from(res.Plaintext!),
      encryptedKeyBlob: Buffer.from(res.CiphertextBlob!).toString("base64"),
    };
  }
  async decryptDataKey(blob: string) {
    const res = await kms.decrypt({ CiphertextBlob: Buffer.from(blob, "base64") });
    return Buffer.from(res.Plaintext!);
  }
}
```

The pattern: KMS gives you a fresh per-record data key, you AES-GCM-encrypt the payload with that key, store `encryptedKeyBlob + ciphertext`. To decrypt, ask KMS to unwrap the blob, then AES-GCM-decrypt. Plaintext keys never get persisted.

## Anti-patterns

- **Don't reuse encryption keys across records.** Use envelope encryption (data key per record); the KMS interface is the right abstraction.
- **Don't use the AES helper for streaming or large payloads.** It buffers everything in memory. For files, use `createCipheriv` directly.
- **Don't reduce Argon2 cost "for tests."** Tests should mock the hash entirely (use a fake `IPasswordHasher`), not weaken the real implementation.
- **Don't store the IV separately.** The packed format includes it for a reason — losing the IV makes the ciphertext unrecoverable.
