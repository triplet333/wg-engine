// Entity import removed
// We use a constructor signature to identify component types
export type ComponentConstructor<T = any> = new (...args: any[]) => T;

/**
 * Base class for all Components.
 * Components are data containers and should not contain game logic.
 */
export abstract class Component {
}
