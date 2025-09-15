import initSqlJs, { Database, SqlJs } from 'sql.js';
import { drizzle } from "drizzle-orm/sql-js";
import fs from 'fs';
import path from 'path';

/**
 * 测试环境数据库客户端
 * 使用 sql.js 在内存中运行 SQLite 数据库进行测试
 */
class TestDatabaseClient {
    private static instance: TestDatabaseClient | null = null;
    private sql: SqlJs.SqlJsStatic | null = null;
    private database: Database | null = null;
    private drizzleDb: ReturnType<typeof drizzle> | null = null;

    private constructor() {}

    /**
     * 获取单例实例
     */
    public static getInstance(): TestDatabaseClient {
        if (!TestDatabaseClient.instance) {
            TestDatabaseClient.instance = new TestDatabaseClient();
        }
        return TestDatabaseClient.instance;
    }

    /**
     * 初始化 sql.js 和数据库
     */
    public async initialize(): Promise<void> {
        if (!this.sql) {
            // 初始化 sql.js
            this.sql = await initSqlJs({
                // 可以指定 wasm 文件路径，但通常使用默认的 CDN
                // locateFile: file => `https://sql.js.org/dist/${file}`
            });
        }

        // 创建新的内存数据库
        this.database = new this.sql.Database();
        
        // 创建 Drizzle ORM 实例
        this.drizzleDb = drizzle(this.database);
    }

    /**
     * 获取 Drizzle 数据库实例
     */
    public getDb(): ReturnType<typeof drizzle> {
        if (!this.drizzleDb) {
            throw new Error('数据库未初始化，请先调用 initialize()');
        }
        return this.drizzleDb;
    }

    /**
     * 获取原始 SQL.js 数据库实例
     */
    public getRawDb(): Database {
        if (!this.database) {
            throw new Error('数据库未初始化，请先调用 initialize()');
        }
        return this.database;
    }

    /**
     * 执行原始 SQL 语句
     */
    public exec(sql: string): void {
        if (!this.database) {
            throw new Error('数据库未初始化，请先调用 initialize()');
        }
        this.database.exec(sql);
    }

    /**
     * 重置数据库（清空所有数据）
     */
    public async reset(): Promise<void> {
        if (this.database) {
            this.database.close();
        }
        await this.initialize();
    }

    /**
     * 关闭数据库连接
     */
    public close(): void {
        if (this.database) {
            this.database.close();
            this.database = null;
            this.drizzleDb = null;
        }
    }

    /**
     * 导出数据库为 Uint8Array
     */
    public exportData(): Uint8Array {
        if (!this.database) {
            throw new Error('数据库未初始化，请先调用 initialize()');
        }
        return this.database.export();
    }

    /**
     * 从 Uint8Array 导入数据库
     */
    public async importData(data: Uint8Array): Promise<void> {
        if (!this.sql) {
            await this.initialize();
        }
        
        if (this.database) {
            this.database.close();
        }
        
        this.database = new this.sql!.Database(data);
        this.drizzleDb = drizzle(this.database);
    }

    /**
     * 保存数据库到文件（仅用于调试）
     */
    public saveToFile(filePath: string): void {
        const data = this.exportData();
        fs.writeFileSync(filePath, data);
    }

    /**
     * 从文件加载数据库（仅用于调试）
     */
    public async loadFromFile(filePath: string): Promise<void> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        
        const data = fs.readFileSync(filePath);
        await this.importData(new Uint8Array(data));
    }
}

// 导出单例实例
export const testDbClient = TestDatabaseClient.getInstance();

/**
 * 获取测试数据库实例的便捷函数
 */
export async function getTestDb(): Promise<ReturnType<typeof drizzle>> {
    if (!testDbClient.getDb) {
        await testDbClient.initialize();
    }
    return testDbClient.getDb();
}

/**
 * 重置测试数据库的便捷函数
 */
export async function resetTestDb(): Promise<void> {
    await testDbClient.reset();
}

export default testDbClient;