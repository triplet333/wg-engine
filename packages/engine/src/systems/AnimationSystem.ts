import { System } from '../ecs/System';
import { IWorld } from '../ecs/types';
import { Animation } from '../components/Animation';
import { Sprite } from '../components/Sprite';
import { SpriteSheet } from '../components/SpriteSheet';
import { SpriteSheetAnimation } from '../core/AnimationTypes';

export class AnimationSystem extends System {
    private world!: IWorld;

    constructor() {
        super();
        this.priority = 100; // Before rendering
    }

    public init(world: IWorld): void {
        this.world = world;
    }

    public update(dt: number): void {
        const entities = this.world.query(Animation);

        for (const entity of entities) {
            const anim = this.world.getComponent(entity, Animation);
            if (!anim || !anim.isPlaying || !anim.currentClip) continue;

            const clip = anim.currentClip;

            // Update time
            anim.currentTime += dt * anim.speed;

            // Handle Logic based on type
            if (clip.type === 'sprite-sheet') {
                this.updateSpriteSheetAnimation(entity, anim, clip as SpriteSheetAnimation);
            }
        }
    }

    private updateSpriteSheetAnimation(entity: number, anim: Animation, clip: SpriteSheetAnimation): void {
        const sprite = this.world.getComponent(entity, Sprite);
        const sheet = this.world.getComponent(entity, SpriteSheet);

        if (!sprite || !sheet) return;

        // Calculate total frames duration
        const totalFrames = clip.frames.length;
        if (totalFrames === 0) return;

        const frameDuration = 1.0 / clip.frameRate;
        const totalDuration = totalFrames * frameDuration;

        // Loop Logic
        if (anim.currentTime >= totalDuration) {
            if (clip.loop) {
                anim.currentTime %= totalDuration;
            } else {
                anim.currentTime = totalDuration - 0.001; // Clamp to end
                anim.isPlaying = false; // Stop?
            }
        }

        // Determine current frame index in the sequence
        const currentFrameIndex = Math.floor(anim.currentTime / frameDuration);
        const clampedIndex = Math.max(0, Math.min(currentFrameIndex, totalFrames - 1));

        // Get the actual grid frame index from the animation definition
        const gridFrame = clip.frames[clampedIndex];

        // Apply using helper
        sheet.setFrame(sprite, gridFrame);
    }
}
