export class TimeUtils {

    public static getCurrentTime(): number {
        return Math.floor(Date.now() / 1000);
    }

    public static getTimeSecond(date :number): number {
        return Math.floor(date / 1000);
    }

}

