export interface InputBinding {
    keys?: string[];
    mouseButtons?: number[];
    touch?: boolean; // If true, any touch triggers this action
}

export class InputManager {
    private keys: Map<string, boolean> = new Map();
    private mouseButtons: Map<number, boolean> = new Map();
    private mousePosition: { x: number, y: number } = { x: 0, y: 0 };

    private bindings: Map<string, InputBinding> = new Map();
    private touches: Set<number> = new Set(); // Track active touch IDs

    constructor(target?: EventTarget) {
        const element = target || (typeof window !== 'undefined' ? window : null);

        if (element) {
            // TypeScript cast mainly for Window vs HTMLElement differences with events
            // EventTarget has addEventListener so it's fine.
            element.addEventListener('keydown', (e) => this.onKeyDown(e as KeyboardEvent));
            element.addEventListener('keyup', (e) => this.onKeyUp(e as KeyboardEvent));
            element.addEventListener('mousedown', (e) => this.onMouseDown(e as MouseEvent));
            element.addEventListener('mouseup', (e) => this.onMouseUp(e as MouseEvent));
            element.addEventListener('mousemove', (e) => this.onMouseMove(e as MouseEvent));

            // Touch Events
            element.addEventListener('touchstart', (e) => this.onTouchStart(e as TouchEvent), { passive: false });
            element.addEventListener('touchend', (e) => this.onTouchEnd(e as TouchEvent));
            element.addEventListener('touchcancel', (e) => this.onTouchEnd(e as TouchEvent));
            // window.addEventListener('touchmove', ...); // Not needed for simple tap yet
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        this.keys.set(e.key, true);
    }

    private onKeyUp(e: KeyboardEvent): void {
        this.keys.set(e.key, false);
    }

    private onMouseDown(e: MouseEvent): void {
        this.mouseButtons.set(e.button, true);
    }

    private onMouseUp(e: MouseEvent): void {
        this.mouseButtons.set(e.button, false);
    }

    private onMouseMove(e: MouseEvent): void {
        this.mousePosition = { x: e.clientX, y: e.clientY };
    }

    private onTouchStart(e: TouchEvent): void {
        // e.preventDefault(); // Prevent scrolling/zooming if needed, but might block other UI
        for (let i = 0; i < e.changedTouches.length; i++) {
            this.touches.add(e.changedTouches[i].identifier);
        }
    }

    private onTouchEnd(e: TouchEvent): void {
        for (let i = 0; i < e.changedTouches.length; i++) {
            this.touches.delete(e.changedTouches[i].identifier);
        }
    }

    public isKeyDown(key: string): boolean {
        return this.keys.get(key) || false;
    }

    public isMouseButtonDown(button: number): boolean {
        return this.mouseButtons.get(button) || false;
    }

    public getMousePosition(): { x: number, y: number } {
        return { ...this.mousePosition };
    }

    // --- Input Action System ---

    public bindAction(action: string, binding: InputBinding) {
        this.bindings.set(action, binding);
    }

    public isActionPressed(action: string): boolean {
        const binding = this.bindings.get(action);
        if (!binding) return false;

        // Check Keys
        if (binding.keys) {
            for (const key of binding.keys) {
                if (this.isKeyDown(key)) return true;
            }
        }

        // Check Mouse Buttons
        if (binding.mouseButtons) {
            for (const btn of binding.mouseButtons) {
                if (this.isMouseButtonDown(btn)) return true;
            }
        }

        // Check Touch
        if (binding.touch) {
            if (this.touches.size > 0) return true;
        }

        return false;
    }
}
