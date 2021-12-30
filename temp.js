"use strict";

const sendButton = document.getElementById("sendFile");

const downloadAnchor = document.querySelector("a#download");
const fileInput = document.querySelector("input#fileInput");
const bitrateDiv = document.querySelector("div#bitrate");
const sendProgress = document.querySelector("progress#sendProgress");
const receiveProgress = document.querySelector("progress#receiveProgress");
const statusMessage = document.querySelector("span#status");
if (sendButton instanceof HTMLProgressElement)
  sendButton.setAttribute("disabled", "disabled");
sendButton.addEventListener("click", sendData);
fileInput.addEventListener("change", handleFileInputChange, false);
let fileReader;
let localPeer;
let remotePeer;
let datachannel;
let receiveChannel;

let receiveBuffer = [];
let receivedSize = 0;
let bytesPrev = 0;
let timestampPrev = 0;
let timestampStart;
let statsInterval = null;
let bitrateMax = 0;

async function handleFileInputChange() {
  const file = fileInput.files[0];
  console.log(file);
  if (!file) {
    alert("No file chosen");
  } else {
    await startConnection();
    sendButton.disabled = false;
  }
}

async function startConnection() {
  console.log("Requesting local stream");

  try {
    const configuration = null;
    localPeer = buildPeerConnection(localPeer, configuration);
    datachannel = localPeer.createDataChannel("my local channel");
    datachannel.binaryType = "arraybuffer";
    datachannel.onopen = onChannelStageChange(datachannel);
    datachannel.onclose = onChannelStageChange(datachannel);

    remotePeer = buildPeerConnection(remotePeer, configuration);
    remotePeer.ondatachannel = receiveChannelCallback;
    await communication(localPeer, remotePeer);
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
  }
}

function sendData() {
  const file = fileInput.files[0];
  console.log(
    `File is ${[file.name, file.size, file.type, file.lastModified].join(" ")}`
  );

  // Handle 0 size files.
  statusMessage.textContent = "";
  downloadAnchor.textContent = "";
  if (file.size === 0) {
    bitrateDiv.innerHTML = "";
    statusMessage.textContent = "File is empty, please select a non-empty file";
    closeDataChannels();
    return;
  }
  sendProgress.max = file.size;
  receiveProgress.max = file.size;
  const chunkSize = 16384;
  fileReader = new FileReader();
  let offset = 0;
  fileReader.addEventListener("error", (error) =>
    console.error("Error reading file:", error)
  );
  fileReader.addEventListener("abort", (event) =>
    console.log("File reading aborted:", event)
  );
  fileReader.addEventListener("load", (e) => {
    console.log("FileRead.onload ", e);
    datachannel.send(e.target.result);
    offset += e.target.result.byteLength;
    sendProgress.value = offset;
    if (offset < file.size) {
      readSlice(offset);
    }
  });
  const readSlice = (o) => {
    console.log("readSlice ", o);
    const slice = file.slice(offset, o + chunkSize);
    fileReader.readAsArrayBuffer(slice);
  };
  readSlice(0);
}

function receiveChannelCallback(event) {
  console.log("Receive Channel Callback");
  receiveChannel = event.channel;
  // receiveChannel.binaryType = 'arraybuffer'; // !! important 設定格式
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;

  receivedSize = 0;
  bitrateMax = 0;
  downloadAnchor.textContent = "";
  downloadAnchor.removeAttribute("download");
  if (downloadAnchor.href) {
    URL.revokeObjectURL(downloadAnchor.href);
    downloadAnchor.removeAttribute("href");
  }
}

function closeDataChannels() {
  console.log("Closing data channels");
  datachannel.close();
  console.log(`Closed data channel with label: ${datachannel.label}`);
  if (receiveChannel) {
    receiveChannel.close();
    console.log(`Closed data channel with label: ${receiveChannel.label}`);
  }
  localPeer.close();
  remotePeer.close();
  localPeer = null;
  remotePeer = null;
  console.log("Closed peer connections");

  // re-enable the file select
  fileInput.disabled = false;
  // abortButton.disabled = true;
  sendButton.disabled = false;
}

