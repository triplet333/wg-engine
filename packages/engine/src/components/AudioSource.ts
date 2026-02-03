import { Component } from '../ecs/Component';
import { AudioGroup } from '../core/AudioManager';

export class AudioSource extends Component {
    public clip: string | AudioBuffer | null = null;
    public volume: number = 1.0;
    public loop: boolean = false;
    public playbackRate: number = 1.0;
    public playOnAwake: boolean = true;
    public audioGroup: AudioGroup | null = null; // null = use asset default

    // Runtime state
    public isPlaying: boolean = false;

    // Internal usage by System
    public _dirty: boolean = true; // To trigger update
    public _stopRequested: boolean = false;

    constructor(clip: string | AudioBuffer | null = null, options?: Partial<AudioSource>) {
        super();
        this.clip = clip;
        if (options) {
            Object.assign(this, options);
        }
    }

    public play() {
        this.isPlaying = true;
        this._stopRequested = false;
        this._dirty = true;
    }

    public stop() {
        this.isPlaying = false;
        this._stopRequested = true;
        this._dirty = true;
    }
}
