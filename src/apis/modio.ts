
const MODIO_API_URL = "https://api.themoviedb.org/3/";

class Modio {

    public constructor() {
    }

    public async getModByName(nameId: string): Promise<void> {
        //https://mod.io/g/drg/m/10iron-will-recharge-10-minutes
        //v1/games?_q=Gravity Bounce


    }


    private async getModById(modId: string): Promise<void> {

        await fetch(MODIO_API_URL + "games?_q=" + modId);

    }

}