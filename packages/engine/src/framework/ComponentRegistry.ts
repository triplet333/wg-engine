import { ComponentConstructor } from '../ecs/Component';

export class ComponentRegistry {
    private static instance: ComponentRegistry;
    private map = new Map<string, ComponentConstructor>();

    private constructor() { }

    public static getInstance(): ComponentRegistry {
        if (!ComponentRegistry.instance) {
            ComponentRegistry.instance = new ComponentRegistry();
        }
        return ComponentRegistry.instance;
    }

    public register(name: string, ctor: ComponentConstructor): void {
        this.map.set(name, ctor);
    }

    public get(name: string): ComponentConstructor | undefined {
        return this.map.get(name);
    }

    public has(name: string): boolean {
        return this.map.has(name);
    }
}
