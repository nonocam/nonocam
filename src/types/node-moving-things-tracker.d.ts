declare module 'node-moving-things-tracker/tracker' {
    export interface Detection {
        name?: string,
        /** Bounding Box Center X in Pixel */
        x: number,
        /** Bounding Box Center Y in Pixel */
        y: number,
        /** Bounding Box Width in Pixel */
        w: number,
        /** Bounding Box Height in Pixel */
        h: number,
        counted?: boolean,
        /** Detection Confidence */
        confidence: number,
    }

    declare function updateTrackedItemsWithNewFrame(detectionsOfThisFrame: Detection[], frameNb: number): void;
    declare function getJSONOfTrackedItems(roundInt: boolean): any;
  }