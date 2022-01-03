import React from 'react';
import ReactDOM from 'react-dom';
import { createBrowserHistory } from 'history';
import './index.scss';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

export const history = createBrowserHistory({
  basename: process.env.PUBLIC_URL,
});

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter basename="webrtc">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
