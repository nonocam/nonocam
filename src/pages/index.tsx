import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { Component, createRef, RefObject, useRef, useState } from 'react'
import styles from '../../styles/Home.module.css'
import Script from 'next/script'

declare let cocoSsd: any;

class Home extends Component {
  videoRef: RefObject<any>;
  model: any = undefined;

  constructor(props: any) {
    super(props);
    this.videoRef = createRef();
    this.state = {
      isLoading: true,
      fps: 0
    }
  }

  componentDidMount() {
    const constraints = {
      video: {
          facingMode: "environment"
      }
    };

    // Activate the webcam stream.
    const t = this;
    let fps = 0;
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      cocoSsd.load().then((loadedModel: any) => {
        t.model = loadedModel;
        t.setState({isLoading: false});
        t.videoRef.current.srcObject = stream;

        function predict() {
          t.model.detect(t.videoRef.current).then((predictions:any) => {
            fps += 1;
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
