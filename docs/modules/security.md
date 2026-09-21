# `security`

```ts
import {
  hashPassword, verifyPassword, randomToken, hashToken,
  encryptWithDataKey, decryptWithDataKey, packEncrypted, unpackEncrypted,
  type EncryptedPayload, type KmsManager,
} from "@alaska115/nextjs-toolkit/security";
```

Stateless crypto helpers. No module, no DI — import the function you need.

## Passwords

```ts
const hash = await hashPassword(plaintext);          // argon2id
const ok   = await verifyPassword(hash, plaintext);  // note the argument order
```

`hashPassword` uses Argon2id with the `argon2` library's defaults. Requires the
optional `argon2` peer dependency (a native module — make sure your build image
can compile it, or use a prebuilt base image).

> `verifyPassword(hash, password)` takes the **hash first**. Swapping the
> arguments fails every login rather than throwing, so get it right at the call
> site.

Always compare against the stored hash; never log either argument.

## Tokens

```ts
const token = randomToken();        // 48 random bytes, base64url
const token = randomToken(32);      // custom size in bytes
const lookup = hashToken(token);    // SHA-256 hex
```

The pattern these support: send `token` to the user, store only
`hashToken(token)`. A database leak then yields no usable reset links or API
keys. Look records up by the hash.

SHA-256 is right here and wrong for passwords — these tokens already have full
entropy, so there is nothing to brute-force; a user-chosen password does not,
which is why it gets Argon2 instead.

## Envelope encryption

```ts
// 1. Ask your KMS for a data key
const { plainTextKey, encryptedKeyBlob } = await kms.generateDataKey(keyId);

// 2. Encrypt with the plaintext data key, store the blob + encryptedKeyBlob
const blob = encryptWithDataKey(Buffer.from(ssn, "utf8"), plainTextKey, keyId);

// 3. Later: decrypt the data key through the KMS, then the payload
const dataKey = await kms.decryptDataKey(encryptedKeyBlob);
const ssn = decryptWithDataKey(blob, dataKey).toString("utf8");
```

`encryptWithDataKey` uses **AES-256-GCM** with a random 12-byte IV and a
16-byte auth tag, and returns a packed string:

```
v1|<keyId>|<iv base64>|<ciphertext base64>|<tag base64>
```

`dataKey` must therefore be exactly **32 bytes**. `packEncrypted` /
`unpackEncrypted` convert between that string and the `EncryptedPayload` object,
so you can read `keyId` — and drive a key-rotation migration — without
decrypting anything.

`keyId` travels with the ciphertext, which is what makes rotation tractable:
re-encrypt lazily on read, and you can tell at a glance which rows still use the
old key.

## `KmsManager`

```ts
interface KmsManager {
  generateDataKey(keyId: string): Promise<{ plainTextKey: Buffer; encryptedKeyBlob: string }>;
  decryptDataKey(encryptedBlob: string): Promise<Buffer>;
}
```

An interface only — the package ships no implementation. Wrap AWS KMS, GCP KMS
or Vault Transit yourself, and never persist `plainTextKey`.
