import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { SecretValue } from "./secret-manager.interface";

export interface SecretRotationEvent {
	key: string;
	previousVersion?: string;
	newVersion: string;
	rotatedAt: string;
	value: SecretValue;
}

/**
 * Pub/sub for secret rotations. Code that caches a secret (signing keys,
 * API tokens, etc.) should subscribe to invalidate its cache when the
 * underlying value changes.
 *
 * Backed by Node's {@link EventEmitter} — single-process. For multi-instance
 * rotation propagation, fan out through a separate transport
 * (Redis pubsub, RabbitMQ) and call `emit()` on every receiver.
 */
@Injectable()
export class SecretRotationEmitter {
	private readonly emitter = new EventEmitter();
	private readonly lastVersionByKey = new Map<string, string>();

	emit(event: SecretRotationEvent): void {
		this.lastVersionByKey.set(event.key, event.newVersion);
		this.emitter.emit("rotation", event);
		this.emitter.emit(`rotation:${event.key}`, event);
	}

	/** Subscribe to all rotations. */
	onRotation(handler: (event: SecretRotationEvent) => void): () => void {
		this.emitter.on("rotation", handler);
		return () => this.emitter.off("rotation", handler);
	}

	/** Subscribe to rotations of a specific key. */
	onRotationOf(
		key: string,
		handler: (event: SecretRotationEvent) => void,
	): () => void {
		this.emitter.on(`rotation:${key}`, handler);
		return () => this.emitter.off(`rotation:${key}`, handler);
	}

	getLastVersion(key: string): string | undefined {
		return this.lastVersionByKey.get(key);
	}
}
