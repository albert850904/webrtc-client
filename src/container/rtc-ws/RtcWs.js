import React, { useEffect, useState, useCallback, useRef } from 'react';
import Websocket from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { socketEvents } from '../../constants/socket-event';
import styles from './RtcWs.module.scss';

const RtcWs = () => {
  const navigate = useNavigate();
  const peerConnection = useRef();
  const cacheStream = useRef();
  const [ws, setWs] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // create connection and defining the event
  const createPeerConnection = useCallback(async () => {
    try {
      const connection = new RTCPeerConnection({});
      connection.onicecandidate = (e) => {
        ws.emit(socketEvents.ICE_CANDIDATE, e.candidate);
      };
      connection.ontrack = (e) => {
        console.log('tracked: ', e.streams[0]);
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo.srcObject !== e.streams[0]) {
          console.log('remoteVideo', remoteVideo);
          remoteVideo.srcObject = e.streams[0];
        }
      };
      // add track 之後會觸發此event, 用來createOffer 通知remote peer
      connection.onnegotiationneeded = async () => {
        console.log('negotaited');
        // const offer = await connection.createOffer({
        //   offerToReceiveAudio: 1,
        //   offerToReceiveVideo: 1,
        // });
        // await connection.setLocalDescription(offer);
        // ws.emit(socketEvents.SDP_OFFER, connection.localDescription);
      };
      peerConnection.current = connection;
    } catch (error) {
      console.log(error);
    }
  }, [ws]);

  const connect = async () => {
    if (!isWsConnected) {
      alert('please initialize connection first');
      return;
    }
    ws.emit(socketEvents.JOIN_ROOM, { username: 'kairu1' });
    await initUserMediaAndTrack(); // 加入多媒體數據到RTCPeerConnection instance
  };

  const calling = async () => {
    try {
      if (peerConnection.current) {
        console.log('Connection Checked!');
      } else {
        console.log('create connection');
        await createPeerConnection(); //建立 RTCPeerConnection
        return;
      }
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      });
      await peerConnection.current.setLocalDescription(offer);
      ws.emit(socketEvents.SDP_OFFER, peerConnection.current.localDescription);
    } catch (error) {
      console.log(`Error ${error.name}: ${error.message}`);
    }
  };

  function closing() {
    console.log('Closing connection call');
    const _connection = peerConnection.current;
    if (!_connection) return; // 防呆機制

    // 1. 移除事件監聽
    _connection.ontrack = null;
    _connection.onicecandidate = null;
    _connection.onnegotiationneeded = null;

    // 2. 停止所有在connection中的多媒體信息
    _connection.getSenders().forEach((sender) => {
      _connection.removeTrack(sender);
    });

    // 3. 暫停video播放，並將儲存在src裡的 MediaStreamTracks 依序停止
    const localVideo = document.getElementById('localVideo');
    if (localVideo.srcObject) {
      localVideo.pause();
      localVideo.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // 4. cleanup： 關閉RTCPeerConnection連線並釋放記憶體
    _connection.close();
    _connection.current = null;
    cacheStream.current = null;
  }

  // handling offer from remote user
  const handleSDPOffer = useCallback(
    async (desc) => {
      console.log('receiving offer from signaling server');
      let _connection;

      if (!peerConnection.current) {
        await createPeerConnection();
        return;
      } else {
        _connection = peerConnection.current;
      }
      console.log('sdp offer', desc);
      if (!desc) return;
      // 接收到remote offer 要設定為remote description
      await _connection.setRemoteDescription(desc);

      // 還沒有stream, 要先getUserMedia + addTrack
      if (!cacheStream) {
        console.log('init media cause no cache');
        await initUserMediaAndTrack();
      }

      // create answer for remote user after receiving offers from remote user
      try {
        const answer = await _connection.createAnswer();
        await _connection.setLocalDescription(answer);
        ws.emit(socketEvents.SDP_ANSWER, answer);
      } catch (error) {
        console.log(error);
      }
    },
    [createPeerConnection, ws]
  );

  // fetch media stream and add it to connection tracks
  const initUserMediaAndTrack = async () => {
    let stream;
    let _connection = peerConnection.current;

    try {
      console.log('fetch local media stream');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          aspectRatio: {
            ideal: 1.333333, // 3:2 aspect is preferred
          },
        },
      });
      const localVideo = document.getElementById('localVideo');
      localVideo.srcObject = stream;
      cacheStream.current = stream;
    } catch (error) {
      console.log(error);
    }

    try {
      // RTCPeerConnection 加入MediaStreamTrack
      stream
        .getTracks()
        .forEach((track) => _connection.addTrack(track, stream));
      peerConnection.current = _connection;
    } catch (error) {
      console.log(error);
    }
  };

  // after receiving answer from remote peer, we should set it to remote
  const handleSDPAnswer = useCallback(async (desc) => {
    console.log('receive answer from remote through signaling server');
    try {
      await peerConnection.current.setRemoteDescription(desc);
    } catch (error) {
      console.log(error);
    }
  }, []);

  // listening to ice candidate and add after finding one
  const handleNewIceCandidate = useCallback(async (candidate) => {
    console.log('Joining new ICE Candidate', candidate);
    try {
      await peerConnection.current.addIceCandidate(candidate);
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    const wsInstance = Websocket('http://localhost:1122');
    if (wsInstance) setWs(wsInstance);
  }, []);

  useEffect(() => {
    if (ws) {
      (async () => await createPeerConnection())();
      ws.on('connect', () => {
        console.log('ws server connected');
        setIsWsConnected(!!ws);
      });
      ws.on(socketEvents.NEW_USER_JOIN, (data) => {
        console.log('New User has joined the room');
        console.log(data);
      });

      ws.on(socketEvents.USER_LEFT_ROOM, (data) => {
        console.log('Someone has left the room');
        console.log(data);
      });

      ws.on(socketEvents.DISCONNECTED, () => {
        console.log('Server Disconnected');
      });

      ws.on(socketEvents.SDP_ANSWER, handleSDPAnswer);
      ws.on(socketEvents.ICE_CANDIDATE, handleNewIceCandidate);
      ws.on(socketEvents.SDP_OFFER, handleSDPOffer);
    }
  }, [
    ws,
    createPeerConnection,
    handleSDPAnswer,
    handleNewIceCandidate,
    handleSDPOffer,
  ]);

  return (
    <div id={styles['rtc-ws-container']} className="webrtc-bg">
      <div className="webrtc-title d-flex">
        <span className="arrow left" onClick={() => navigate(-1)}></span>
        <h1>Video Chat With WebRTC</h1>
      </div>
      <div className="row justify-content-between">
        <div className="col-12 col-md-6">
          <div className={`webrtc-card ${styles['rtc-video-card']}`}>
            <h1>Local Tracker</h1>
            <video id="localVideo" autoPlay></video>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className={`webrtc-card ${styles['rtc-video-card']}`}>
            <h1>Remote Receiver</h1>
            <video id="remoteVideo" autoPlay></video>
          </div>
        </div>
      </div>
      <div className="webrtc-actions">
        <button className="btn btn-success" onClick={() => connect()}>
          Connection
        </button>
        <button className="btn btn-warning" onClick={() => calling()}>
          Call
        </button>
        <button className="btn btn-danger" onClick={() => closing()}>
          Hang Up
        </button>
      </div>
    </div>
  );
};

export default RtcWs;
