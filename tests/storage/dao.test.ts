import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { GameDAO, GameData } from '../../src/storage/dao/GameDAO';
import { UserDAO, UserData } from '../../src/storage/dao/UserDAO';
import { OAuthDAO, OAuthData } from '../../src/storage/dao/OAuthDAO';
import { ModDAO, ModData, CompleteModData } from '../../src/storage/dao/ModDAO';
import { ProfileDAO, ProfileData, ProfileTreeData } from '../../src/storage/dao/ProfileDAO';
import { TestDatabaseInitializer } from './TestDatabaseInitializer';

/**
 * DAO层单元测试套件
 * 测试所有DAO层的基本CRUD操作和业务逻辑
 */

describe('DAO层测试套件', () => {
    
    beforeAll(async () => {
        // 初始化测试数据库
        await TestDatabaseInitializer.initializeDatabase();
    });
    
    afterAll(async () => {
        // 清理测试数据库
        await TestDatabaseInitializer.resetDatabase();
    });
    
    beforeEach(async () => {
        // 每个测试前重置数据库状态
        await TestDatabaseInitializer.resetDatabase();
        await TestDatabaseInitializer.initializeDatabase();
    });
    
    describe('GameDAO 测试', () => {
        
        const testGameData: Omit<GameData, 'id' | 'createdAt' | 'updatedAt'> = {
            name: 'test_game',
            displayName: 'Test Game',
            installPath: '/test/game/path',
            version: '1.0.0',
            isActive: true
        };
        
        it('应该能够创建游戏', async () => {
            const createdGame = await GameDAO.createGame(testGameData);
            
            expect(createdGame).toBeDefined();
            expect(createdGame!.name).toBe(testGameData.name);
            expect(createdGame!.displayName).toBe(testGameData.displayName);
            expect(createdGame!.installPath).toBe(testGameData.installPath);
            expect(createdGame!.version).toBe(testGameData.version);
            expect(createdGame!.isActive).toBe(testGameData.isActive);
            expect(createdGame!.id).toBeDefined();
        });
        
        it('应该能够根据ID获取游戏', async () => {
            const createdGame = await GameDAO.createGame(testGameData);
            const retrievedGame = await GameDAO.getGameById(createdGame!.id!);
            
            expect(retrievedGame).toBeDefined();
            expect(retrievedGame!.id).toBe(createdGame!.id);
            expect(retrievedGame!.name).toBe(testGameData.name);
        });
        
        it('应该能够根据名称获取游戏', async () => {
            await GameDAO.createGame(testGameData);
            const retrievedGame = await GameDAO.getGameByName(testGameData.name);
            
            expect(retrievedGame).toBeDefined();
            expect(retrievedGame!.name).toBe(testGameData.name);
        });
        
        it('应该能够获取所有游戏', async () => {
            await GameDAO.createGame(testGameData);
            const allGames = await GameDAO.getAllGames();
            
            expect(allGames.length).toBeGreaterThan(0);
            // 应该包含默认游戏和测试游戏
            const testGame = allGames.find(g => g.name === testGameData.name);
            expect(testGame).toBeDefined();
        });
        
        it('应该能够获取活跃游戏', async () => {
            await GameDAO.createGame(testGameData);
            await GameDAO.createGame({ ...testGameData, name: 'inactive_game', isActive: false });
            
            const activeGames = await GameDAO.getActiveGames();
            const hasInactiveGame = activeGames.some(g => g.name === 'inactive_game');
            
            expect(hasInactiveGame).toBe(false);
            expect(activeGames.every(g => g.isActive)).toBe(true);
        });
        
        it('应该能够更新游戏信息', async () => {
            const createdGame = await GameDAO.createGame(testGameData);
            const updateData = {
                displayName: 'Updated Test Game',
                version: '2.0.0'
            };
            
            const updateResult = await GameDAO.updateGame(createdGame!.id!, updateData);
            expect(updateResult).toBe(true);
            
            const updatedGame = await GameDAO.getGameById(createdGame!.id!);
            expect(updatedGame!.displayName).toBe(updateData.displayName);
            expect(updatedGame!.version).toBe(updateData.version);
            expect(updatedGame!.name).toBe(testGameData.name); // 未更新的字段应保持不变
        });
        
        it('应该能够删除游戏', async () => {
            const createdGame = await GameDAO.createGame(testGameData);
            const deleteResult = await GameDAO.deleteGame(createdGame!.id!);
            
            expect(deleteResult).toBe(true);
            
            const deletedGame = await GameDAO.getGameById(createdGame!.id!);
            expect(deletedGame).toBe(null);
        });
        
        it('应该能够设置游戏激活状态', async () => {
            const createdGame = await GameDAO.createGame(testGameData);
            
            const result = await GameDAO.setGameActive(createdGame!.id!, false);
            expect(result).toBe(true);
            
            const updatedGame = await GameDAO.getGameById(createdGame!.id!);
            expect(updatedGame!.isActive).toBe(false);
        });
        
        it('应该能够检查游戏名称是否存在', async () => {
            await GameDAO.createGame(testGameData);
            
            const exists = await GameDAO.isGameNameExists(testGameData.name);
            expect(exists).toBe(true);
            
            const notExists = await GameDAO.isGameNameExists('non_existent_game');
            expect(notExists).toBe(false);
        });
        
        it('应该能够获取游戏统计信息', async () => {
            await GameDAO.createGame(testGameData);
            const stats = await GameDAO.getGameStats();
            
            expect(stats).toBeDefined();
            expect(stats.total).toBeGreaterThan(0);
            expect(stats.active).toBeGreaterThan(0);
            expect(typeof stats.total).toBe('number');
            expect(typeof stats.active).toBe('number');
        });
    });
    
    describe('UserDAO 测试', () => {
        
        const testUserData: Omit<UserData, 'id' | 'createdAt' | 'updatedAt'> = {
            username: 'test_user',
            email: 'test@example.com',
            avatarUrl: 'https://example.com/avatar.jpg'
        };
        
        it('应该能够创建用户', async () => {
            const createdUser = await UserDAO.createUser(testUserData);
            
            expect(createdUser).toBeDefined();
            expect(createdUser!.username).toBe(testUserData.username);
            expect(createdUser!.email).toBe(testUserData.email);
            expect(createdUser!.avatarUrl).toBe(testUserData.avatarUrl);
            expect(createdUser!.id).toBeDefined();
        });
        
        it('应该能够根据ID获取用户', async () => {
            const createdUser = await UserDAO.createUser(testUserData);
            const retrievedUser = await UserDAO.getUserById(createdUser!.id!);
            
            expect(retrievedUser).toBeDefined();
            expect(retrievedUser!.id).toBe(createdUser!.id);
            expect(retrievedUser!.username).toBe(testUserData.username);
        });
        
        it('应该能够根据用户名获取用户', async () => {
            await UserDAO.createUser(testUserData);
            const retrievedUser = await UserDAO.getUserByUsername(testUserData.username);
            
            expect(retrievedUser).toBeDefined();
            expect(retrievedUser!.username).toBe(testUserData.username);
        });
        
        it('应该能够根据邮箱获取用户', async () => {
            await UserDAO.createUser(testUserData);
            const retrievedUser = await UserDAO.getUserByEmail(testUserData.email!);
            
            expect(retrievedUser).toBeDefined();
            expect(retrievedUser!.email).toBe(testUserData.email);
        });
        
        it('应该能够搜索用户', async () => {
            await UserDAO.createUser(testUserData);
            const searchResults = await UserDAO.searchUsers('test');
            
            expect(searchResults.length).toBeGreaterThan(0);
            const foundUser = searchResults.find(u => u.username === testUserData.username);
            expect(foundUser).toBeDefined();
        });
        
        it('应该能够更新用户信息', async () => {
            const createdUser = await UserDAO.createUser(testUserData);
            const updateData = {
                email: 'updated@example.com',
                avatarUrl: 'https://example.com/new_avatar.jpg'
            };
            
            const updateResult = await UserDAO.updateUser(createdUser!.id!, updateData);
            expect(updateResult).toBe(true);
            
            const updatedUser = await UserDAO.getUserById(createdUser!.id!);
            expect(updatedUser!.email).toBe(updateData.email);
            expect(updatedUser!.avatarUrl).toBe(updateData.avatarUrl);
            expect(updatedUser!.username).toBe(testUserData.username); // 未更新的字段应保持不变
        });
        
        it('应该能够删除用户', async () => {
            const createdUser = await UserDAO.createUser(testUserData);
            const deleteResult = await UserDAO.deleteUser(createdUser!.id!);
            
            expect(deleteResult).toBe(true);
            
            const deletedUser = await UserDAO.getUserById(createdUser!.id!);
            expect(deletedUser).toBe(null);
        });
        
        it('应该能够检查用户名是否存在', async () => {
            await UserDAO.createUser(testUserData);
            
            const exists = await UserDAO.isUsernameExists(testUserData.username);
            expect(exists).toBe(true);
            
            const notExists = await UserDAO.isUsernameExists('non_existent_user');
            expect(notExists).toBe(false);
        });
        
        it('应该能够检查邮箱是否存在', async () => {
            await UserDAO.createUser(testUserData);
            
            const exists = await UserDAO.isEmailExists(testUserData.email!);
            expect(exists).toBe(true);
            
            const notExists = await UserDAO.isEmailExists('non_existent@example.com');
            expect(notExists).toBe(false);
        });
        
        it('应该能够获取默认用户', async () => {
            const defaultUser = await UserDAO.getDefaultUser();
            
            expect(defaultUser).toBeDefined();
            expect(defaultUser!.id).toBe(1);
            expect(defaultUser!.username).toBe('default_user');
        });
    });
    
    describe('OAuthDAO 测试', () => {
        
        const testOAuthData: Omit<OAuthData, 'id' | 'createdAt' | 'updatedAt'> = {
            uid: 12345,
            oauth: 'test_oauth_token_123456789',
            platform: 'mod.io'
        };
        
        it('应该能够创建OAuth记录', async () => {
            const createdOAuth = await OAuthDAO.createOAuth(testOAuthData);
            
            expect(createdOAuth).toBeDefined();
            expect(createdOAuth!.uid).toBe(testOAuthData.uid);
            expect(createdOAuth!.oauth).toBe(testOAuthData.oauth);
            expect(createdOAuth!.platform).toBe(testOAuthData.platform);
            expect(createdOAuth!.id).toBeDefined();
        });
        
        it('应该能够根据UID获取OAuth记录', async () => {
            const createdOAuth = await OAuthDAO.createOAuth(testOAuthData);
            const retrievedOAuth = await OAuthDAO.getOAuthByUid(testOAuthData.uid);
            
            expect(retrievedOAuth).toBeDefined();
            expect(retrievedOAuth!.uid).toBe(testOAuthData.uid);
        });
        
        it('应该能够根据平台获取OAuth记录', async () => {
            await OAuthDAO.createOAuth(testOAuthData);
            const platformOAuths = await OAuthDAO.getOAuthsByPlatform(testOAuthData.platform);
            
            expect(platformOAuths.length).toBeGreaterThan(0);
            const foundOAuth = platformOAuths.find(o => o.uid === testOAuthData.uid);
            expect(foundOAuth).toBeDefined();
        });
        
        it('应该能够根据UID和平台获取OAuth记录', async () => {
            await OAuthDAO.createOAuth(testOAuthData);
            const retrievedOAuth = await OAuthDAO.getOAuthByUidAndPlatform(
                testOAuthData.uid,
                testOAuthData.platform
            );
            
            expect(retrievedOAuth).toBeDefined();
            expect(retrievedOAuth!.uid).toBe(testOAuthData.uid);
            expect(retrievedOAuth!.platform).toBe(testOAuthData.platform);
        });
        
        it('应该能够更新或创建OAuth记录（Upsert）', async () => {
            // 第一次调用应该创建记录
            const firstResult = await OAuthDAO.upsertOAuth(
                testOAuthData.uid,
                testOAuthData.platform,
                testOAuthData.oauth
            );
            
            expect(firstResult).toBeDefined();
            expect(firstResult!.oauth).toBe(testOAuthData.oauth);
            
            // 第二次调用应该更新记录
            const newOAuth = 'updated_oauth_token_987654321';
            const secondResult = await OAuthDAO.upsertOAuth(
                testOAuthData.uid,
                testOAuthData.platform,
                newOAuth
            );
            
            expect(secondResult).toBeDefined();
            expect(secondResult!.oauth).toBe(newOAuth);
            expect(secondResult!.id).toBe(firstResult!.id); // 应该是同一条记录
        });
        
        it('应该能够删除OAuth记录', async () => {
            const createdOAuth = await OAuthDAO.createOAuth(testOAuthData);
            const deleteResult = await OAuthDAO.deleteOAuth(createdOAuth!.id!);
            
            expect(deleteResult).toBe(true);
            
            const deletedOAuth = await OAuthDAO.getOAuthById(createdOAuth!.id!);
            expect(deletedOAuth).toBe(null);
        });
        
        it('应该能够验证OAuth令牌', async () => {
            const validToken = 'valid_token_123';
            const invalidToken = '';
            
            const isValidToken = await OAuthDAO.isOAuthValid(validToken);
            const isInvalidToken = await OAuthDAO.isOAuthValid(invalidToken);
            
            expect(isValidToken).toBe(true);
            expect(isInvalidToken).toBe(false);
        });
        
        it('应该能够设置mod.io OAuth令牌', async () => {
            const uid = 12345;
            const oauth = 'modio_oauth_token';
            
            const result = await OAuthDAO.setModioOAuth(uid, oauth);
            
            expect(result).toBeDefined();
            expect(result!.platform).toBe('mod.io');
            expect(result!.oauth).toBe(oauth);
            expect(result!.uid).toBe(uid);
        });
        
        it('应该能够获取OAuth统计信息', async () => {
            await OAuthDAO.createOAuth(testOAuthData);
            await OAuthDAO.createOAuth({
                ...testOAuthData,
                uid: 67890,
                platform: 'steam'
            });
            
            const stats = await OAuthDAO.getOAuthStats();
            
            expect(stats).toBeDefined();
            expect(stats.total).toBeGreaterThanOrEqual(2);
            expect(stats.byPlatform['mod.io']).toBeGreaterThanOrEqual(1);
            expect(stats.byPlatform['steam']).toBeGreaterThanOrEqual(1);
        });
    });
    
    describe('ModDAO 测试', () => {
        let testGameId: number;
        
        beforeEach(async () => {
            // 为模组测试创建一个测试游戏
            const testGame = await GameDAO.createGame({
                name: 'test_game_for_mods',
                displayName: 'Test Game for Mods',
                installPath: '/test/path',
                version: '1.0.0',
                isActive: true
            });
            testGameId = testGame!.id!;
        });
        
        const testModData: Omit<ModData, 'modId' | 'createdAt' | 'updatedAt'> = {
            platformId: 12345,
            gameId: 0, // 将在beforeEach中设置
            nameId: 'test_mod',
            displayName: 'Test Mod',
            url: 'https://mod.io/mods/test_mod',
            sourceType: 'Modio',
            tags: ['test', 'example'],
            approvalStatus: 'Approved',
            dependModId: 0
        };
        
        it('应该能够创建模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            expect(createdMod).toBeDefined();
            expect(createdMod!.displayName).toBe(testModData.displayName);
            expect(createdMod!.gameId).toBe(testGameId);
            expect(createdMod!.tags).toEqual(testModData.tags);
            expect(createdMod!.modId).toBeDefined();
        });
        
        it('应该能够根据ID获取模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            const retrievedMod = await ModDAO.getModById(createdMod!.modId!);
            
            expect(retrievedMod).toBeDefined();
            expect(retrievedMod!.modId).toBe(createdMod!.modId);
            expect(retrievedMod!.displayName).toBe(testModData.displayName);
        });
        
        it('应该能够根据平台ID获取模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            await ModDAO.createMod(modDataWithGame);
            const retrievedMod = await ModDAO.getModByPlatformId(testModData.platformId);
            
            expect(retrievedMod).toBeDefined();
            expect(retrievedMod!.platformId).toBe(testModData.platformId);
        });
        
        it('应该能够根据游戏ID获取模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            await ModDAO.createMod(modDataWithGame);
            const gameMods = await ModDAO.getModsByGameId(testGameId);
            
            expect(gameMods.length).toBeGreaterThan(0);
            const foundMod = gameMods.find(m => m.displayName === testModData.displayName);
            expect(foundMod).toBeDefined();
        });
        
        it('应该能够搜索模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            await ModDAO.createMod(modDataWithGame);
            
            const searchResults = await ModDAO.searchMods('test', testGameId);
            expect(searchResults.length).toBeGreaterThan(0);
            
            const foundMod = searchResults.find(m => m.displayName === testModData.displayName);
            expect(foundMod).toBeDefined();
        });
        
        it('应该能够更新模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            const updateData = {
                displayName: 'Updated Test Mod',
                approvalStatus: 'Verified'
            };
            
            const updateResult = await ModDAO.updateMod(createdMod!.modId!, updateData);
            expect(updateResult).toBe(true);
            
            const updatedMod = await ModDAO.getModById(createdMod!.modId!);
            expect(updatedMod!.displayName).toBe(updateData.displayName);
            expect(updatedMod!.approvalStatus).toBe(updateData.approvalStatus);
        });
        
        it('应该能够删除模组', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            const deleteResult = await ModDAO.deleteMod(createdMod!.modId!);
            expect(deleteResult).toBe(true);
            
            const deletedMod = await ModDAO.getModById(createdMod!.modId!);
            expect(deletedMod).toBe(null);
        });
        
        it('应该能够创建和获取模组版本信息', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            const versionData = {
                modId: createdMod!.modId!,
                currentVersion: '1.2.3',
                availableVersions: ['1.0.0', '1.1.0', '1.2.3']
            };
            
            const upsertResult = await ModDAO.upsertModVersion(versionData);
            expect(upsertResult).toBe(true);
            
            const retrievedVersion = await ModDAO.getModVersion(createdMod!.modId!);
            expect(retrievedVersion).toBeDefined();
            expect(retrievedVersion!.currentVersion).toBe(versionData.currentVersion);
            expect(retrievedVersion!.availableVersions).toEqual(versionData.availableVersions);
        });
        
        it('应该能够创建和获取模组下载信息', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            const downloadData = {
                modId: createdMod!.modId!,
                downloadUrl: 'https://example.com/mod.zip',
                cachePath: '/cache/mod.zip',
                fileSize: 1024000,
                downloadProgress: 75,
                downloadStatus: 'downloading'
            };
            
            const upsertResult = await ModDAO.upsertModDownload(downloadData);
            expect(upsertResult).toBe(true);
            
            const retrievedDownload = await ModDAO.getModDownload(createdMod!.modId!);
            expect(retrievedDownload).toBeDefined();
            expect(retrievedDownload!.downloadUrl).toBe(downloadData.downloadUrl);
            expect(retrievedDownload!.downloadProgress).toBe(downloadData.downloadProgress);
            expect(retrievedDownload!.downloadStatus).toBe(downloadData.downloadStatus);
        });
        
        it('应该能够更新下载进度', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            // 首先创建下载记录
            await ModDAO.upsertModDownload({
                modId: createdMod!.modId!,
                downloadProgress: 0,
                downloadStatus: 'pending'
            });
            
            // 更新进度
            const updateResult = await ModDAO.updateDownloadProgress(
                createdMod!.modId!, 
                50, 
                'downloading'
            );
            expect(updateResult).toBe(true);
            
            const updatedDownload = await ModDAO.getModDownload(createdMod!.modId!);
            expect(updatedDownload!.downloadProgress).toBe(50);
            expect(updatedDownload!.downloadStatus).toBe('downloading');
        });
        
        it('应该能够获取完整的模组数据', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            const createdMod = await ModDAO.createMod(modDataWithGame);
            
            // 添加版本、下载、状态信息
            await ModDAO.upsertModVersion({
                modId: createdMod!.modId!,
                currentVersion: '1.0.0',
                availableVersions: ['1.0.0']
            });
            
            await ModDAO.upsertModDownload({
                modId: createdMod!.modId!,
                downloadUrl: 'https://example.com/mod.zip',
                downloadStatus: 'completed'
            });
            
            await ModDAO.upsertModStatus({
                modId: createdMod!.modId!,
                isOnlineAvailable: true,
                isLocalNotFound: false
            });
            
            const completeModData = await ModDAO.getCompleteModData(createdMod!.modId!);
            
            expect(completeModData).toBeDefined();
            expect(completeModData!.modId).toBe(createdMod!.modId);
            expect(completeModData!.version).toBeDefined();
            expect(completeModData!.download).toBeDefined();
            expect(completeModData!.status).toBeDefined();
        });
        
        it('应该能够获取模组统计信息', async () => {
            const modDataWithGame = { ...testModData, gameId: testGameId };
            await ModDAO.createMod(modDataWithGame);
            
            const stats = await ModDAO.getModStats();
            
            expect(stats).toBeDefined();
            expect(stats.total).toBeGreaterThan(0);
            expect(stats.bySourceType).toBeDefined();
            expect(stats.byApprovalStatus).toBeDefined();
            expect(stats.byGame).toBeDefined();
            expect(stats.byGame[testGameId]).toBeGreaterThan(0);
        });
    });
});