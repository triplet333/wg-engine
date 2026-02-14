import { Component } from '../ecs/Component';
import { AnimationClip } from '../core/AnimationTypes';

export class Animation extends Component {
    public clips: Map<string, AnimationClip> = new Map();
    public currentClip: AnimationClip | null = null;
    public currentTime: number = 0;
    public isPlaying: boolean = false;
    public speed: number = 1.0;

    constructor() {
        super();
    }

    public addClip(clip: AnimationClip): void {
        this.clips.set(clip.name, clip);
    }

    // JSON Helper
    public set clipsData(data: Record<string, AnimationClip>) {
        for (const key in data) {
            this.addClip(data[key]);
        }
    }

    public play(name: string): void {
        const clip = this.clips.get(name);
        if (clip) {
            this.currentClip = clip;
            this.currentTime = 0;
            this.isPlaying = true;
        } else {
            console.warn(`Animation clip '${name}' not found.`);
        }
    }

    public stop(): void {
        this.isPlaying = false;
        this.currentTime = 0;
    }

    public pause(): void {
        this.isPlaying = false;
    }

    public resume(): void {
        if (this.currentClip) {
            this.isPlaying = true;
        }
    }
}