function onChannelStageChange(channel) {
  const readyState = channel.readyState;
  const name = channel === datachannel ? "Local" : "Receive";
  console.log(`${name} channel state is: ${readyState}`);
}

async function onReceiveChannelStateChange() {
  const readyState = receiveChannel.readyState;
  console.log(`Receive channel state is: ${readyState}`);
  if (readyState === "open") {
    timestampStart = new Date().getTime();
    timestampPrev = timestampStart;
    statsInterval = setInterval(displayStats, 500);
    await displayStats();
  }
}

function onReceiveMessageCallback(event) {
  console.log("Received Message", event);
  console.log(`Received Message ${event.data.byteLength}`);
  receiveBuffer.push(event.data);
  receivedSize += event.data.byteLength;
  console.log(receivedSize, event.data);
  receiveProgress.value = receivedSize || 0;

  // we are assuming that our signaling protocol told
  // about the expected file size (and name, hash, etc).
  const file = fileInput.files[0];
  if (receivedSize === file.size) {
    const received = new Blob(receiveBuffer);
    receiveBuffer = [];

    downloadAnchor.href = URL.createObjectURL(received);
    downloadAnchor.download = file.name;
    downloadAnchor.textContent = `Click to download '${file.name}' (${file.size} bytes)`;
    downloadAnchor.style.display = "block";

    const bitrate = Math.round(
      (receivedSize * 8) / (new Date().getTime() - timestampStart)
    );
    bitrateDiv.innerHTML = `<strong>Average Bitrate:</strong> ${bitrate} kbits/sec (max: ${bitrateMax} kbits/sec)`;

    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }

    closeDataChannels();
  }
}

// display bitrate statistics.
async function displayStats() {
  if (remotePeer && remotePeer.iceConnectionState === "connected") {
    const stats = await remotePeer.getStats();
    let activeCandidatePair;
    stats.forEach((report) => {
      if (report.type === "transport") {
        activeCandidatePair = stats.get(report.selectedCandidatePairId);
      }
    });
    if (activeCandidatePair) {
      if (timestampPrev === activeCandidatePair.timestamp) {
        return;
      }
      // calculate current bitrate
      const bytesNow = activeCandidatePair.bytesReceived;
      const bitrate = Math.round(
        ((bytesNow - bytesPrev) * 8) /
          (activeCandidatePair.timestamp - timestampPrev)
      );
      bitrateDiv.innerHTML = `<strong>Current Bitrate:</strong> ${bitrate} kbits/sec`;
      timestampPrev = activeCandidatePair.timestamp;
      bytesPrev = bytesNow;
      if (bitrate > bitrateMax) {
        bitrateMax = bitrate;
      }
    }
  }
}

function buildPeerConnection(label, configuration) {
  const peer = new RTCPeerConnection(configuration);
  console.log(`Created peer connection object: ${getName(label)}`);

  peer.onicecandidate = (e) => onIceCandidate(label, e);

  return peer;
}

async function communication(pc1, pc2) {
  const offer = await pc1.createOffer();
  await pc1.setLocalDescription(offer);
  await pc2.setRemoteDescription(offer);

  const answer = await pc2.createAnswer();
  await pc2.setLocalDescription(answer);
  await pc1.setRemoteDescription(answer);
}

function getOtherPc(pc) {
  return pc == localPeer ? remotePeer : localPeer;
}
function getName(pc) {
  return pc == localPeer ? "localPeer" : "remotePeer";
}

async function onIceCandidate(pc, event) {
  try {
    await getOtherPc(pc).addIceCandidate(event.candidate);

    console.log(
      `${getName(pc)} ICE candidate:\n${
        event.candidate ? event.candidate.candidate : "(null)"
      }`
    );
  } catch (e) {
    console.log(`${getName(pc)} ICE candidate Error:`, e);
  }
}

function close() {
  console.log("Ending call");
  localPeer.close();
  remotePeer.close();
  localPeer = null;
  remotePeer = null;

  sendButton.disabled = false;
}
