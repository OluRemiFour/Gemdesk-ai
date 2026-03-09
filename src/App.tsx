import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./components/home";
import OverlayBar from "./components/OverlayBar";

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/overlay" element={<OverlayBar onClose={() => window.close()} />} />
        </Routes>
      </>
    </Suspense>
  );
}

export default App;
