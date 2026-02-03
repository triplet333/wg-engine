export const SystemAudioGroups = {
    MASTER: 'MASTER',
    BGM: 'BGM',
    SE: 'SE'
} as const;

export type AudioGroup = typeof SystemAudioGroups[keyof typeof SystemAudioGroups] | (string & {});

export class AudioManager {
    private context: AudioContext;
    private masterGain: GainNode;
    private groups: Map<string, GainNode> = new Map();

    constructor() {
        // Cross-browser support (though modern browsers are mostly AudioContext)
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.context = new AudioContextClass();

        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);

        // Register MASTER as a group for unified access
        this.groups.set(SystemAudioGroups.MASTER, this.masterGain);

        // Create default groups
        this.createGroup(SystemAudioGroups.BGM);
        this.createGroup(SystemAudioGroups.SE);
    }

    public getContext(): AudioContext {
        return this.context;
    }

    /**
     * Resume AudioContext if suspended (requires user interaction)
     */
    public async resume(): Promise<void> {
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    /**
     * Create a new volume group (e.g. "Voice", "Ambience")
     */
    public createGroup(name: AudioGroup): GainNode {
        if (this.groups.has(name)) {
            return this.groups.get(name)!;
        }
        const gain = this.context.createGain();
        gain.connect(this.masterGain);
        this.groups.set(name, gain);
        return gain;
    }

    public getGroup(name: AudioGroup): GainNode | undefined {
        return this.groups.get(name);
    }

    public setMasterVolume(value: number) {
        this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    }

    public setGroupVolume(name: AudioGroup, value: number) {
        const group = this.groups.get(name);
        if (group) {
            group.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
        }
    }

    /**
     * Play a one-shot sound immediately (fire and forget)
     */
    public playOneShot(buffer: AudioBuffer, groupName: AudioGroup = SystemAudioGroups.SE, volume: number = 1.0) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const group = this.groups.get(groupName) || this.masterGain;

        // Local volume for this shot
        const gain = this.context.createGain();
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(group);

        source.start(0);
    }
}
