"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDatabaseService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let TestDatabaseService = class TestDatabaseService {
    constructor() {
        this.isTestDb = false;
    }
    async setup() {
        try {
            this.connection = (0, typeorm_1.getConnection)();
        }
        catch {
            this.connection = await (0, typeorm_1.createConnection)({
                type: 'postgres',
                host: process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.DATABASE_PORT || '5432'),
                username: process.env.DATABASE_USER || 'postgres',
                password: process.env.DATABASE_PASSWORD || 'password',
                database: process.env.DATABASE_NAME || 'teachlink_test',
                entities: ['src/**/*.entity{.ts,.js}'],
                synchronize: true,
                dropSchema: true,
                logging: false,
            });
            this.isTestDb = true;
        }
    }
    async teardown() {
        if (this.isTestDb && this.connection) {
            await this.connection.close();
        }
    }
    async clean() {
        if (this.connection && this.isTestDb) {
            const entities = this.connection.entityMetadatas;
            for (const entity of entities.reverse()) {
                const repository = this.connection.getRepository(entity.name);
                await repository.clear();
            }
        }
    }
    getConnection() {
        return this.connection;
    }
    async waitForConnection(maxAttempts = 10, delayMs = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.connection.query('SELECT 1');
                return;
            }
            catch (error) {
                if (attempt === maxAttempts) {
                    throw new Error(`Database connection failed after ${maxAttempts} attempts: ${error.message}`);
                }
                await this.delay(delayMs);
            }
        }
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.TestDatabaseService = TestDatabaseService;
exports.TestDatabaseService = TestDatabaseService = __decorate([
    (0, common_1.Injectable)()
], TestDatabaseService);
//# sourceMappingURL=test-database.service.js.map