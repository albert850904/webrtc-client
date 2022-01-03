import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RtcFileTransfer.module.scss';

const CHUNK_SIZE = 16384;

const RtcFileTransferContainer = () => {
  const navigate = useNavigate();
  // useRef 只會回傳一個值，這個值是一個有 current屬性 的 Object 。當更新 current 值並不會觸發 re-render
  const timestamp = useRef();
  const receiveProgress = useRef(0);
  const receiveBuffer = useRef([]);
  const anchorRef = useRef();
  const byteRef = useRef();
  const bitRateMax = useRef(0);

  const [localConnection, setLocalConnection] = useState();
  const [remoteConnection, setRemoteConnection] = useState();
  const [selectedFile, setSelectedFile] = useState();
  const [localChannel, setLocalChannel] = useState();
  const [remoteChannel, setRemoteChannel] = useState();
  const [sendProgress, setSendProgress] = useState(0);

  /**
   * recording sender stage change
   */
  const onSendChannelStageChange = useCallback((channel) => {
    const readyState = channel.readyState;
    // setIsConnectionReady(name === REMOTE_USER && readyState === "open");
    console.log(`Local channel state is: ${readyState}`);
  }, []);

  /**
   * recording state change
   */
  const onReceiveChannelStateChange = useCallback(async (channel) => {
    const readyState = channel.readyState;
    console.log(`Remote channel state is: ${readyState}`);
  }, []);

  /**
   * handle sending files with arraybuffer
   */
  const sendFileHandler = async () => {
    let offset = 0;
    const fr = new FileReader();
    fr.addEventListener('error', (error) =>
      console.error('Error reading file:', error)
    );
    fr.addEventListener('abort', (event) =>
      console.log('File reading aborted:', event)
    );
    // trigger during load event
    fr.onload = (e) => {
      localChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      setSendProgress(offset);
      if (offset < selectedFile.size) {
        const slice = selectedFile.slice(offset, offset + CHUNK_SIZE); // send a subset of blob
        fr.readAsArrayBuffer(slice); // for reading blob files
      }
    };
    timestamp.current = new Date().getTime();
    fr.readAsArrayBuffer(selectedFile.slice(offset, 0 + CHUNK_SIZE));
  };

  /**
   * callback function when receiver receive the file
   */
  const onReceiveChannelGotData = useCallback(
    async (event) => {
      // fetch ICE connection statistics
      const stats = await remoteConnection.getStats();
      let activePair;
      stats.forEach((report) => {
        if (report.type === 'transport') {
          // this is how you get the connected pair candidate
          activePair = stats.get(report.selectedCandidatePairId);
        }
      });

      // bit rate
      const timePassed = activePair.timestamp - timestamp.current || 1;
      const bitRate = Math.round(
        (activePair.bytesReceived * 8) / (timePassed / 1000) / 1000 // byte * 8 = bit
      );

      timestamp.current = activePair.timestamp;
      bitRateMax.current =
        bitRate > bitRateMax.current ? bitRate : bitRateMax.current;
      byteRef.current.innerHTML = `<strong>Bitrate:</strong> ${bitRate} kbits/sec (max: ${bitRateMax.current} kbits/sec)`;

      receiveProgress.current += event.data.byteLength;
      const tempBuf = [...receiveBuffer.current];
      tempBuf.push(event.data);
      receiveBuffer.current = tempBuf;

      // using Blob to convert array of buffer into File Blob
      if (receiveProgress.current === selectedFile.size) {
        const received = new Blob(receiveBuffer.current);
        anchorRef.current.href = URL.createObjectURL(received);
        anchorRef.current.download = selectedFile.name;
        anchorRef.current.textContent = `Click to download '${selectedFile.name}' (${selectedFile.size} bytes)`;
        closeDataChannels();
      }
    },
    [receiveProgress, selectedFile, timestamp]
  );

  const closeDataChannels = useCallback(() => {
    console.log('Closing data channels');
    localChannel.close();
    console.log(`Closed data channel with label: ${localChannel.label}`);
    if (remoteChannel) {
      remoteChannel.close();
      console.log(`Closed data channel with label: ${remoteChannel.label}`);
    }
    localConnection.close();
    remoteConnection.close();
    setLocalConnection(null);
    setRemoteConnection(null);
    console.log('Closed peer connections');
  }, [localChannel, remoteChannel]);

  useEffect(() => {
    const holder = document.getElementById('holder');
    holder.ondragenter = function () {
      this.className = styles['file-input__holder-hover'];
      return false;
    };
    holder.ondragleave = function () {
      this.className = styles['file-input__holder'];
      return false;
    };
    holder.ondragover = () => {
      console.log('over');
      return false;
    };
    holder.ondrop = function (e) {
      console.log('dropped');
      e.preventDefault();
      console.log(e);
      this.className = styles['file-input__holder'];
      // 用原本的樣子存state, 透過send button 來read file
      setSelectedFile(e.dataTransfer.files[0]);
    };
  }, []);

  /**
   * connection initialization
   */
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

        const localDataChannel =
          localUser.createDataChannel('my local channel');
        localDataChannel.binaryType = 'arraybuffer';
        localDataChannel.onopen = onSendChannelStageChange(localDataChannel);
        localDataChannel.onclose = onSendChannelStageChange(localDataChannel);

        remoteUser.onicecandidate = async (event) => {
          try {
            await localUser.addIceCandidate(event.candidate);
          } catch (e) {
            console.log('remote user error: ', e);
          }
        };

        remoteUser.ondatachannel = (e) => {
          const receiveChannel = e.channel;
          receiveChannel.onmessage = (event) => onReceiveChannelGotData(event);
          receiveChannel.onopen = onReceiveChannelStateChange(receiveChannel);
          receiveChannel.onclose = onReceiveChannelStateChange(receiveChannel);
          setRemoteChannel(receiveChannel);
        };

        setLocalConnection(localUser);
        setRemoteConnection(remoteUser);
        setLocalChannel(localDataChannel);
      } catch (error) {
        console.log(`initialize users error: `, error);
      }
    })();
  }, [
    onReceiveChannelGotData,
    onReceiveChannelStateChange,
    onSendChannelStageChange,
  ]);

  useEffect(() => {
    (async () => {
      if (selectedFile && localChannel.readyState !== 'open') {
        try {
          const offer = await localConnection.createOffer({
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1,
          });
          await localConnection.setLocalDescription(offer);
          await remoteConnection.setRemoteDescription(offer);

          const answer = await remoteConnection.createAnswer(null);
          await remoteConnection.setLocalDescription(answer);
          await localConnection.setRemoteDescription(answer);
        } catch (e) {
          console.log(`p2p connection error: `, e);
        }
      }
    })();
  }, [selectedFile, localConnection, remoteConnection, localChannel]);

  return (
    <div className="webrtc-bg" id={`${styles['rtc-file-transfer']}`}>
      <div className="webrtc-title">
        <span className="arrow left" onClick={() => navigate(-1)}></span>
        <h1>File Transfer Demo</h1>
      </div>
      <div className={`webrtc-card ${styles['file-input']}`}>
        <form>
          <input
            type="file"
            id="fileInput"
            name="files"
            onChange={(e) => setSelectedFile(e.target.files[0])}
          />
          <div className={`${styles['file-input__holder']}`} id="holder">
            {!!selectedFile ? (
              <div className={`${styles['file-input__holder__file']}`}>
                <img
                  src="https://findicons.com/files/icons/2813/flat_jewels/512/file.png"
                  alt="file"
                />
                <p>{selectedFile.fileName || 'file'}</p>
              </div>
            ) : (
              <p>Drop files here...</p>
            )}
          </div>
        </form>
        <div className="webrtc-actions">
          <button className="btn btn-success" onClick={() => sendFileHandler()}>
            Send
          </button>
          <button className="btn btn-danger">Abort</button>
        </div>
        <div className={`${styles['progress']}`}>
          <div className={`${styles['progress__send']}`}>
            <div className="label">Send progress: </div>
            <progress
              id="sendProgress"
              max={selectedFile?.size || 0}
              value={sendProgress}
            ></progress>
          </div>

          <div className={`${styles['progress__receive']}`}>
            <div className="label">Receive progress: </div>
            <progress
              id="receiveProgress"
              max={selectedFile?.size || 0}
              value={receiveProgress.current}
            ></progress>
          </div>
        </div>
      </div>
      <div className={`webrtc-card ${styles['meta-info']}`}>
        <div ref={byteRef} className={`${styles['meta-info__text']}`}></div>
        <a ref={anchorRef} className={`${styles['meta-info__btn']}`}></a>
        <span id="status"></span>
      </div>
    </div>
  );
};

export default RtcFileTransferContainer;
