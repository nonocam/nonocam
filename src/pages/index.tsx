import Head from 'next/head'
import { Component, createRef, RefObject } from 'react'
import styles from '../../styles/Home.module.css'
import Script from 'next/script'
import { updateTrackedItemsWithNewFrame, getJSONOfTrackedItems, Detection } from 'node-moving-things-tracker/tracker'
import AskLandscape from '../components/AskLandscape'

declare let cocoSsd: any;

const constraints = {
  video: {
      facingMode: "environment",
      frameRate: 24,
      width: 640,
      height: 360,
  }
};

let x:any = null;

function BoundingBox(props:any) {
  function videoDimensions(video: HTMLVideoElement) {
    const videoHeight = video.videoHeight;
    const videoWidth = video.videoWidth;

    // Ratio of the video's intrisic dimensions
    var videoRatio = videoWidth / videoHeight;
    // The width and height of the video element
    var width = video.offsetWidth, height = video.offsetHeight;
    // The ratio of the element's width to its height
    var elementRatio = width/height;
    if(elementRatio > videoRatio) {
      // If the video element is short and wide
      width = height * videoRatio;
    } else {
      // It must be tall and thin, or exactly equal to the original ratio
      height = width / videoRatio;
    }

    // const y = {
    //   videoHeight: videoHeight,
    //   videoWidth: videoWidth,
    //   offsetHeight: video.offsetHeight,
    //   offsetWidth: video.offsetWidth,
    //   clientHeigh: video.clientHeight,
    //   clientWidth: video.clientWidth,
    //   height,
    //   width,
    //   topOffset: (videoRef.clientHeight - height) / 2,
    //   leftOffset: (videoRef.clientWidth - width) / 2,
    //   resolution: getStreamResolution(video.srcObject as MediaStream),
    // }
    // if(JSON.stringify(x) !== JSON.stringify(y)) {
    //   x = y;
    //   console.table(x);
    // }

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
    {trackedObject.name} #{trackedObject.id} {Math.round(trackedObject.confidence * 100)}%
  </div>;
}

/**
 * Determine the width & height of a video stream
 *
 * @param stream The stream
 * @returns Array of format [width, height]. If resolution can not be determined will return [0,0]
 */
function getStreamResolution(stream: MediaStream): [number, number] {
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

class Home extends Component {
  videoRef: RefObject<HTMLVideoElement>;
  model: any = undefined;

  constructor(props: any) {
    super(props);
    this.videoRef = createRef();
    this.state = {
      isLoading: true,
      fps: 0,
      boundingBoxes: [],
      counterPerson: 0,
      counterBicycle: 0,
      counterCar: 0,
      counterTruck: 0,
      lastIdPerson: -1,
      lastIdBicycle: -1,
      lastIdCar: -1,
      lastIdTruck: -1,
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

  componentDidMount() {
    // Activate the webcam stream.
    const t = this;
    let fps = 0;
    let frameNb = 0;
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      const [width, height] = getStreamResolution(stream);

      cocoSsd.load().then((loadedModel: any) => {
        if(t.videoRef.current === null) {
          throw "videoRef should never be null!"
        }

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

              return <BoundingBox
                key = {trackedObject.id}
                trackedObject = {trackedObject}
                videoRef = {t.videoRef.current} />
            })});

            // Increase Counter
            const sortedObjects = (trackedObjects as any[]).sort((x, y) => x.id - y.id);
            sortedObjects.forEach((o:any) => {
              if(o.name === 'person' && o.id > (t.state as any).lastIdPerson) {
                t.setState({
                  lastIdPerson: o.id,
                  counterPerson: (t.state as any).counterPerson + 1,
                });
              } else if(o.name === 'bicycle' && o.id > (t.state as any).lastIdBicycle) {
                t.setState({
                  lastIdBicycle: o.id,
                  counterBicycle: (t.state as any).counterBicycle + 1,
                });
              } else if(o.name === 'car' && o.id > (t.state as any).lastIdCar) {
                t.setState({
                  lastIdCar: o.id,
                  counterCar: (t.state as any).counterCar + 1,
                });
              } else if(o.name === 'truck' && o.id > (t.state as any).lastIdTruck) {
                t.setState({
                  lastIdTruck: o.id,
                  counterTruck: (t.state as any).counterTruck + 1,
                });
              }
            });

            // Signal the browser that we are ready to receive a new frame
            window.requestAnimationFrame(predict);
          });
        }

        t.model = loadedModel;
        t.setState({isLoading: false});
        t.videoRef.current.srcObject = stream;
        t.videoRef.current.addEventListener('loadeddata', () => {
          predict();
        });
      });
    }, (err) => {
      console.log(err);
    });

    // Update FPS counter
    setInterval(() => { this.setState({fps: fps}); fps = 0; }, 1000);

    this.setState({isPortrait: window.innerHeight > window.innerWidth});
    window.addEventListener('resize', () => {
      this.setState({isPortrait: window.innerHeight > window.innerWidth});
    });
  }

  render() {
    return (
      <div className={styles.container}>
        <Head>
          <title>nonocam</title>
        </Head>

        <main className={styles.main}>
          { (this.state as any).isPortrait && <AskLandscape /> }
          {
            (this.state as any).isLoading &&
            <p style={{position: 'fixed', top: '50%', left: '0', width: '100%', textAlign: 'center'}}>nonocam loading…</p>
          }
          <video className={styles.webcam} autoPlay playsInline ref={this.videoRef} />
          {(this.state as any).boundingBoxes}
          {
            !(this.state as any).isLoading &&
            <p className={styles.footer}>
              <span>🚶 {(this.state as any).counterPerson}</span>
              <span>🚴 {(this.state as any).counterBicycle}</span>
              <span>🚗 {(this.state as any).counterCar}</span>
              <span>🚚 {(this.state as any).counterTruck}</span>
              <span>{(this.state as any).fps} fps</span>
            </p>
          }
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
