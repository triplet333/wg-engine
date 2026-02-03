import { Component } from '../ecs/Component';

export type ButtonState = 'normal' | 'hover' | 'pressed' | 'disabled';

export class Button extends Component {
    public state: ButtonState = 'normal';
    public onClick: (() => void) | null = null;

    // Navigation (Entity IDs)
    public up: number | null = null;
    public down: number | null = null;
    public left: number | null = null;
    public right: number | null = null;

    // Visual Config (Optional Helpers)
    public normalColor: [number, number, number, number] | null = null;
    public hoverColor: [number, number, number, number] | null = null;
    public pressedColor: [number, number, number, number] | null = null;

    constructor(onClick?: () => void) {
        super();
        this.onClick = onClick || null;
    }
}
