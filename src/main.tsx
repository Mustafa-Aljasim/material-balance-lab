import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./qc.css";
import "katex/dist/katex.min.css";
createRoot(document.getElementById("root")!).render(<App />);
