import { useEffect, useState } from "react/cjs/react.development";
import Websocket from "socket.io-client";
import { socketEvents } from "../../constants/socket-event";

const RtcWs = () => {
  const [ws, setWs] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [peerConnection, setPeerConnection] = useState();
  const [cacheStream, setCacheStream] = useState();

  const connection = () => {
    if (!isWsConnected) {
      alert("please initialize connection first");
      return;
    }

    ws.emit(socketEvents.JOIN_ROOM, { username: "kairu1" });

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

    ws.on(socketEvents.SDP_OFFER, handleSDPOffer);
    ws.on(socketEvents.SDP_ANSWER, handleSDPAnswer);
    ws.on(socketEvents.ICE_CANDIDATE, handleNewIceCandidate);
  };

  const calling = async () => {
    try {
      if (peerConnection) {
        alert("Connection Checked!");
      } else {
        const connection = await createPeerConnection(); //建立 RTCPeerConnection
        setPeerConnection(connection);
        await initUserMediaAndTrack(connection); // 加入多媒體數據到RTCPeerConnection instance
      }
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
    setPeerConnection(null);
    setCacheStream(null);
  }

  // handling offer from remote user
  const handleSDPOffer = async (desc) => {
    console.log("receiving offer from signaling server");
    if (!peerConnection) {
      const connection = await createPeerConnection();
      setPeerConnection(connection);
    }

    // 接收到remote offer 要設定為remote description
    await peerConnection.setRemoteDescription(desc);

    // 還沒有stream, 要先getUserMedia + addTrack
    if (!cacheStream) {
      await initUserMediaAndTrack();
    }

    // create answer for remote user after receiving offers from remote user
    try {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      ws.emit(socketEvents.SDP_ANSWER, answer);
    } catch (error) {
      console.log(error);
    }
  };

  // fetch media stream and add it to connection tracks
  const initUserMediaAndTrack = async (connection) => {
    let stream;
    let _connection = peerConnection || connection;

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
      setCacheStream(stream);
    } catch (error) {
      console.log(error);
    }

    try {
      // RTCPeerConnection 加入MediaStreamTrack
      stream
        .getTracks()
        .forEach((track) => _connection.addTrack(track, stream));
    } catch (error) {
      console.log(error);
    }
  };

  // create connection and defining the event
  const createPeerConnection = async () => {
    try {
      const connection = new RTCPeerConnection({});
      connection.onicecandidate = async (e) => {
        ws.emit(socketEvents.ICE_CANDIDATE, e.candidate);
      };
      connection.ontrack = (e) => {
        const remoteVideo = document.getElementById("remoteVideo");
        if (remoteVideo.srcObject !== e.streams[0]) {
          remoteVideo.srcObject = e.streams[0];
        }
      };
      // add track 之後會觸發此event, 用來createOffer 通知remote peer
      connection.onnegotiationneeded = async () => {
        await connection.setLocalDescription(
          await connection.createOffer({
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1,
          })
        );
        ws.emit(socketEvents.SDP_OFFER, connection.localDescription);
      };
      return connection;
    } catch (error) {
      console.log(error);
    }
  };

  // after receiving answer from remote peer, we should set it to remote
  const handleSDPAnswer = async (desc) => {
    console.log("receive answer from remote through signaling server");
    try {
      await peerConnection.setRemoteDescription(desc);
    } catch (error) {
      console.log(error);
    }
  };

  // listening to ice candidate and add after finding one
  const handleNewIceCandidate = async (candidate) => {
    console.log("Joining new ICE Candidate", candidate);
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const wsInstance = Websocket("http://localhost:1122");
    if (wsInstance) setWs(wsInstance);
  }, []);

  useEffect(() => {
    if (ws) {
      ws.on("connect", () => {
        console.log("ws server connected");
        setIsWsConnected(!!ws);
      });
    }
  }, [ws]);

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
          <button onClick={() => connection()}>Connection</button>
          <button onClick={() => calling()}>Call</button>
          <button onClick={() => closing()}>Hang Up</button>
        </div>
      </div>
    </>
  );
};

export default RtcWs;
