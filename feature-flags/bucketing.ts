import { createHash } from "node:crypto";

/**
 * Deterministic % rollout bucketer. Returns true for `percent` percent of
 * (flag, subject) pairs, distributed uniformly. The same subject always lands
 * in the same bucket for the same flag, so a 10% rollout cleanly includes
 * a stable 10% of users.
 *
 * `percent` is 0–100 inclusive. `0` → never, `100` → always.
 */
export function isInRolloutBucket(
	flag: string,
	subject: string,
	percent: number,
): boolean {
	if (percent <= 0) return false;
	if (percent >= 100) return true;
	const digest = createHash("sha256")
		.update(`${flag}|${subject}`)
		.digest();
	// Take the first 4 bytes as a 32-bit unsigned int.
	const n = digest.readUInt32BE(0);
	// Compare against (percent/100) * 2^32. Using BigInt avoids float drift.
	const threshold = (BigInt(percent) * (1n << 32n)) / 100n;
	return BigInt(n) < threshold;
}
