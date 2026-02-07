import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { AudioSource } from '../components/AudioSource';
import { AudioManager, SystemAudioGroups } from '../core/AudioManager';
import { AudioStore } from '../core/stores/AudioStore';

interface AudioNodeData {
    sourceNode: AudioBufferSourceNode | null;
    gainNode: GainNode | null;
    currentClip: string | AudioBuffer | null;
}

export class AudioSystem extends System {
    private world!: IWorld;
    private audioManager: AudioManager;
    private audioStore: AudioStore;

    // Map Entity ID to active audio nodes
    private activeSources: Map<number, AudioNodeData> = new Map();

    constructor(audioManager: AudioManager, audioStore: AudioStore) {
        super();
        this.audioManager = audioManager;
        this.audioStore = audioStore;

        // Attempt unlock on init (though usually needs event)
        // Ideally Game loop handles interaction event to call audioManager.resume()
    }

    public init(world: IWorld): void {
        this.world = world;
    }

    public update(_dt: number): void {
        const entities = this.world.query(AudioSource);

        for (const entity of entities) {
            const audioSource = this.world.getComponent(entity, AudioSource)!;

            // Cleanup check: If component removed? (ECS Query handles existence, but if component removed we need OnRemove hook ideally)
            // For now assuming query only returns active.

            let data = this.activeSources.get(entity);
            if (!data) {
                data = { sourceNode: null, gainNode: null, currentClip: null };
                this.activeSources.set(entity, data);
            }

            // Handle Stop Request
            if (audioSource._stopRequested) {
                this.stopSound(data);
                audioSource._stopRequested = false;
                continue;
            }

            // Play Logic
            if (audioSource.isPlaying) {
                // If not playing, start it
                if (!data.sourceNode) {
                    this.playSound(entity, audioSource, data);
                } else {
                    // Update Parameters realtime
                    if (data.gainNode) {
                        data.gainNode.gain.setTargetAtTime(audioSource.volume, this.audioManager.getContext().currentTime, 0.1);
                    }
                    if (data.sourceNode) {
                        data.sourceNode.playbackRate.setValueAtTime(audioSource.playbackRate, this.audioManager.getContext().currentTime);
                        data.sourceNode.loop = audioSource.loop;
                    }
                }
            } else {
                // Not playing, ensure stopped
                if (data.sourceNode) {
                    this.stopSound(data);
                }
            }
        }
    }

    private async playSound(_entityId: number, component: AudioSource, data: AudioNodeData) {
        const ctx = this.audioManager.getContext();

        let buffer: AudioBuffer | undefined;
        let targetGroupName = component.audioGroup; // Default to component override if set

        // Resolve Asset (Buffer + Group)
        if (typeof component.clip === 'string') {
            const key = component.clip;
            const asset = this.audioStore.get(key);

            if (asset) {
                buffer = asset.buffer;
                // If component doesn't explicitly override group (defaults to 'SE' or null?), 
                // we should probably use asset default.
                // But AudioSource initializes audioGroup to 'SE' by default in current code. 
                // We should change AudioSource default to null/undefined to allow fallback.
                // OR we check if component.audioGroup is 'SE' (default) and asset has something else?
                // Let's assume if component.audioGroup is set, it wins.
                // But wait, the user wants "Group is auto" from load.
                // So AudioSource should probably default to NO group, so we pick from asset.
                if (!targetGroupName || targetGroupName === SystemAudioGroups.SE) { // Assuming 'SE' is the hardcoded default we want to override
                    targetGroupName = asset.defaultGroup;
                }
            } else {
                // Not loaded or loading
                if (!this.audioStore.isLoading(key)) {
                    // We can't auto-load easily without URL. 
                    // Key-based system assumes preload.
                    console.warn(`Audio key not found: ${key}`);
                    component.isPlaying = false;
                    return;
                } else {
                    return; // Wait for load
                }
            }
        } else if (component.clip instanceof AudioBuffer) {
            buffer = component.clip;
        }

        if (!buffer) return;

        // Re-check playing state
        if (!component.isPlaying) return;

        // Create Nodes
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = component.loop;
        source.playbackRate.value = component.playbackRate;

        const gain = ctx.createGain();
        gain.gain.value = component.volume;

        // Connect
        const group = this.audioManager.getGroup(targetGroupName || SystemAudioGroups.SE) || this.audioManager.getGroup(SystemAudioGroups.SE)!;
        source.connect(gain);
        gain.connect(group);

        source.start(0);

        // Helper to track ended
        source.onended = () => {
            if (!component.loop) {
                component.isPlaying = false;
                this.stopSound(data);
            }
        };

        data.sourceNode = source;
        data.gainNode = gain;
        data.currentClip = component.clip;
    }

    private stopSound(data: AudioNodeData) {
        if (data.sourceNode) {
            try {
                data.sourceNode.stop();
            } catch (e) {
                // ignore if already stopped
            }
            data.sourceNode.disconnect();
            data.sourceNode = null;
        }
        if (data.gainNode) {
            data.gainNode.disconnect();
            data.gainNode = null;
        }
    }
}
