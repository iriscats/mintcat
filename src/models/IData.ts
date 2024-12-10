function Singleton<T extends new (...args: any[]) => any>(constructor: T): T {
    let instance: InstanceType<T>;

    const newConstructor: any = function (...args: any[]) {
        if (!instance) {
            instance = new constructor(...args);
        }

        return instance;
    }

    newConstructor.prototype = constructor.prototype;

    return newConstructor;
}

export default Singleton;

