export class TimeUtils {

    public static getCurrentTime(): number {
        return Math.floor(Date.now() / 1000);
    }

    public static getTimeSecond(date: number): number {
        return Math.floor(date / 1000);
    }

    public static formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }
}

