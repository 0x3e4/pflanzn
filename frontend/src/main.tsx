import { createRoot } from 'react-dom/client'
import "./global.css";
import App from './App.tsx'
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

createRoot(document.getElementById('root')!).render(
  <SkeletonTheme
    baseColor="#46484f"
    highlightColor="#5d616a"
    duration={1.2}
  >
    <App />
  </SkeletonTheme>
)
