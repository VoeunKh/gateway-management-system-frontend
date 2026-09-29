import { render } from 'preact';
import { App } from './App';
import './styles/app.css';

const root = document.getElementById('app');

// The /ui gallery exists only in dev; Vite drops this branch from production builds.
if (root && import.meta.env.DEV && window.location.pathname === '/ui') {
  void import('./ui/gallery/Gallery').then(({ Gallery }) => render(<Gallery />, root));
} else if (root) {
  render(<App />, root);
}
