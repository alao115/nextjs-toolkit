import { RedisStore } from "connect-redis";
import * as session from "express-session";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";

export async function registerExpressSession(
	app: INestApplication,
	config: ConfigService,
) {
	const redisClient = createClient({
		url: config.get<string>("redis.url"),
	});
	await redisClient.connect();

	app.use(
		session({
			store: new RedisStore({ client: redisClient }),
			secret: config.get<string>("auth.cookie.secret"),
			resave: false,
			saveUninitialized: false,
			cookie: {
				httpOnly: true,
				secure: config.get<boolean>("auth.cookie.secure"),
				sameSite: config.get("auth.cookie.sameSite"),
				domain: config.get<string>("auth.cookie.domain"),
			},
		}),
	);
}
