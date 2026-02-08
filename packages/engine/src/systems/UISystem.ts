import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { Entity } from '../ecs/Entity';
import { Button } from '../components/Button';
import { Transform } from '../components/Transform';
import { BoxCollider } from '../components/BoxCollider';
import { Camera, RectUnit } from '../components/Camera';
import { Renderable } from '../components/Renderable';
import { InputManager } from '../core/InputManager';
import { Layer } from '../components/Layer';

export class UISystem extends System {
    private input: InputManager;
    private canvas: HTMLCanvasElement;
    private world!: IWorld;

    private lastMouseDown: boolean = false;
    private lastMousePos: { x: number, y: number } = { x: 0, y: 0 };
    private lastKeyStates: Map<string, boolean> = new Map();

    private focusedEntity: Entity | null = null;

    constructor(input: InputManager, canvas: HTMLCanvasElement) {
        super();
        this.input = input;
        this.canvas = canvas;
    }

    public init(world: IWorld): void {
        this.world = world;
    }

    public update(_dt: number): void {
        if (!this.world) return;

        const mousePos = this.input.getMousePosition();
        const isMouseDown = this.input.isMouseButtonDown(0);
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        // 1. Get Cameras and Sort (Priority Desc - Top to Bottom for raycast)
        // We want the TOPMOST camera to catch the input first.
        // Priority: Higher = Top.
        const cameras = this.world.query(Camera).map(e => ({
            entity: e,
            camera: this.world.getComponent(e, Camera)!,
            transform: this.world.getComponent(e, Transform)
        })).sort((a, b) => b.camera.priority - a.camera.priority);

        let hitButton: Entity | null = null;

        // Mouse Hit Logic
        for (const camObj of cameras) {
            const { camera, transform } = camObj;
            if (!transform) continue;

            // Calc Dest Rect (Screen)
            const destRect = this.calcRect(camera.rect, canvasW, canvasH);

            // Check if mouse is within this camera's Viewport
            if (mousePos.x >= destRect.x && mousePos.x < destRect.x + destRect.w &&
                mousePos.y >= destRect.y && mousePos.y < destRect.y + destRect.h) {

                // Transform to World/UI Space
                // Ratio in Rect (0..1)
                const rx = (mousePos.x - destRect.x) / destRect.w;
                const ry = (mousePos.y - destRect.y) / destRect.h;

                // Source Size (World Size)
                let worldW = destRect.w / camera.zoom;
                let worldH = destRect.h / camera.zoom;

                if (camera.viewport) {
                    const refW = canvasW; // Assuming ref is canvas for viewport calc if ratio
                    const refH = canvasH;
                    const src = this.calcRect(camera.viewport, refW, refH);
                    worldW = src.w;
                    worldH = src.h;
                }

                // World Mouse Pos
                // Camera Transform is TOP-LEFT of View (consistent with quad.wgsl logic)
                // quad.wgsl: clipX = (viewPos.x / width) * 2 - 1. 
                // If viewPos.x = 0, clipX = -1 (Left). 
                // viewPos = world - camPos. So world=camPos -> Left.
                const viewLeft = transform.x;
                const viewTop = transform.y;

                const mouseWorldX = viewLeft + rx * worldW;
                const mouseWorldY = viewTop + ry * worldH;

                // Check Buttons in this Camera's Layers
                // Optimization: Pre-filter buttons? No, loop all buttons for now.
                const buttons = this.world.query(Button);

                let localHit: Entity | null = null;
                // Reverse loop? Top entities usuall rendered last?
                // Render order depends on Texture batching/Entity ID currently.
                // Better to have Z-order... Layer + ID.
                // For now, first hit is fine or check them all?
                // UI usually: Topmost element.
                // We'll iterate and assume simple layout overlap isn't critical or last-one-wins.

                for (const btnEntity of buttons) {
                    // Layer Check
                    const layer = this.world.getComponent(btnEntity, Layer);
                    const layerName = layer ? layer.name : 'Default';
                    if (!camera.layers.includes(layerName)) continue;

                    const btnTrans = this.world.getComponent(btnEntity, Transform);
                    if (!btnTrans) continue;

                    let btnW = 50;
                    let btnH = 50;
                    const collider = this.world.getComponent(btnEntity, BoxCollider);
                    if (collider) {
                        btnW = collider.width;
                        btnH = collider.height;
                    }
                    // Apply Scale? Yes.
                    // btnW *= btnTrans.scale[0]; // BoxCollider usually pre-scaled? 
                    // PhysicsSystem uses w/h as raw size. 
                    // Let's rely on BoxCollider raw size * Scale.
                    const finalW = btnW * btnTrans.scale[0];
                    const finalH = btnH * btnTrans.scale[1];

                    // AABB Check (Pivot TopLeft)
                    if (mouseWorldX >= btnTrans.x && mouseWorldX < btnTrans.x + finalW &&
                        mouseWorldY >= btnTrans.y && mouseWorldY < btnTrans.y + finalH) {
                        localHit = btnEntity;
                        // Break if we assume no overlapping buttons?
                        // Or if we want Z-sort?
                        // Let's break for efficiency.
                        break;
                    }
                }

                if (localHit) {
                    hitButton = localHit;
                    break; // Handled by this camera
                }
            }
        }

        // Keyboard Navigation
        // Detect Key Press (Edge Trigger)
        const isUp = this.input.isKeyDown('ArrowUp');
        const isDown = this.input.isKeyDown('ArrowDown');
        const isLeft = this.input.isKeyDown('ArrowLeft');
        const isRight = this.input.isKeyDown('ArrowRight');
        const isEnter = this.input.isKeyDown('Enter') || this.input.isKeyDown(' ');

        const justPressed = (key: string, current: boolean) => {
            const last = this.lastKeyStates.get(key) || false;
            return current && !last;
        };

        const allButtons = this.world.query(Button);

        // Auto-focus if none and keys pressed
        if (!this.focusedEntity && (isUp || isDown || isLeft || isRight) && allButtons.length > 0) {
            this.focusedEntity = allButtons[0];
        }

        // Mouse Movement Check
        const mouseMoved = (mousePos.x !== this.lastMousePos.x || mousePos.y !== this.lastMousePos.y);

        // Update Focus (Mouse Priority)
        if (mouseMoved || isMouseDown) {
            this.focusedEntity = hitButton;
        }

        // Navigation Logic
        if (this.focusedEntity) {
            const currentBtn = this.world.getComponent(this.focusedEntity, Button);

            if (currentBtn) {
                if (justPressed('ArrowUp', isUp) && currentBtn.up !== null) {
                    this.focusedEntity = currentBtn.up as unknown as Entity;
                }
                if (justPressed('ArrowDown', isDown) && currentBtn.down !== null) {
                    this.focusedEntity = currentBtn.down as unknown as Entity;
                }
            } else {
                // If focused entity lost its button component or is invalid, clear focus
                this.focusedEntity = null;
            }
        }

        // Update States
        const buttons = allButtons; // Reuse query result
        for (const entity of buttons) {
            const button = this.world.getComponent(entity, Button)!;
            if (!button) {
                console.warn(`UISystem: Button component missing for entity ${entity} despite being in query!`);
                continue;
            }

            // Logic:
            // If Disabled, skip interact.
            if (button.state === 'disabled') continue;

            let newState: 'normal' | 'hover' | 'pressed' = 'normal';

            // Single Source of Truth: focusedEntity
            if (entity === this.focusedEntity) {
                newState = 'hover';

                // Check Press State
                const isMousePress = (isMouseDown && entity === hitButton);
                const isKeyPress = isEnter;

                if (isMousePress || isKeyPress) {
                    newState = 'pressed';
                }

                // Click Release Check (Inline)
                // Mouse Release
                if ((entity === hitButton) && this.lastMouseDown && !isMouseDown) {
                    if (button.onClick) button.onClick();
                }

                // Key Press (Edge Trigger)
                if (justPressed('Enter', isEnter)) {
                    if (button.onClick) button.onClick();
                }
            }



            // Apply State
            button.state = newState;

            // Visual Update (Helper)
            // If colors are set, update Renderable
            const renderable = this.world.getComponent(entity, Renderable);
            if (renderable) {
                let targetColor = button.normalColor;
                if (button.state === 'hover') targetColor = button.hoverColor;
                if (button.state === 'pressed') targetColor = button.pressedColor;

                if (targetColor) {
                    renderable.color = [...targetColor];
                }
            }
        }

        this.lastMouseDown = isMouseDown;
        this.lastMousePos = { ...mousePos };
        this.lastKeyStates.set('ArrowUp', isUp);
        this.lastKeyStates.set('ArrowDown', isDown);
        this.lastKeyStates.set('ArrowLeft', isLeft);
        this.lastKeyStates.set('ArrowRight', isRight);
        this.lastKeyStates.set('Enter', isEnter);
    }

    private calcRect(r: { x: number, y: number, w: number, h: number, unit: RectUnit }, refW: number, refH: number) {
        if (r.unit === 'ratio') {
            return {
                x: Math.floor(r.x * refW),
                y: Math.floor(r.y * refH),
                w: Math.floor(r.w * refW),
                h: Math.floor(r.h * refH)
            };
        } else {
            return { x: r.x, y: r.y, w: r.w, h: r.h };
        }
    }
}
