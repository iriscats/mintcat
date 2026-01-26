import { StorageAPI } from "@/storage";

export class DialogGameService {
    public async getAllGames() {
        const gameDAO = await StorageAPI.getGames();
        return await gameDAO.getAllGames();
    }

    public async setGameActive(selectedGameId: number): Promise<void> {
        const gameDAO = await StorageAPI.getGames();
        const gamesList = await gameDAO.getAllGames();

        for (const game of gamesList) {
            const shouldBeActive = game.id === selectedGameId;
            if (game.isActive !== shouldBeActive) {
                await gameDAO.setGameActive(game.id!, shouldBeActive);
            }
        }
    }

    public async updateGameInstallPath(gameId: number, path: string): Promise<void> {
        const gameDAO = await StorageAPI.getGames();
        await gameDAO.updateGame(gameId, { installPath: path });
    }
}
