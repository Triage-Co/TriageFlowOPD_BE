import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg"
import envInstance from "./env.config";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg"

@Injectable()
export class PrismaConfig extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly pool: Pool;

    constructor(configService: ConfigService) {
        const pool = new Pool({
            connectionString: envInstance.DATABASE_URL || configService.get<string>("DATABASE_URL"),
            max: 30,
            connectionTimeoutMillis: 5000,

        })
        const adapter = new PrismaPg(pool);
        super({ adapter })
        this.pool = pool;
    }
    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
    async onModuleInit() {
        await this.$connect()
    }
}