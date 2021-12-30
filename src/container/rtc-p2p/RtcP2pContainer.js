import { useCallback, useEffect, useState } from "react/cjs/react.development";
import styles from "./RtcVideo.module.scss";

const RtcP2pContainer = () => {
  const [isCalling, setIsCalling] = useState(false);
  const [localPeer, setLocalPeer] = useState();
  const [remotePeer, setRemotePeer] = useState();
  const [localStream, setLocalStream] = useState();
  const [callerConnection, setCallerConnection] = useState();
  const [receiverConnection, setReceiverConnection] = useState();

  const callerStartVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      localPeer.srcObject = stream;
      setLocalStream(stream);
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
  };

  const callerCall = async () => {
    const _callerConnection = new RTCPeerConnection({});
    const _receiverConnection = new RTCPeerConnection({});

    _callerConnection.onicecandidate = async (e) => {
      try {
        await _receiverConnection.addIceCandidate(e.candidate);
      } catch (error) {
        console.log("caller error: ", error);
      }
    };
    _callerConnection.oniceconnectionstatechange = (e) => {
      console.log("caller state change ", e);
    };

    _receiverConnection.onicecandidate = async (e) => {
      try {
        await _callerConnection.addIceCandidate(e.candidate);
      } catch (error) {
        console.log("receiver error: ", error);
      }
    };
    _receiverConnection.oniceconnectionstatechange = (e) => {
      console.log("receiver state change ", e);
    };

    _receiverConnection.ontrack = (e) => {
      if (remotePeer.srcObject !== e.streams[0]) {
        remotePeer.srcObject = e.streams[0];
      }
    };

    localStream
      .getTracks()
      .forEach((track) => _callerConnection.addTrack(track, localStream));

    setIsCalling(true);
    setCallerConnection(_callerConnection);
    setReceiverConnection(_receiverConnection);
  };

  const onCreateAnswerSuccess = useCallback(
    async (desc) => {
      try {
        await receiverConnection.setLocalDescription(desc);
        console.log("receiver set local desc complete");
      } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
      }

      try {
        await callerConnection.setRemoteDescription(desc);
        console.log("caller set remote desc complete");
      } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
      }
    },
    [callerConnection, receiverConnection]
  );

  const onCreateOfferSuccess = useCallback(
    async (desc) => {
      try {
        await callerConnection.setLocalDescription(desc);
        console.log("caller set local desc complete");
      } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
      }

      try {
        await receiverConnection.setRemoteDescription(desc);
        console.log("receiver set remote desc complete");
      } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
      }

      try {
        const answer = await receiverConnection.createAnswer();
        await onCreateAnswerSuccess(answer);
      } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
      }
    },
    [callerConnection, receiverConnection, onCreateAnswerSuccess]
  );

  const hangupHandler = () => {
    callerConnection.close();
    receiverConnection.close();
    remotePeer.srcObject = null;
    setCallerConnection(null);
    setReceiverConnection(null);
  };

  useEffect(() => {
    setLocalPeer(document.getElementById("localVideo"));
    setRemotePeer(document.getElementById("remoteVideo"));
  }, []);

  useEffect(() => {
    if (isCalling && callerConnection && receiverConnection) {
      (async () => {
        try {
          const offer = await callerConnection.createOffer({
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1,
          });
          await onCreateOfferSuccess(offer);
        } catch (e) {
          console.log(`Failed to create session description: ${e.toString()}`);
        }
      })();
    }
  }, [isCalling, callerConnection, receiverConnection, onCreateOfferSuccess]);

  return (
    <div id={styles["rtc-p2p-container"]} className="webrtc-bg">
      <h1>Calling With WebRTC</h1>
      <div className="row justify-content-between">
        <div className="col-12 col-md-6">
          <div className={`webrtc-card ${styles["rtc-video-card"]}`}>
            <h3>P1 Caller</h3>
            <video id="localVideo" autoPlay muted></video>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className={`webrtc-card ${styles["rtc-video-card"]}`}>
            <h3>P2 Receiver</h3>
            <video id="remoteVideo" autoPlay></video>
          </div>
        </div>
      </div>
      <div className="webrtc-actions">
        <button className="btn btn-success" onClick={() => callerStartVideo()}>
          Start
        </button>
        <button className="btn btn-warning" onClick={() => callerCall()}>
          Call
        </button>
        <button className="btn btn-danger" onClick={() => hangupHandler()}>
          Hang Up
        </button>
      </div>
    </div>
  );
};

export default RtcP2pContainer;
