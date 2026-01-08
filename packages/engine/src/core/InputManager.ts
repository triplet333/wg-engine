export class InputManager {
    private keys: Map<string, boolean> = new Map();
    private mouseButtons: Map<number, boolean> = new Map();
    private mousePosition: { x: number, y: number } = { x: 0, y: 0 };

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e) => this.onKeyDown(e));
            window.addEventListener('keyup', (e) => this.onKeyUp(e));
            window.addEventListener('mousedown', (e) => this.onMouseDown(e));
            window.addEventListener('mouseup', (e) => this.onMouseUp(e));
            window.addEventListener('mousemove', (e) => this.onMouseMove(e));
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

    public isKeyDown(key: string): boolean {
        return this.keys.get(key) || false;
    }

    public isMouseButtonDown(button: number): boolean {
        return this.mouseButtons.get(button) || false;
    }

    public getMousePosition(): { x: number, y: number } {
        return { ...this.mousePosition };
    }
}
