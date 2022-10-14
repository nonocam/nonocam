import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { Component, createRef, RefObject, useRef, useState } from 'react'
import styles from '../../styles/Home.module.css'
import Script from 'next/script'
import { updateTrackedItemsWithNewFrame, getJSONOfTrackedItems, Detection } from 'node-moving-things-tracker/tracker'

declare let cocoSsd: any;

function BoundingBox(props:any) {
  function videoDimensions(video: HTMLVideoElement) {
    // Ratio of the video's intrisic dimensions
    var videoRatio = video.videoWidth / video.videoHeight;
    // The width and height of the video element
    var width = video.offsetWidth, height = video.offsetHeight;
    // The ratio of the element's width to its height
    var elementRatio = width/height;
    // If the video element is short and wide
    if(elementRatio > videoRatio) width = height * videoRatio;
    // It must be tall and thin, or exactly equal to the original ratio
    else height = width / videoRatio;
    return {
      width: width,
      height: height
    };
  }

  const videoRef = props.videoRef as HTMLVideoElement;
  const trackedObject = props.trackedObject;

  const actualSize = videoDimensions(videoRef);

  let topOffset = 0;
  if(videoRef.clientHeight > actualSize.height) {
    topOffset = (videoRef.clientHeight - actualSize.height) / 2;
  }

  let leftOffset = 0;
  if(videoRef.clientWidth > actualSize.width) {
    leftOffset = (videoRef.clientWidth - actualSize.width) / 2;
  }

  const s = {
    top: topOffset + trackedObject.y * actualSize.height,
    height: trackedObject.h * actualSize.height,
    left: leftOffset + trackedObject.x * actualSize.width,
    width: trackedObject.w * actualSize.width,
  }
  return <div className={styles.boundingBox} style={s}>
    {trackedObject.name} #{trackedObject.id} {trackedObject.confidence}%
  </div>;
}

class Home extends Component {
  videoRef: RefObject<HTMLVideoElement>;
  model: any = undefined;

  constructor(props: any) {
    super(props);
    this.videoRef = createRef();
    this.state = {
      isLoading: true,
      fps: 0,
      boundingBoxes: []
    }
  }

  /**
   *
   * @param prediction
   * @param width Of the camera resolution
   * @param height Of the camera resolution
   */
  private predictionToOpenDataCamDetection(prediction: any, width: number, height: number): Detection {
    /*
     * TensorFlow returns predictions in this format:
     *
     * [{
     *   bbox: [x, y, width, height],
     *   class: "person",
     *   score: 0.8380282521247864
     * }, {
     *   bbox: [x, y, width, height],
     *   class: "kite",
     *   score: 0.74644153267145157
     * }]
     *
     * Example:
     *
     * [{
     *   bbox: [-0.30277252197265625, 0.9852933883666992, 636.4740371704102, 477.55438327789307 ]
  ​​   *   class: "person"
  ​​   *   score: 0.7059319615364075
     * }]
     */
    return {
      x: prediction.bbox[0] / width,
      y: prediction.bbox[1] / height,
      w: prediction.bbox[2] / width,
      h: prediction.bbox[3] / height,
      confidence: prediction.score,
      name: prediction.class
    };
  }

  /**
   * Determine the width & height of a video stream
   *
   * @param stream The stream
   * @returns Array of format [width, height]. If resolution can not be determined will return [0,0]
   */
  private getStreamResolution(stream: MediaStream): [number, number] {
    if(stream.getVideoTracks().length == 0) {
      return [0, 0];
    }

    const width = stream.getVideoTracks()[0].getSettings().width;
    const height = stream.getVideoTracks()[0].getSettings().height;
    if(width !== undefined && height !== undefined) {
      return [width, height];
    }
    return [0 ,0];
  }

  componentDidMount() {
    const constraints = {
      video: {
          facingMode: "environment",
      }
    };

    // Activate the webcam stream.
    const t = this;
    let fps = 0;
    let frameNb = 0;
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {

      const [width, height] = t.getStreamResolution(stream);

      cocoSsd.load().then((loadedModel: any) => {
        if(t.videoRef.current === null) {
          throw "videoRef should never be null!"
        }

        t.model = loadedModel;
        t.setState({isLoading: false});
        t.videoRef.current.srcObject = stream;

        function predict() {
          t.model.detect(t.videoRef.current).then((predictions:any[]) => {
            fps += 1;
            frameNb += 1;

            // Track Predictions
            const openDataCamDetections = predictions.map(
              (p) => t.predictionToOpenDataCamDetection(p, width, height)
            );
            updateTrackedItemsWithNewFrame(openDataCamDetections, frameNb);
            const trackedObjects = getJSONOfTrackedItems(false);
            t.setState({boundingBoxes: trackedObjects.map((trackedObject:any) => {
              if(t.videoRef.current === null) {
                throw "videoRef should never be null!"
              }

              console.log({
                clientHeight: t.videoRef.current.clientHeight,
                clientWidth: t.videoRef.current.clientWidth,
                width: t.videoRef.current.width,
                height: t.videoRef.current.height,
                videoHeight: t.videoRef.current.videoHeight,
                videoWidth: t.videoRef.current.videoWidth,
              });

              return <BoundingBox
                key = {trackedObject.id}
                trackedObject = {trackedObject}
                videoRef = {t.videoRef.current} />
            })});

            // Signal the browser that we are ready to receive a new frame
            window.requestAnimationFrame(predict);
          });
        }

        t.videoRef.current.addEventListener('loadeddata', () => {
          predict();
        });
      });
    });

    // Update FPS counter
    setInterval(() => { this.setState({fps: fps}); fps = 0; }, 1000);
  }

  render() {
    return (
      <div className={styles.container}>
        <Head>
          <title>nonocam</title>
        </Head>

        <main className={styles.main}>
          { (this.state as any).isLoading && <p>nonocam loading…</p> }
          <video className={styles.webcam} autoPlay playsInline ref={this.videoRef} />
          {(this.state as any).boundingBoxes}
          <p className={styles.footer}>
            {(this.state as any).fps} fps
          </p>
        </main>

        <Script
          id="tfjs-3.11"
          src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js"
          strategy='beforeInteractive'
        />
        <Script
          id="cocoSsd"
          src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
          strategy='beforeInteractive'
        />
      </div>
    )
  }
}

export default Home
