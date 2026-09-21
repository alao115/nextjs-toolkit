import { isInRolloutBucket } from "./bucketing";

const subjects = Array.from({ length: 2000 }, (_, i) => `user-${i}`);
const share = (flag: string, percent: number) =>
	subjects.filter((s) => isInRolloutBucket(flag, s, percent)).length /
	subjects.length;

describe("isInRolloutBucket", () => {
	it("is never true at 0%", () => {
		expect(subjects.some((s) => isInRolloutBucket("f", s, 0))).toBe(false);
	});

	it("is always true at 100%", () => {
		expect(subjects.every((s) => isInRolloutBucket("f", s, 100))).toBe(true);
	});

	it("treats negative percentages as 0", () => {
		expect(isInRolloutBucket("f", "u1", -10)).toBe(false);
	});

	it("treats percentages above 100 as 100", () => {
		expect(isInRolloutBucket("f", "u1", 150)).toBe(true);
	});

	it("is deterministic — a user never flips on refresh", () => {
		const first = isInRolloutBucket("new-checkout", "user-7", 30);
		for (let i = 0; i < 50; i++) {
			expect(isInRolloutBucket("new-checkout", "user-7", 30)).toBe(first);
		}
	});

	it("distributes roughly uniformly", () => {
		// 2000 subjects: ±4 points is comfortable slack for a uniform hash.
		expect(share("checkout", 50)).toBeGreaterThan(0.46);
		expect(share("checkout", 50)).toBeLessThan(0.54);
		expect(share("checkout", 10)).toBeGreaterThan(0.06);
		expect(share("checkout", 10)).toBeLessThan(0.14);
	});

	// A 10% cohort must remain inside the 25% cohort, or users churn between
	// variants as you ramp.
	it("is monotonic in percent — ramping up never drops anyone", () => {
		for (const s of subjects.slice(0, 300)) {
			for (const [lower, higher] of [
				[5, 10],
				[10, 25],
				[25, 50],
				[50, 90],
			]) {
				if (isInRolloutBucket("ramp", s, lower)) {
					expect(isInRolloutBucket("ramp", s, higher)).toBe(true);
				}
			}
		}
	});

	it("reshuffles independently per flag, so unlucky users aren't unlucky everywhere", () => {
		const inA = subjects.filter((s) => isInRolloutBucket("flag-a", s, 20));
		const inB = subjects.filter((s) => isInRolloutBucket("flag-b", s, 20));
		const overlap = inA.filter((s) => inB.includes(s)).length;
		// Independent 20% cohorts overlap around 4% of the population, not 20%.
		expect(overlap / subjects.length).toBeLessThan(0.1);
	});

	it("gives different answers for different subjects at the same percent", () => {
		const results = new Set(subjects.map((s) => isInRolloutBucket("f", s, 50)));
		expect(results.size).toBe(2);
	});

	it("handles an empty subject without throwing", () => {
		expect(typeof isInRolloutBucket("f", "", 50)).toBe("boolean");
	});
});
