import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebRTC } from '../../utils/hooks/webrtc-hook';
import styles from './RtcVideo.module.scss';

const IMAGE_FILTER_OPTIONS = [
  { id: 'none', name: 'None' },
  { id: 'blur', name: 'Blur' },
  { id: 'grayscale', name: 'Grayscale' },
  { id: 'invert', name: 'Invert' },
  { id: 'contrast', name: 'Contrast' },
  { id: 'sepia', name: 'Sepia' },
  { id: 'opacity', name: 'Opacity 50%' },
  { id: 'saturate', name: 'Saturate' },
  { id: 'hue-rotate', name: 'Hue Rotate' },
  { id: 'drop-shadow', name: 'Drop Shadow' },
];

const RtcVideoContainer = (props) => {
  const navigate = useNavigate();
  const {
    startStreamingHandler,
    stopMediaHandler,
    screenshotHandler,
    selectFilterHandler,
    fetchTracksProperties,
    rtcState,
  } = useWebRTC();

  const { capturedImage, selectedFilter } = rtcState;

  return (
    <div id={styles['rtc-video-container']} className="webrtc-bg">
      <div className="webrtc-title">
        <span className="arrow left" onClick={() => navigate(-1)}></span>
        <h1>Video</h1>
      </div>
      <div className={`webrtc-card ${styles['rtc-video-card']}`}>
        <video
          autoPlay
          id="rtc-video"
          className={styles[selectedFilter]}
        ></video>
      </div>
      <div className="webrtc-actions">
        <button
          className="btn btn-primary"
          onClick={() => startStreamingHandler()}
        >
          Stream
        </button>
        <button className="btn btn-danger" onClick={() => stopMediaHandler()}>
          Stop
        </button>
        <button
          className="btn btn-outline-info"
          onClick={() => fetchTracksProperties()}
        >
          Get Info
        </button>
        <button
          className="btn btn-success"
          id="screenshot-button"
          onClick={() => screenshotHandler()}
        >
          Screenshot
        </button>
      </div>
      <div className={styles['rtc-css-selector']}>
        <select
          id="filter"
          class="form-select form-select-sm"
          onChange={(e) => selectFilterHandler(e)}
        >
          {IMAGE_FILTER_OPTIONS.map((option) => (
            <option value={option.id} key={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <canvas id="rtc-canvas" style={{ display: 'none' }}></canvas>
      <div className={styles['screenshot']}>
        <div className="text-center">
          <h3 htmlFor="screenshotImg">Smile Mother Fucker : )</h3>
          <img id="screenshotImg" src={capturedImage} alt="" />
        </div>
      </div>
    </div>
  );
};

export default RtcVideoContainer;
