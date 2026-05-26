import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { LoggerService } from "../../../observability/logger/logger.service";
import { ShutdownManager } from "../../../shutdown/shutdown.manager";
import { AppPersistenceConfig, PRISMA_CLIENT, PRISMA_OPTIONS, PrismaModuleOptions } from '../../persistence.config';

export class PrismaClient {
  constructor(private readonly client: any) {}
	$queryRaw: any;
  $connect(): Promise<void> {
    return Promise.resolve();
  }
  $disconnect(): Promise<void> {
    return Promise.resolve();
  }
  $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return Promise.resolve(fn(this.client));
  }
  $on(event: string, cb: any): void {
    return;
  }
}


@Injectable()
export class PrismaService
  implements OnModuleInit, OnModuleDestroy
{
  private isInitialized = false;
  private client: PrismaClient;

  constructor(
    @Inject(PRISMA_OPTIONS)
    private readonly options: AppPersistenceConfig,
    private readonly logger: LoggerService,
    private readonly shutdownManager: ShutdownManager,
  ) { }

  get instance(): PrismaClient {
    return this.client;
  }

  get isDBClientInitialized(): boolean {
    return this.isInitialized;
  }

  async onModuleInit() {
    const adapter = this.options.driverFactory
      ? this.options.driverFactory(this.options.url)
      : (() => {
          const { PrismaPg } = require("@prisma/adapter-pg");
          return new PrismaPg({ connectionString: this.options.url });
        })();

    this.client = new (this.options.ormClient as any)({
      adapter,
    });

    await this.client.$connect();
    this.isInitialized = true;

    this.client.$on("query", (evt: { query: string; duration: number }) => {
      this.logger.info(
        `Prisma query: ${evt.query} (${evt.duration}ms)`,
        { context: "PrismaService" },
      );
    });

    this.shutdownManager.registerHook({
      name: "prisma-client",
      phase: "infra",
      order: 10,
      shutdown: async () => {
        await this.client.$disconnect();
      },
    });
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}