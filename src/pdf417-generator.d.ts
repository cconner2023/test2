// src/pdf417-generator.d.ts
declare module 'pdf417-generator' {
    interface PDF417Options {
        bw?: number;        // Bar width (px)
        height?: number;    // Row height (px)
        padding?: number;   // Padding around barcode
        columns?: number;   // Number of data columns
        ecLevel?: number;   // Error correction level (0-8)
    }

    function PDF417(
        canvas: HTMLCanvasElement,
        text: string,
        options?: PDF417Options
    ): HTMLCanvasElement;

    export default PDF417;
}