
export abstract class ILock {

    protected static lock: Promise<void> = Promise.resolve();

    protected static async acquireLock() {
        let release = () => {};
        const oldLock = this.lock;
        this.lock = new Promise(resolve => release = resolve);
        await oldLock;
        return release;
    }

}