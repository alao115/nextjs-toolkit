export interface KmsManager {
	generateDataKey(
		keyId: string,
	): Promise<{ plainTextKey: Buffer; encryptedKeyBlob: string }>;
	decryptDataKey(encryptedBlob: string): Promise<Buffer>;
}
