import { useCallback, useReducer } from "react";
import { useEffect, useState } from "react/cjs/react.development";

export const SET_VIDEO_INSTANCE = "SET_VEDIO_INSTANCE";
export const SET_CANVAS_INSTANCE = "SET_CANVAS_INSTANCE";
export const SET_CAPTURED_IMG = "SET_CAPTURED_IMG";
export const SET_IMAGE_FILTER = "SET_IMAGE_FILTER";

const DEFAULT_CONSTRAINTS = {
  audio: false,
  video: {
    frameRate: { ideal: 10, max: 15 },
    width: { min: window.innerWidth },
    height: { min: window.innerHeight },
  },
};

const DEFAULT_STATE = {
  video: null,
  canvas: null,
  capturedImage: null,
  selectedFilter: null,
};

const rtcReducer = (state, action) => {
  switch (action.type) {
    case SET_VIDEO_INSTANCE: {
      return {
        ...state,
        video: action.value,
      };
    }
    case SET_CANVAS_INSTANCE: {
      return {
        ...state,
        canvas: action.value,
      };
    }
    case SET_CAPTURED_IMG: {
      return {
        ...state,
        capturedImage: action.value,
      };
    }
    case SET_IMAGE_FILTER: {
      return {
        ...state,
        selectedFilter: action.value,
      };
    }
    default:
      break;
  }
};

/**
 * Please set a html video and canvas in the jsx code
 * html video should have id "rtc-video"
 * html canvas should have id "rtc-canvas"
 * @returns
 */
export const useWebRTC = () => {
  const [rtcState, dispatch] = useReducer(rtcReducer, DEFAULT_STATE);
  const { video, canvas } = rtcState;

  const fetchCorespondingGetMediaFunction = (_constraints) => {
    if ("mediaDevices" in navigator) {
      return navigator.mediaDevices.getUserMedia(_constraints);
    }

    navigator.mediaDevices = {};
    navigator.mediaDevices.getUserMedia = function (_oldconstraints) {
      const getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

      // 不支援的情況下
      if (!getUserMedia) {
        return Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
      }

      // 保持跟原先api一樣故將其封裝成promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, _oldconstraints, resolve, reject);
      });
    };

    return navigator.mediaDevices.getUserMedia(_constraints);
  };

  const fetchTracksProperties = useCallback(() => {
    if (!window.stream) return;
    const tracks = window.stream.getTracks();
    console.log(tracks);
  }, []);

  const successCallback = useCallback(
    (stream) => {
      window.stream = stream;

      if ("srcObject" in video) {
        video.srcObject = stream;
      } else {
        // 舊瀏覽器沒有srcObject，所以要先建構objectUrl 再塞給src
        video.src = window.URL.createObjectURL(stream);
      }
    },
    [video]
  );

  const errorCallback = useCallback((error) => {
    console.log("getStreamService error: ", error);
  }, []);

  const startStreamingHandler = useCallback(() => {
    (async () => {
      try {
        const mediaGet = await fetchCorespondingGetMediaFunction(
          DEFAULT_CONSTRAINTS
        );
        if (mediaGet) successCallback(mediaGet);
        else throw new Error("fetch error");
      } catch (error) {
        errorCallback(error);
      }
    })();
  }, [successCallback, errorCallback]);

  const stopMediaHandler = useCallback(() => {
    if (!window.stream) return;
    const videoStreams = window.stream.getTracks();
    videoStreams.forEach((stream) => stream.stop());
    video.src = video.srcObject = null;
  }, [video]);

  const screenshotHandler = useCallback(() => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    dispatch({
      type: SET_CAPTURED_IMG,
      value: canvas.toDataURL("image/png"),
    });
  }, [canvas, video]);

  const selectFilterHandler = useCallback((e) => {
    dispatch({ type: SET_IMAGE_FILTER, value: e.target.value });
  }, []);

  useEffect(() => {
    dispatch({
      type: SET_VIDEO_INSTANCE,
      value: document.getElementById("rtc-video"),
    });
    dispatch({
      type: SET_CANVAS_INSTANCE,
      value: document.getElementById("rtc-canvas"),
    });
  }, []);

  return {
    startStreamingHandler,
    stopMediaHandler,
    screenshotHandler,
    selectFilterHandler,
    fetchTracksProperties,
    rtcState,
  };
};
