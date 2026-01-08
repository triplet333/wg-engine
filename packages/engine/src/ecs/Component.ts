// Entity import removed
// We use a constructor signature to identify component types
export type ComponentConstructor<T = any> = new (...args: any[]) => T;

export abstract class Component {
    // Abstract base class/interface for components
}
