import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react/cjs/react.development";
import Websocket from "socket.io-client";
import { socketEvents } from "../../constants/socket-event";

const RtcWs = () => {
  const peerConnection = useRef();
  const cacheStream = useRef();
  const [ws, setWs] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // create connection and defining the event
  const createPeerConnection = useCallback(async () => {
    try {
      const connection = new RTCPeerConnection({});
      connection.onicecandidate = async (e) => {
        ws.emit(socketEvents.ICE_CANDIDATE, e.candidate);
      };
      connection.ontrack = (e) => {
        console.log("tracked: ", e.streams[0]);
        const remoteVideo = document.getElementById("remoteVideo");
        if (remoteVideo.srcObject !== e.streams[0]) {
          console.log("remoteVideo", remoteVideo);
          remoteVideo.srcObject = e.streams[0];
        }
      };
      // add track 之後會觸發此event, 用來createOffer 通知remote peer
      connection.onnegotiationneeded = async () => {
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
      alert("please initialize connection first");
      return;
    }
    ws.emit(socketEvents.JOIN_ROOM, { username: "kairu1" });
    await initUserMediaAndTrack(); // 加入多媒體數據到RTCPeerConnection instance
  };

  const calling = async () => {
    try {
      if (peerConnection.current) {
        console.log("Connection Checked!");
      } else {
        console.log("create connection");
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
    console.log("Closing connection call");
    if (!peerConnection) return; // 防呆機制

    // 1. 移除事件監聽
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.onnegotiationneeded = null;

    // 2. 停止所有在connection中的多媒體信息
    peerConnection.getSenders().forEach((sender) => {
      peerConnection.removeTrack(sender);
    });

    // 3. 暫停video播放，並將儲存在src裡的 MediaStreamTracks 依序停止
    const localVideo = document.getElementById("localVideo");
    if (localVideo.srcObject) {
      localVideo.pause();
      localVideo.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // 4. cleanup： 關閉RTCPeerConnection連線並釋放記憶體
    peerConnection.close();
    peerConnection.current = null;
    cacheStream.current = null;
  }

  // handling offer from remote user
  const handleSDPOffer = useCallback(
    async (desc) => {
      console.log("receiving offer from signaling server");
      let _connection;

      if (!peerConnection.current) {
        createPeerConnection();
        return;
      } else {
        _connection = peerConnection.current;
      }
      console.log("sdp offer", desc);
      if (!desc) return;
      // 接收到remote offer 要設定為remote description
      await _connection.setRemoteDescription(desc);

      // 還沒有stream, 要先getUserMedia + addTrack
      if (!cacheStream) {
        console.log("init media cause no cache");
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
      console.log("fetch local media stream");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          aspectRatio: {
            ideal: 1.333333, // 3:2 aspect is preferred
          },
        },
      });
      const localVideo = document.getElementById("localVideo");
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
    console.log("receive answer from remote through signaling server");
    try {
      await peerConnection.current.setRemoteDescription(desc);
    } catch (error) {
      console.log(error);
    }
  }, []);

  // listening to ice candidate and add after finding one
  const handleNewIceCandidate = useCallback(async (candidate) => {
    console.log("Joining new ICE Candidate", candidate);
    try {
      await peerConnection.current.addIceCandidate(candidate);
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    const wsInstance = Websocket("http://localhost:1122");
    if (wsInstance) setWs(wsInstance);
  }, []);

  useEffect(() => {
    if (ws) {
      createPeerConnection();
      ws.on("connect", () => {
        console.log("ws server connected");
        setIsWsConnected(!!ws);
      });
      ws.on(socketEvents.NEW_USER_JOIN, (data) => {
        console.log("New User has joined the room");
        console.log(data);
      });

      ws.on(socketEvents.USER_LEFT_ROOM, (data) => {
        console.log("Someone has left the room");
        console.log(data);
      });

      ws.on(socketEvents.DISCONNECTED, () => {
        console.log("Server Disconnected");
      });

      // ws.on(socketEvents.SDP_ANSWER, handleSDPAnswer);
      // ws.on(socketEvents.ICE_CANDIDATE, handleNewIceCandidate);
      // ws.on(socketEvents.SDP_OFFER, handleSDPOffer);
    }
  }, [
    ws,
    createPeerConnection,
    handleSDPAnswer,
    handleNewIceCandidate,
    handleSDPOffer,
  ]);

  return (
    <>
      <h1>Video Chat With WebRTC</h1>
      <div id="container">
        <section>
          <h1>Local Tracker</h1>
          <video id="localVideo" autoPlay></video>
        </section>
        <section>
          <h1>Remote Receiver</h1>
          <video id="remoteVideo" autoPlay></video>
        </section>

        <div className="box">
          <button onClick={() => connect()}>Connection</button>
          <button onClick={() => calling()}>Call</button>
          <button onClick={() => closing()}>Hang Up</button>
        </div>
      </div>
    </>
  );
};

export default RtcWs;
