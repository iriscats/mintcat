// 定义自动 bind 的装饰器
export function autoBind(
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>
) {
    const originalMethod = descriptor.value;

    return {
        configurable: true,
        get() {
            // 将方法绑定到实例
            const bound = originalMethod.bind(this);
            // 定义到实例上避免重复绑定
            Object.defineProperty(this, _propertyKey, {
                value: bound,
                configurable: true,
                writable: true
            });
            return bound;
        }
    } as TypedPropertyDescriptor<any>;
}