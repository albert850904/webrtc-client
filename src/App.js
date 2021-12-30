import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./container/home/HomeContainer";
import RtcDataTransferContainer from "./container/rtc-data/RtcDataTransferContainer";
import RtcFileTransferContainer from "./container/rtc-file/RtcFileTransferContainer";
import RtcP2pContainer from "./container/rtc-p2p/RtcP2pContainer";
import RtcVideoContainer from "./container/rtc-video/RtcVideoContainer";
import RtcWs from "./container/rtc-ws/RtcWs";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video" element={<RtcVideoContainer />} exact />
        <Route path="/call" element={<RtcP2pContainer />} exact />
        <Route path="/data" element={<RtcDataTransferContainer />} exact />
        <Route path="/file" element={<RtcFileTransferContainer />} exact />
        <Route path="/ws" element={<RtcWs />} exact />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
