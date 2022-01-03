import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import styles from './Home.module.scss';

const Home = () => {
  console.log(process.env.PUBLIC_URL);
  return (
    <div id={styles['rtc-home-container']} className="webrtc-bg">
      <div className="webrtc-title">
        <h1>WebRTC Demo</h1>
      </div>

      <ul className={`webrtc-actions ${styles['rtc-actions-list']}`}>
        {ROUTES.map((route) => (
          <li className="webrtc-btn-earth">
            <Link to={route.route}>{route.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
