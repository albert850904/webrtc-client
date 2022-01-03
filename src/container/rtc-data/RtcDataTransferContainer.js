import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOCAL_USER, REMOTE_USER } from '../../constants/user';
import styles from './RtcDataTransfer.module.scss';

const RtcDataTransferContainer = () => {
  const navigate = useNavigate();
  const [localConnection, setLocalConnection] = useState();
  const [remoteConnection, setRemoteConnection] = useState();
  const [channel, setChannel] = useState();
  const [localMsg, setLocalMsg] = useState('');
  const [remoteMsg, setRemoteMsg] = useState('');
  const [isConnectionReady, setIsConnectionReady] = useState(false);

  const onChannelStageChange = useCallback((name, _channel) => {
    const readyState = _channel.readyState;
    setIsConnectionReady(name === REMOTE_USER && readyState === 'open');
    console.log(`${name} channel state is: ${readyState}`);
  }, []);

  const startConversationHandler = async () => {
    try {
      const datachannel = localConnection.createDataChannel('local channel', {
        negotiated: false,
      });
      datachannel.onopen = onChannelStageChange(LOCAL_USER, datachannel);
      setChannel(datachannel);
      const offer = await localConnection.createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      });
      await localConnection.setLocalDescription(offer);
      await remoteConnection.setRemoteDescription(offer);

      const answer = await remoteConnection.createAnswer();
      await remoteConnection.setLocalDescription(answer);
      await localConnection.setRemoteDescription(answer);
    } catch (e) {
      console.log(`p2p connection error: `, e);
    }
  };

  const closeConversationHandler = () => {
    localConnection.close();
    remoteConnection.close();
  };

  const sendTextHandler = () => {
    channel.send(localMsg);
  };

  useEffect(() => {
    (async () => {
      try {
        const localUser = new RTCPeerConnection(null);
        const remoteUser = new RTCPeerConnection(null);

        localUser.onicecandidate = async (event) => {
          try {
            await remoteUser.addIceCandidate(event.candidate);
          } catch (e) {
            console.log('localuser error: ', e);
          }
        };

        remoteUser.ondatachannel = (e) => {
          const receiveChannel = e.channel;
          receiveChannel.onmessage = (event) => {
            setRemoteMsg(event.data);
          };
          receiveChannel.onopen = () =>
            onChannelStageChange(REMOTE_USER, receiveChannel);
          receiveChannel.onclose = () =>
            onChannelStageChange(REMOTE_USER, receiveChannel);
        };

        setLocalConnection(localUser);
        setRemoteConnection(remoteUser);
      } catch (error) {
        console.log(`initialize users error: `, error);
      }
    })();
  }, [onChannelStageChange]);

  return (
    <div id={styles['rtc-data-transfer-container']} className="webrtc-bg">
      <div className="webrtc-title">
        <span className="arrow left" onClick={() => navigate(-1)}></span>
        <h1>RTCDataChannel Demo</h1>
      </div>
      <div
        className={`row justify-content-between ${styles['rtc-data-transfer-container']}`}
      >
        <div
          className={`col-12 col-md-6 ${styles['rtc-data-transfer-container__block']}`}
        >
          <label htmlFor="dataChannelSend">Sender</label>
          <textarea
            id="dataChannelSend"
            className="w-100"
            disabled={!isConnectionReady}
            onChange={(e) => setLocalMsg(e.target.value)}
            value={localMsg}
            rows={10}
            placeholder="Press Start, enter some text, then press Send."
          ></textarea>
        </div>
        <div
          className={`col-12 col-md-6 ${styles['rtc-data-transfer-container__block']}`}
        >
          <label htmlFor="dataChannelRecieve">Receiver</label>
          <textarea
            id="dataChannelReceive"
            className="w-100"
            disabled
            onChange={(e) => setRemoteMsg(e.target.value)}
            rows={10}
            value={remoteMsg}
          ></textarea>
        </div>
      </div>
      <div className="webrtc-actions">
        <button
          className="btn btn-success"
          onClick={() => startConversationHandler()}
        >
          Start
        </button>
        <button className="btn btn-warning" onClick={() => sendTextHandler()}>
          Send
        </button>
        <button
          className="btn btn-danger"
          onClick={() => closeConversationHandler()}
        >
          Stop
        </button>
      </div>
    </div>
  );
};

export default RtcDataTransferContainer;
