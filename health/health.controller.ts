import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthHttpController {
	constructor(private readonly healthService: HealthService) {}

	@Get()
	async health() {
		return this.healthService.checkAll();
	}

	@Get("ready")
	async readiness() {
		return this.healthService.readiness();
	}

	@Get("live")
	async liveness() {
		return this.healthService.liveness();
	}
}
