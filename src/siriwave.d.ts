declare module 'siriwave' {
    export default class SiriWave {
        constructor(options: {
            container: HTMLElement;
            style?: 'ios' | 'ios9';
            ratio?: number;
            speed?: number;
            amplitude?: number;
            frequency?: number;
            color?: string;
            cover?: boolean;
            width?: number;
            height?: number;
            autostart?: boolean;
            pixelDepth?: number;
            lerpSpeed?: number;
            curveDefinition?: any[];
            ranges?: any[];
            globalCompositeOperation?: string;
        });
        start(): void;
        stop(): void;
        setSpeed(value: number): void;
        setAmplitude(value: number): void;
        dispose(): void;

        // Add other properties/methods if needed
        amplitude: number;
        speed: number;
    }
}
