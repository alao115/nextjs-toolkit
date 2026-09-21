import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { HealthService, HealthStatus } from "./health.service";

/**
 * Health endpoints, mounted by {@link HealthModule.forRoot}.
 *
 * The HTTP status code reflects the check outcome: `200` when every indicator
 * is up, `503` otherwise. Orchestrators (Kubernetes `livenessProbe` /
 * `readinessProbe`, load balancers, most uptime monitors) key on the status
 * code and ignore the body, so returning 200 for a failing check would leave
 * a broken instance in the load balancer indefinitely.
 *
 * The full {@link HealthStatus} payload is preserved either way — on failure
 * it travels as the thrown exception's response body, which
 * `HttpExceptionFilter` surfaces under `details`.
 */
@Controller("health")
export class HealthHttpController {
	constructor(private readonly healthService: HealthService) {}

	/** Fails with 503 unless every indicator reports up. */
	@Get()
	async health(): Promise<HealthStatus> {
		return this.assertHealthy(await this.healthService.checkAll());
	}

	/**
	 * Fails with 503 while the instance is draining, or when any indicator is
	 * down. Point `readinessProbe` here.
	 */
	@Get("ready")
	async readiness(): Promise<HealthStatus> {
		return this.assertHealthy(await this.healthService.readiness());
	}

	/**
	 * Cheap "the process is alive" check — no external dependencies, so a
	 * database blip removes the pod from the load balancer (via readiness)
	 * instead of getting it restarted. Point `livenessProbe` here.
	 */
	@Get("live")
	async liveness(): Promise<HealthStatus> {
		return this.assertHealthy(await this.healthService.liveness());
	}

	private assertHealthy(result: HealthStatus): HealthStatus {
		if (result.status !== "ok") {
			throw new ServiceUnavailableException(result);
		}
		return result;
	}
}
