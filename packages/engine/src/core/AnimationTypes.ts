export type AnimationType = 'sprite-sheet' | 'sequence' | 'property';

export interface AnimationClip {
    name: string;
    type: AnimationType;
    duration: number; // Total duration in seconds (optional/calculated)
    loop: boolean;
}

export interface SpriteSheetKeyFrame {
    index: number; // Index in the global frames array of SpriteSheet? Or frame index in grid?
    // Let's assume simpler: SpriteSheet animation is often just "play frames 0 to N at speed X"
    // So maybe we define a range or list of frames.
}

export interface SpriteSheetAnimation extends AnimationClip {
    type: 'sprite-sheet';
    frames: number[]; // Sequence of frame indices to play
    frameRate: number; // Frames per second
}
